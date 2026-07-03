-- Allow RLS policies to evaluate has_role() for anon visitors.
-- The function is SECURITY DEFINER and only reads user_roles for the given user id,
-- so exposing execution to anon is safe (anon has no auth.uid() so it returns false).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;