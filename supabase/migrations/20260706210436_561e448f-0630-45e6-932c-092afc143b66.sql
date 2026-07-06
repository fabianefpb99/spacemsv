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

    -- Avatar rewards are permanent collectibles. Once the user owns the avatar,
    -- future daily/weekly cycles must not create fresh progress/completion rows
    -- for the same avatar mission again.
    IF m.reward_kind = 'avatar'
      AND EXISTS (
        SELECT 1
        FROM public.user_avatar_unlocks uau
        WHERE uau.user_id = p_user_id
          AND uau.mission_id = m.id
      )
    THEN
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