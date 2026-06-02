
-- has_role MUST be executable by authenticated for RLS policies that call it.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
