
-- 1) Nuevas columnas en missions
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS trigger_event text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trigger_game text,
  ADD COLUMN IF NOT EXISTS metric text NOT NULL DEFAULT 'count',
  ADD COLUMN IF NOT EXISTS min_amount numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_trigger_event_check'
  ) THEN
    ALTER TABLE public.missions ADD CONSTRAINT missions_trigger_event_check
      CHECK (trigger_event IN ('bet_placed','bet_won','deposit_made','manual'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_metric_check'
  ) THEN
    ALTER TABLE public.missions ADD CONSTRAINT missions_metric_check
      CHECK (metric IN ('count','sum_amount'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_min_amount_check'
  ) THEN
    ALTER TABLE public.missions ADD CONSTRAINT missions_min_amount_check
      CHECK (min_amount >= 0);
  END IF;
END$$;

-- 2) free_spins en user_balances
ALTER TABLE public.user_balances
  ADD COLUMN IF NOT EXISTS free_spins integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_balances_free_spins_nonneg'
  ) THEN
    ALTER TABLE public.user_balances ADD CONSTRAINT user_balances_free_spins_nonneg
      CHECK (free_spins >= 0);
  END IF;
END$$;

-- 3) user_missions: progreso por usuario / periodo
CREATE TABLE IF NOT EXISTS public.user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  progress numeric NOT NULL DEFAULT 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, period_start)
);

GRANT SELECT ON public.user_missions TO authenticated;
GRANT ALL ON public.user_missions TO service_role;

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_missions_select_own" ON public.user_missions;
CREATE POLICY "user_missions_select_own" ON public.user_missions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_missions_admin_select_all" ON public.user_missions;
CREATE POLICY "user_missions_admin_select_all" ON public.user_missions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS user_missions_user_idx ON public.user_missions(user_id);
CREATE INDEX IF NOT EXISTS user_missions_mission_idx ON public.user_missions(mission_id);

-- updated_at trigger reutilizando set_updated_at si existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_updated_at' AND pronamespace='public'::regnamespace) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='user_missions_set_updated_at') THEN
      EXECUTE 'CREATE TRIGGER user_missions_set_updated_at BEFORE UPDATE ON public.user_missions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
  END IF;
END$$;

-- 4) user_avatar_unlocks
CREATE TABLE IF NOT EXISTS public.user_avatar_unlocks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  image_url text,
  label text,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mission_id)
);

GRANT SELECT ON public.user_avatar_unlocks TO authenticated;
GRANT ALL ON public.user_avatar_unlocks TO service_role;

