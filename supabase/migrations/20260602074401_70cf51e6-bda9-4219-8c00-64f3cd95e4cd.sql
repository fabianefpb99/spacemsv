-- Atomic state transition for a Blackjack session.
-- Validates the optimistic concurrency token (nonce), persists the new state,
-- and returns the updated row. The card logic lives in TS; this function only
-- guarantees that two concurrent actions on the same session cannot both win.
CREATE OR REPLACE FUNCTION public.bj_apply_action(
  p_session_id      uuid,
  p_user_id         uuid,
  p_expected_nonce  int,
  p_new_state       jsonb,
  p_new_public_state jsonb,
  p_new_status      game_session_status,
  p_new_payout      numeric DEFAULT NULL
)
RETURNS public.game_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_sessions;
BEGIN
  UPDATE public.game_sessions
     SET state         = p_new_state,
         public_state  = p_new_public_state,
         status        = p_new_status,
         payout        = COALESCE(p_new_payout, payout),
         nonce         = nonce + 1,
         closed_at     = CASE WHEN p_new_status = 'closed'::game_session_status THEN now() ELSE closed_at END
   WHERE id      = p_session_id
     AND user_id = p_user_id
     AND nonce   = p_expected_nonce
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bj_stale_nonce' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;