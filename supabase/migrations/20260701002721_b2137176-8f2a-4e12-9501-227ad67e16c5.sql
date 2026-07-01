-- Keep arena_rounds intentionally closed to client Data API reads while avoiding
-- an RLS-enabled-with-no-policy linter warning.
DROP POLICY IF EXISTS arena_rounds_no_direct_client_reads ON public.arena_rounds;
CREATE POLICY arena_rounds_no_direct_client_reads
ON public.arena_rounds
FOR SELECT
TO authenticated
USING (false);

-- Email queue scheduler/trigger helpers are internal only. They can still run
-- as triggers/cron under their owning privileged roles, but not through public RPC.
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM authenticated;