ALTER TABLE public.user_avatar_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_avatar_unlocks_select_own" ON public.user_avatar_unlocks;
CREATE POLICY "user_avatar_unlocks_select_own" ON public.user_avatar_unlocks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_avatar_unlocks_admin_select_all" ON public.user_avatar_unlocks;
CREATE POLICY "user_avatar_unlocks_admin_select_all" ON public.user_avatar_unlocks
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 5) Helper: periodo correspondiente a una misión (zona horaria Colombia)
CREATE OR REPLACE FUNCTION public._mission_period_start(p_type text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'daily'  THEN (date_trunc('day',  (now() AT TIME ZONE 'America/Bogota')) AT TIME ZONE 'America/Bogota')
    WHEN 'weekly' THEN (date_trunc('week', (now() AT TIME ZONE 'America/Bogota')) AT TIME ZONE 'America/Bogota')
    ELSE 'epoch'::timestamptz
  END;
$$;

-- 6) Función principal: incrementa progreso y entrega recompensa una sola vez por periodo
CREATE OR REPLACE FUNCTION public._award_mission_progress(
  p_user_id uuid,
  p_event   text,
  p_game    text,
  p_amount  numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  v_period timestamptz;
  v_inc numeric;
  v_progress numeric;
  v_prev_completed timestamptz;
  v_completed boolean;
BEGIN
  IF p_user_id IS NULL OR p_event IS NULL THEN
    RETURN;
  END IF;

  FOR m IN
    SELECT * FROM public.missions
    WHERE is_active = true
      AND trigger_event = p_event
      AND (trigger_game IS NULL OR trigger_game = p_game)
      AND COALESCE(ABS(p_amount),0) >= COALESCE(min_amount,0)
  LOOP
    v_period := public._mission_period_start(m.type);

    v_inc := CASE m.metric
      WHEN 'sum_amount' THEN COALESCE(ABS(p_amount), 0)
      ELSE 1
    END;

    IF v_inc <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.user_missions(user_id, mission_id, period_start, progress)
    VALUES (p_user_id, m.id, v_period, v_inc)
    ON CONFLICT (user_id, mission_id, period_start) DO UPDATE
      SET progress = CASE
        WHEN public.user_missions.completed_at IS NULL
          THEN public.user_missions.progress + EXCLUDED.progress
        ELSE public.user_missions.progress
      END,
      updated_at = now()
    RETURNING progress, completed_at INTO v_progress, v_prev_completed;

    IF v_prev_completed IS NULL AND v_progress >= m.goal THEN
      -- Marcar completado (re-check) y entregar recompensa de forma idempotente
      UPDATE public.user_missions
        SET completed_at = now()
        WHERE user_id = p_user_id
          AND mission_id = m.id
          AND period_start = v_period
          AND completed_at IS NULL
        RETURNING true INTO v_completed;

      IF COALESCE(v_completed, false) THEN
        IF m.reward_kind = 'bonus' AND m.reward_value > 0 THEN
          INSERT INTO public.user_balances(user_id, bonus_balance)
            VALUES (p_user_id, m.reward_value)
            ON CONFLICT (user_id) DO UPDATE
              SET bonus_balance = public.user_balances.bonus_balance + EXCLUDED.bonus_balance;

          INSERT INTO public.transactions(user_id, type, amount, meta)
            VALUES (p_user_id, 'bonus', m.reward_value,
              jsonb_build_object('source','mission','mission_id', m.id, 'mission_title', m.title));

        ELSIF m.reward_kind = 'spins' AND m.reward_value > 0 THEN
          INSERT INTO public.user_balances(user_id, free_spins)
            VALUES (p_user_id, m.reward_value::int)
            ON CONFLICT (user_id) DO UPDATE
              SET free_spins = public.user_balances.free_spins + EXCLUDED.free_spins::int;

        ELSIF m.reward_kind = 'xp' AND m.reward_value > 0 THEN
          PERFORM public.award_xp(p_user_id, m.reward_value);

        ELSIF m.reward_kind = 'avatar' THEN
          INSERT INTO public.user_avatar_unlocks(user_id, mission_id, image_url, label)
            VALUES (p_user_id, m.id, m.reward_image_url, m.reward_label)
            ON CONFLICT (user_id, mission_id) DO NOTHING;
        END IF;

        UPDATE public.user_missions
          SET claimed_at = now()
          WHERE user_id = p_user_id
            AND mission_id = m.id
            AND period_start = v_period
            AND claimed_at IS NULL;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._award_mission_progress(uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._award_mission_progress(uuid, text, text, numeric) TO service_role;

-- 7) Trigger sobre transactions
CREATE OR REPLACE FUNCTION public._missions_after_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NEW.type = 'bet' THEN
      PERFORM public._award_mission_progress(NEW.user_id, 'bet_placed', NEW.game, NEW.amount);
    ELSIF NEW.type = 'win' THEN
      PERFORM public._award_mission_progress(NEW.user_id, 'bet_won', NEW.game, NEW.amount);
    ELSIF NEW.type = 'deposit' THEN
      PERFORM public._award_mission_progress(NEW.user_id, 'deposit_made', NULL, NEW.amount);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Nunca rompe el insert original (apuesta, ganancia, depósito).
    NULL;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS missions_after_transaction ON public.transactions;
CREATE TRIGGER missions_after_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public._missions_after_transaction();
