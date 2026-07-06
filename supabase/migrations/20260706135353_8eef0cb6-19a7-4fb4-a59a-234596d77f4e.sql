
REVOKE SELECT (server_seed) ON public.arena_rounds FROM authenticated, anon, PUBLIC;
REVOKE INSERT (server_seed), UPDATE (server_seed) ON public.arena_rounds FROM authenticated, anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_round_server_seed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_round_server_seed(uuid) TO authenticated;
