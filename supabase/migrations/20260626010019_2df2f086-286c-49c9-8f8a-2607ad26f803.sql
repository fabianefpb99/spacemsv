
-- =========================================================================
-- VIP RANK REWARDS: premios por subir de sub-rango (Bronce V→IV, etc.)
-- =========================================================================

-- Catálogo: una fila por sub-rango destino. Bronce V se siembra pero con
-- reward_kind='none' (sub-rango inicial, no otorga premio de entrada).
CREATE TABLE IF NOT EXISTS public.vip_rank_rewards (
  rank          public.vip_rank NOT NULL,
  sub_division  public.vip_sub  NOT NULL,
  min_level     int             NOT NULL,
  reward_kind   text            NOT NULL DEFAULT 'none'
                CHECK (reward_kind IN ('none','bonus','avatar')),
  reward_amount numeric         NOT NULL DEFAULT 0,
  reward_avatar_key text,
  reward_label  text,
  reward_image_url text,
  is_active     boolean         NOT NULL DEFAULT true,
  updated_at    timestamptz     NOT NULL DEFAULT now(),
  updated_by    uuid,
  PRIMARY KEY (rank, sub_division)
);

GRANT SELECT ON public.vip_rank_rewards TO anon, authenticated;
GRANT ALL    ON public.vip_rank_rewards TO service_role;

ALTER TABLE public.vip_rank_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vip_rank_rewards_read_all"
  ON public.vip_rank_rewards FOR SELECT
  USING (true);

CREATE POLICY "vip_rank_rewards_admin_write"
  ON public.vip_rank_rewards FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed: 35 sub-rangos
INSERT INTO public.vip_rank_rewards (rank, sub_division, min_level, reward_kind)
SELECT rank, sub_division, MIN(level), 'none'
  FROM public.vip_levels
 GROUP BY rank, sub_division
ON CONFLICT (rank, sub_division) DO NOTHING;

-- ===== Premios desbloqueados por usuario (pendientes / reclamados) =======
CREATE TABLE IF NOT EXISTS public.user_vip_rewards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank          public.vip_rank NOT NULL,
  sub_division  public.vip_sub  NOT NULL,
  reward_kind   text NOT NULL,
  reward_amount numeric NOT NULL DEFAULT 0,
  reward_avatar_key text,
  reward_label  text,
  reward_image_url text,
  unlocked_at   timestamptz NOT NULL DEFAULT now(),
  claimed_at    timestamptz,
  UNIQUE (user_id, rank, sub_division)
);

CREATE INDEX IF NOT EXISTS user_vip_rewards_user_idx
  ON public.user_vip_rewards (user_id, unlocked_at DESC);

GRANT SELECT, UPDATE ON public.user_vip_rewards TO authenticated;
GRANT ALL ON public.user_vip_rewards TO service_role;

ALTER TABLE public.user_vip_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uvr_owner_read"
  ON public.user_vip_rewards FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "uvr_admin_all"
  ON public.user_vip_rewards FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================================
