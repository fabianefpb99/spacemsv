-- Block client-side reads of cryptographic seeds on arena_rounds.
-- Inserts/updates still work because they're performed by SECURITY DEFINER RPCs (service_role).
REVOKE SELECT (server_seed, server_seed_hash) ON public.arena_rounds FROM authenticated;
REVOKE SELECT (server_seed, server_seed_hash) ON public.arena_rounds FROM anon;