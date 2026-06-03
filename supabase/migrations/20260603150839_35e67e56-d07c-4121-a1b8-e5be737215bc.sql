
-- 1) game_rtp_config: restrict reads to admins only
DROP POLICY IF EXISTS game_rtp_config_select_auth ON public.game_rtp_config;

-- 2) game_rounds: hide server_seed via column-level grants
REVOKE SELECT ON public.game_rounds FROM authenticated, anon;
GRANT SELECT (id, game, status, crash_multiplier, server_seed_hash, client_seed, betting_ends_at, started_at, ended_at, created_at) ON public.game_rounds TO authenticated;

-- 3) Revoke EXECUTE from anon/public on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public._credit_win(uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._debit_bet(uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.adjust_balance(uuid, numeric, transaction_type, text, uuid, uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_approve_deposit(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_reject_deposit(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_block(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_rtp(text, numeric, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bj_apply_action(uuid, uuid, integer, jsonb, jsonb, game_session_status, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_deposit_request(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.confirm_deposit_request(uuid, boolean, text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_deposit_request(numeric, numeric, deposit_method) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.expire_pending_deposits() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_vip_level_seen() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spaceman_cashout(uuid, uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spaceman_current_round() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spaceman_place_bet(uuid, numeric, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spaceman_tick() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) FROM anon, public;

-- Ensure authenticated/service_role can still call the ones used at runtime
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_deposit_request(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_deposit_request(uuid, boolean, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_deposit_request(numeric, numeric, deposit_method) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_vip_level_seen() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_cashout(uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_current_round() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_place_bet(uuid, numeric, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_tick() TO service_role;
GRANT EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bj_apply_action(uuid, uuid, integer, jsonb, jsonb, game_session_status, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_deposits() TO service_role;
