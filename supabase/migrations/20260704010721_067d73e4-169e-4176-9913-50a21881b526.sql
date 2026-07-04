REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sports_auto_transition() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sports_cancel_match(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sports_place_bet(uuid, sports_bet_selection, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sports_settle_match(uuid, integer, integer) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sports_auto_transition() TO service_role;
GRANT EXECUTE ON FUNCTION public.sports_cancel_match(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sports_place_bet(uuid, sports_bet_selection, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sports_settle_match(uuid, integer, integer) TO authenticated, service_role;