CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS TABLE(invited int, deposited int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(*)::int AS invited,
    COUNT(*) FILTER (WHERE first_deposit_at IS NOT NULL)::int AS deposited
  FROM public.profiles
  WHERE referred_by = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;