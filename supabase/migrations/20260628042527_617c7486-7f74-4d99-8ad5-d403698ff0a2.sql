
-- Lock down all SECURITY DEFINER functions in public from anon/PUBLIC.
DO $$
DECLARE
  r record;
  sig text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    sig := format('public.%I(%s)', r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', sig);
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated only for functions the app calls from the client/server-fn as a signed-in user.
GRANT EXECUTE ON FUNCTION public.admin_adjust_xp(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_vip_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_vip_reward(vip_rank, vip_sub, text, numeric, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_withdrawal_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_vip_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(numeric, deposit_method, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_today_position() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_public_wins(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_today_top_arena(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_today_top_winners(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_admin_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_admin_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.play_arena_v1(uuid, numeric, text, uuid, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_roulette_v1(uuid, numeric, text, uuid) TO authenticated;
