CREATE OR REPLACE FUNCTION public.set_my_avatar_key(_avatar_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
  SET avatar_key = _avatar_key
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_avatar_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_avatar_key(text) TO authenticated;