-- Detector: inserta filas en user_vip_rewards por cada sub-rango alcanzado.
-- Llamado por award_xp (y disponible para backfill).
-- =========================================================================
CREATE OR REPLACE FUNCTION public._check_vip_rewards(p_user_id uuid, p_level int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL OR p_level IS NULL OR p_level < 1 THEN
    RETURN;
  END IF;

  INSERT INTO public.user_vip_rewards (
    user_id, rank, sub_division, reward_kind, reward_amount,
    reward_avatar_key, reward_label, reward_image_url
  )
  SELECT
    p_user_id, r.rank, r.sub_division, r.reward_kind, r.reward_amount,
    r.reward_avatar_key, r.reward_label, r.reward_image_url
  FROM public.vip_rank_rewards r
  WHERE r.is_active
    AND r.reward_kind <> 'none'
    AND r.min_level <= p_level
    AND r.min_level > 1  -- nunca premiar el sub-rango inicial (Bronce V)
  ON CONFLICT (user_id, rank, sub_division) DO NOTHING;
END;
$$;

-- =========================================================================
-- Modificar award_xp para disparar _check_vip_rewards en cada subida real.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id uuid, p_bet_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg         public.vip_config%ROWTYPE;
  v_xp_gain     int;
  v_new_total   bigint;
  v_new_level   int;
  v_old_level   int;
  v_dow         int;
  v_multiplier  numeric := 1;
  v_event       jsonb;
  v_active      boolean;
  v_ends_at     timestamptz;
  v_badge       text;
  v_mult_parsed numeric;
BEGIN
  SELECT * INTO v_cfg FROM public.vip_config WHERE id = true;
  IF NOT FOUND OR NOT v_cfg.is_active THEN RETURN; END IF;
  IF p_bet_amount IS NULL OR p_bet_amount < v_cfg.min_bet_for_xp THEN RETURN; END IF;

  v_xp_gain := v_cfg.xp_per_bet_base
             + floor( log( (p_bet_amount / v_cfg.xp_log_scale) + 1 ) * v_cfg.xp_log_factor )::int;

  SELECT value INTO v_event
    FROM public.site_settings
   WHERE key = 'eventos_special_event';

  IF v_event IS NOT NULL THEN
    v_active := COALESCE((v_event->>'active')::boolean, false);
    v_ends_at := NULLIF(v_event->>'ends_at','')::timestamptz;
    v_badge   := COALESCE(v_event->>'badge_value','');
    BEGIN
      v_mult_parsed := NULLIF(regexp_replace(v_badge, '[^0-9\.]', '', 'g'), '')::numeric;
    EXCEPTION WHEN others THEN
      v_mult_parsed := NULL;
    END;

    IF v_active
       AND v_mult_parsed IS NOT NULL
       AND v_mult_parsed > 1
       AND (v_ends_at IS NULL OR v_ends_at > now())
    THEN
      v_multiplier := v_mult_parsed;
    END IF;
  END IF;

  IF v_multiplier = 1 THEN
    v_dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Bogota'))::int;
    IF v_dow = 0 OR v_dow = 6 THEN
      v_multiplier := 2;
    END IF;
  END IF;

  v_xp_gain := (v_xp_gain * v_multiplier)::int;

  IF v_xp_gain <= 0 THEN RETURN; END IF;

  SELECT current_level INTO v_old_level FROM public.user_vip WHERE user_id = p_user_id;

  INSERT INTO public.user_vip (user_id, total_xp, current_level)
  VALUES (p_user_id, v_xp_gain, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = public.user_vip.total_xp + EXCLUDED.total_xp,
        updated_at = now()
  RETURNING total_xp INTO v_new_total;

  SELECT COALESCE(MAX(level), 0) INTO v_new_level
    FROM public.vip_levels
   WHERE xp_required <= v_new_total
     AND level <= v_cfg.cap_level;

  UPDATE public.user_vip
     SET current_level = v_new_level,
         updated_at = now()
   WHERE user_id = p_user_id
     AND current_level <> v_new_level;

  IF v_new_level > COALESCE(v_old_level, 0) THEN
    PERFORM public._check_vip_rewards(p_user_id, v_new_level);
  END IF;
END;
$function$;

-- También dispararlo cuando un admin ajusta XP manualmente.
CREATE OR REPLACE FUNCTION public.admin_adjust_xp(p_target_user_id uuid, p_delta bigint, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(out_total_xp bigint, out_current_level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_cap int;
  v_new_total bigint;
  v_new_level int;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(cap_level, 100) INTO v_cap FROM public.vip_config WHERE id = true;

  INSERT INTO public.user_vip AS uv (user_id, total_xp, current_level)
  VALUES (p_target_user_id, GREATEST(0, p_delta), 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = GREATEST(0, uv.total_xp + p_delta),
        updated_at = now()
  RETURNING uv.total_xp INTO v_new_total;

  SELECT COALESCE(MAX(vl.level), 0) INTO v_new_level
    FROM public.vip_levels vl
   WHERE vl.xp_required <= v_new_total
     AND vl.level <= COALESCE(v_cap, 100);

  UPDATE public.user_vip
     SET current_level = v_new_level,
         updated_at = now()
   WHERE user_id = p_target_user_id;

  PERFORM public._check_vip_rewards(p_target_user_id, v_new_level);

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'adjust_xp', p_target_user_id,
          jsonb_build_object('delta', p_delta, 'reason', p_reason,
                             'new_total_xp', v_new_total, 'new_level', v_new_level));

  out_total_xp := v_new_total;
  out_current_level := v_new_level;
  RETURN NEXT;
END;
$function$;

-- =========================================================================
-- Reclamar premio: acredita bonus o registra el avatar como reclamado.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.claim_vip_reward(p_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  public.user_vip_rewards%ROWTYPE;
  v_new_bonus numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
    FROM public.user_vip_rewards
   WHERE id = p_reward_id
     AND user_id = v_user
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_claimed', true);
  END IF;

  IF v_row.reward_kind = 'bonus' AND v_row.reward_amount > 0 THEN
    INSERT INTO public.user_balances(user_id, bonus_balance)
      VALUES (v_user, v_row.reward_amount)
      ON CONFLICT (user_id) DO UPDATE
        SET bonus_balance = public.user_balances.bonus_balance + EXCLUDED.bonus_balance,
            updated_at = now()
      RETURNING bonus_balance INTO v_new_bonus;

    INSERT INTO public.transactions (user_id, type, amount, meta)
    VALUES (v_user, 'bonus', v_row.reward_amount,
      jsonb_build_object(
        'source','vip_rank_reward',
        'rank', v_row.rank,
        'sub_division', v_row.sub_division,
        'reward_id', v_row.id
      ));

  ELSIF v_row.reward_kind = 'avatar' THEN
    -- Nothing to credit; the avatar entry already exists in user_vip_rewards
    -- and is unlocked by claim.
    NULL;
  END IF;

  UPDATE public.user_vip_rewards
     SET claimed_at = now()
   WHERE id = p_reward_id;

  RETURN jsonb_build_object(
    'ok', true,
    'kind', v_row.reward_kind,
    'amount', v_row.reward_amount,
    'avatar_key', v_row.reward_avatar_key,
    'new_bonus_balance', v_new_bonus
  );
END;
$$;

-- =========================================================================
-- Admin: upsert de un sub-rango del catálogo.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_vip_reward(
  p_rank public.vip_rank,
  p_sub  public.vip_sub,
  p_kind text,
  p_amount numeric,
  p_avatar_key text,
  p_label text,
  p_image_url text,
  p_is_active boolean
)
RETURNS public.vip_rank_rewards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.vip_rank_rewards;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind NOT IN ('none','bonus','avatar') THEN
    RAISE EXCEPTION 'invalid_kind' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.vip_rank_rewards
     SET reward_kind = p_kind,
         reward_amount = COALESCE(p_amount, 0),
         reward_avatar_key = p_avatar_key,
         reward_label = p_label,
         reward_image_url = p_image_url,
         is_active = COALESCE(p_is_active, true),
         updated_at = now(),
         updated_by = v_admin
   WHERE rank = p_rank AND sub_division = p_sub
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subrank_not_found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'upsert_vip_reward', NULL,
    jsonb_build_object('rank', p_rank, 'sub', p_sub, 'kind', p_kind, 'amount', p_amount,
                       'avatar_key', p_avatar_key, 'active', p_is_active));

  RETURN v_row;
END;
$$;

-- Backfill: para usuarios existentes con nivel > 1, sembrar sus premios
-- pendientes (sin reclamar todavía). No premia Bronce V.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id, current_level FROM public.user_vip WHERE current_level >= 1 LOOP
    PERFORM public._check_vip_rewards(r.user_id, r.current_level);
  END LOOP;
END $$;
