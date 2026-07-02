-- 1) roulette_config: remove public read access; admin-only via existing ALL policy
DROP POLICY IF EXISTS "Anon users can read roulette config" ON public.roulette_config;
DROP POLICY IF EXISTS "Authenticated users can read roulette config" ON public.roulette_config;
REVOKE SELECT ON public.roulette_config FROM anon;

-- 2) profiles: extend immutable-column protection to phone, second_name, second_last_name
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profiles.id
        AND NOT (p.verification_status  IS DISTINCT FROM profiles.verification_status)
        AND NOT (p.is_blocked           IS DISTINCT FROM profiles.is_blocked)
        AND NOT (p.phone_verified       IS DISTINCT FROM profiles.phone_verified)
        AND NOT (p.referred_by          IS DISTINCT FROM profiles.referred_by)
        AND NOT (p.referral_code        IS DISTINCT FROM profiles.referral_code)
        AND NOT (p.first_deposit_at     IS DISTINCT FROM profiles.first_deposit_at)
        AND NOT (p.document_number      IS DISTINCT FROM profiles.document_number)
        AND NOT (p.document_type        IS DISTINCT FROM profiles.document_type)
        AND NOT (p.document_issue_date  IS DISTINCT FROM profiles.document_issue_date)
        AND NOT (p.birth_date           IS DISTINCT FROM profiles.birth_date)
        AND NOT (p.gender               IS DISTINCT FROM profiles.gender)
        AND NOT (p.terms_accepted_at    IS DISTINCT FROM profiles.terms_accepted_at)
        AND NOT (p.profile_completed    IS DISTINCT FROM profiles.profile_completed)
        AND NOT (p.phone                IS DISTINCT FROM profiles.phone)
        AND NOT (p.second_name          IS DISTINCT FROM profiles.second_name)
        AND NOT (p.second_last_name     IS DISTINCT FROM profiles.second_last_name)
    )
  );

-- 3) deposit_requests: stop broadcasting PII over Realtime; admin UI will poll
ALTER PUBLICATION supabase_realtime DROP TABLE public.deposit_requests;

-- 4) increment_jackpot: revoke public/authenticated EXECUTE on SECURITY DEFINER fn
REVOKE EXECUTE ON FUNCTION public.increment_jackpot(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_jackpot(numeric) TO service_role;