CREATE OR REPLACE FUNCTION public.sports_unsettle_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_match public.sports_matches%ROWTYPE;
  v_bet RECORD;
  v_balance_after numeric(14,2);
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match FROM public.sports_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_match.status <> 'finished' OR v_match.settled_at IS NULL THEN
    RAISE EXCEPTION 'not_settled' USING ERRCODE = '22023';
  END IF;

  -- Reverse each settled bet.
  FOR v_bet IN
    SELECT * FROM public.sports_bets
      WHERE match_id = _match_id AND status IN ('won','lost')
      FOR UPDATE
  LOOP
    IF v_bet.status = 'won' THEN
      -- Deduct the payout previously credited to the user.
      SELECT balance - COALESCE(v_bet.payout, 0) INTO v_balance_after
        FROM public.user_balances WHERE user_id = v_bet.user_id FOR UPDATE;

      UPDATE public.user_balances
        SET balance = balance - COALESCE(v_bet.payout, 0), updated_at = now()
        WHERE user_id = v_bet.user_id;

      INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
      VALUES (
        v_bet.user_id,
        'adjustment',
        -COALESCE(v_bet.payout, 0),
        v_balance_after,
        'sports',
        jsonb_build_object(
          'sports_bet_id', v_bet.id,
          'match_id', _match_id,
          'reason', 'settlement_reversed'
        )
      );
    END IF;

    UPDATE public.sports_bets
      SET status = 'pending', payout = NULL, settled_at = NULL
      WHERE id = v_bet.id;
  END LOOP;

  -- Reopen the match so admin can re-settle with the correct score.
  UPDATE public.sports_matches
    SET status = 'scheduled',
        home_score = NULL,
        away_score = NULL,
        settled_at = NULL
    WHERE id = _match_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (
    v_admin,
    'sports_unsettle_match',
    NULL,
    jsonb_build_object('match_id', _match_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sports_unsettle_match(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sports_unsettle_match(uuid) TO authenticated, service_role;