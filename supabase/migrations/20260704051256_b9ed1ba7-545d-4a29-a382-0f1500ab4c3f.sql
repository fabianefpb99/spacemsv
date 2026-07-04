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
      AND NOT (p.document_number IS DISTINCT FROM profiles.document_number)
      AND NOT (p.document_type IS DISTINCT FROM profiles.document_type)
      AND NOT (p.document_issue_date IS DISTINCT FROM profiles.document_issue_date)
      AND NOT (p.birth_date IS DISTINCT FROM profiles.birth_date)
      AND NOT (p.gender IS DISTINCT FROM profiles.gender)
      AND NOT (p.terms_accepted_at IS DISTINCT FROM profiles.terms_accepted_at)
      AND NOT (p.profile_completed IS DISTINCT FROM profiles.profile_completed)
      AND NOT (p.phone IS DISTINCT FROM profiles.phone)
      AND NOT (p.second_name IS DISTINCT FROM profiles.second_name)
      AND NOT (p.second_last_name IS DISTINCT FROM profiles.second_last_name)
      AND NOT (p.username IS DISTINCT FROM profiles.username)
      AND NOT (p.email IS DISTINCT FROM profiles.email)
      -- Freeze name fields and avatar once user is no longer 'unverified'
      AND (
        p.verification_status = 'unverified'
        OR (
          NOT (p.first_name IS DISTINCT FROM profiles.first_name)
          AND NOT (p.last_name IS DISTINCT FROM profiles.last_name)
          AND NOT (p.avatar_key IS DISTINCT FROM profiles.avatar_key)
        )
      )
  )
);