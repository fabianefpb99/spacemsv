
-- 1) Tighten profiles_update_own WITH CHECK to also lock KYC/identity fields
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
  )
);

-- 2) Revoke anon EXECUTE on SECURITY DEFINER functions that should never be public
REVOKE EXECUTE ON FUNCTION public._profiles_lock_sensitive_cols() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_start_boost(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_stop_boost(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boost_autoclose_expired() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_boost_target(uuid, text) FROM PUBLIC, anon, authenticated;

-- 3) Pin search_path on functions currently missing it
ALTER FUNCTION public._mission_period_start(text) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
