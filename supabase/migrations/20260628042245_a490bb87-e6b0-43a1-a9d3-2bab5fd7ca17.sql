
-- 1. arena_rounds: revoke SELECT on server_seed for non-admin
REVOKE SELECT ON public.arena_rounds FROM authenticated;
GRANT SELECT (id, user_id, bet_amount, character_bet, odds_snapshot, winner, won, multiplier, payout, combat_log, server_seed_hash, client_action_id, created_at) ON public.arena_rounds TO authenticated;

-- 2. profiles: restrict UPDATE to non-sensitive columns
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  username, first_name, second_name, last_name, second_last_name,
  email, gender, phone, birth_date,
  document_type, document_number, document_issue_date,
  avatar_key, terms_accepted_at, profile_completed
) ON public.profiles TO authenticated;

-- 3. admin_users_overview: make it run with caller permissions (RLS on profiles enforces admin-only via profiles_admin_select_all)
ALTER VIEW public.admin_users_overview SET (security_invoker = true);

-- 4. bj_apply_action: never reveal server_seed/state while session is still open
CREATE OR REPLACE FUNCTION public.bj_apply_action(
  p_session_id uuid,
  p_user_id uuid,
  p_expected_nonce integer,
  p_new_state jsonb,
  p_new_public_state jsonb,
  p_new_status game_session_status,
  p_new_payout numeric DEFAULT NULL::numeric
)
RETURNS game_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Never leak the pre-committed server seed (or full private state) while the round is still in play.
  IF v_row.status = 'open'::game_session_status THEN
    v_row.server_seed := NULL;
    v_row.state := NULL;
  END IF;

  RETURN v_row;
END;
$function$;
