
-- Add WITH CHECK on profiles_update_own to explicitly reject changes to sensitive columns.
-- Defense-in-depth alongside existing _profiles_lock_sensitive_cols trigger.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profiles.id
      AND p.verification_status IS NOT DISTINCT FROM profiles.verification_status
      AND p.is_blocked IS NOT DISTINCT FROM profiles.is_blocked
      AND p.phone_verified IS NOT DISTINCT FROM profiles.phone_verified
      AND p.referred_by IS NOT DISTINCT FROM profiles.referred_by
      AND p.referral_code IS NOT DISTINCT FROM profiles.referral_code
      AND p.first_deposit_at IS NOT DISTINCT FROM profiles.first_deposit_at
  )
);
