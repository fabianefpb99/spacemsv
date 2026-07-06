DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profiles.id
      AND NOT (p.verification_status IS DISTINCT FROM profiles.verification_status)
      AND NOT (p.is_blocked IS DISTINCT FROM profiles.is_blocked)
      AND NOT (p.phone_verified IS DISTINCT FROM profiles.phone_verified)
      AND NOT (p.referred_by IS DISTINCT FROM profiles.referred_by)
      AND NOT (p.referral_code IS DISTINCT FROM profiles.referral_code)
      AND NOT (p.first_deposit_at IS DISTINCT FROM profiles.first_deposit_at)
      AND NOT (p.email IS DISTINCT FROM profiles.email)
      AND NOT (p.username IS DISTINCT FROM profiles.username)
  )
);