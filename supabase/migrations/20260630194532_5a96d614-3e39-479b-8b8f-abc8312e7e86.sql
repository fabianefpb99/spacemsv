CREATE OR REPLACE FUNCTION public.admin_stop_boost(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.boost_sessions;
  v_end timestamptz := now();
  v_tx int := 0;
  v_rounds int := 0;
  v_bets int := 0;
  v_arena int := 0;
  v_missions int := 0;
  v_sessions int := 0;
  v_balance_before numeric;
  v_bonus_before numeric;
  v_xp_before bigint;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.boost_sessions
   WHERE ended_at IS NULL FOR UPDATE LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_boost' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_tx FROM public.transactions
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  SELECT COUNT(*) INTO v_bets FROM public.game_bets
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  SELECT COUNT(*) INTO v_rounds FROM public.game_rounds
   WHERE created_at >= v_row.started_at
     AND id IN (SELECT round_id FROM public.game_bets
                 WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at);
  SELECT COUNT(*) INTO v_arena FROM public.arena_rounds
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  SELECT COUNT(*) INTO v_missions FROM public.user_missions
   WHERE user_id = v_row.target_user_id
     AND (created_at >= v_row.started_at OR updated_at >= v_row.started_at);
  SELECT COUNT(*) INTO v_sessions FROM public.game_sessions
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;

  SELECT balance, bonus_balance INTO v_balance_before, v_bonus_before
    FROM public.user_balances WHERE user_id = v_row.target_user_id;
  SELECT total_xp INTO v_xp_before
    FROM public.user_vip WHERE user_id = v_row.target_user_id;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'session_id', v_row.id,
      'target_user_id', v_row.target_user_id,
      'started_at', v_row.started_at,
      'would_delete', jsonb_build_object(
        'transactions', v_tx,
        'game_bets', v_bets,
        'game_rounds_user_only', v_rounds,
        'arena_rounds', v_arena,
        'user_missions', v_missions,
        'game_sessions', v_sessions
      ),
      'will_reset_balance_from', jsonb_build_object('real', v_balance_before, 'bonus', v_bonus_before),
      'will_reset_xp_from', v_xp_before
    );
  END IF;

  DELETE FROM public.transactions
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  DELETE FROM public.game_bets
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  DELETE FROM public.arena_rounds
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  DELETE FROM public.user_missions
   WHERE user_id = v_row.target_user_id
     AND (created_at >= v_row.started_at OR updated_at >= v_row.started_at);
  DELETE FROM public.game_sessions
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;

  UPDATE public.user_balances
     SET balance = 0, bonus_balance = 0, updated_at = now()
   WHERE user_id = v_row.target_user_id;
  UPDATE public.user_vip
     SET total_xp = 0, current_level = 0, updated_at = now()
   WHERE user_id = v_row.target_user_id;
  -- FIX: user_vip_rewards uses unlocked_at, not created_at
  DELETE FROM public.user_vip_rewards
   WHERE user_id = v_row.target_user_id AND unlocked_at >= v_row.started_at;

  UPDATE public.boost_sessions
     SET ended_at = v_end,
         ended_by = v_admin,
         cleanup_summary = jsonb_build_object(
           'transactions', v_tx,
           'game_bets', v_bets,
           'arena_rounds', v_arena,
           'user_missions', v_missions,
           'game_sessions', v_sessions,
           'reset_balance_from', jsonb_build_object('real', v_balance_before, 'bonus', v_bonus_before),
           'reset_xp_from', v_xp_before
         )
   WHERE id = v_row.id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'boost_stop', v_row.target_user_id,
          jsonb_build_object('session_id', v_row.id, 'summary',
            jsonb_build_object('transactions', v_tx, 'bets', v_bets,
                               'arena', v_arena, 'missions', v_missions, 'sessions', v_sessions)));

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_row.id,
    'cleaned', jsonb_build_object(
      'transactions', v_tx,
      'game_bets', v_bets,
      'arena_rounds', v_arena,
      'user_missions', v_missions,
      'game_sessions', v_sessions
    )
  );
END;
$$;