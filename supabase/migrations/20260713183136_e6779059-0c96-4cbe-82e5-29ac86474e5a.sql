-- Explicitly revoke SELECT on server_seed for game_rounds from authenticated and anon,
-- ensuring past table-level GRANT SELECT cannot expose the seed via PostgREST.
REVOKE SELECT (server_seed) ON public.game_rounds FROM authenticated;
REVOKE SELECT (server_seed) ON public.game_rounds FROM anon;
REVOKE SELECT (server_seed) ON public.game_rounds FROM PUBLIC;
REVOKE INSERT (server_seed), UPDATE (server_seed) ON public.game_rounds FROM authenticated, anon, PUBLIC;