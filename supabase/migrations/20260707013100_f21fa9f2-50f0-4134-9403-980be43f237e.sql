-- Column-level REVOKE on game_sessions.server_seed to mirror game_rounds.server_seed.
-- Defense-in-depth: even if a future SELECT policy or SECURITY DEFINER function
-- returns rows from game_sessions, the server_seed column remains inaccessible
-- to anon/authenticated roles, preserving provably-fair guarantees.
REVOKE SELECT (server_seed) ON public.game_sessions FROM anon;
REVOKE SELECT (server_seed) ON public.game_sessions FROM authenticated;