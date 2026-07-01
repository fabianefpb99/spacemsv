-- 1) Arena: no direct player reads of arena_rounds.
-- The game returns the round result through the server RPC; direct Data API reads are unnecessary
-- and can confuse scanners because the table contains cryptographic seed material.
DROP POLICY IF EXISTS "Users read own arena rounds" ON public.arena_rounds;
REVOKE SELECT ON public.arena_rounds FROM authenticated;
REVOKE SELECT ON public.arena_rounds FROM anon;
REVOKE SELECT (server_seed, server_seed_hash) ON public.arena_rounds FROM authenticated;
REVOKE SELECT (server_seed, server_seed_hash) ON public.arena_rounds FROM anon;
GRANT ALL ON public.arena_rounds TO service_role;

-- 2) Profiles: protect onboarding/security flags at both RLS and trigger layers.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
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
  )
);

CREATE OR REPLACE FUNCTION public._profiles_lock_sensitive_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := false;
  v_is_service boolean := (current_setting('role', true) = 'service_role');
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  END IF;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Restore all sensitive columns for regular users.
  NEW.verification_status  := OLD.verification_status;
  NEW.is_blocked           := OLD.is_blocked;
  NEW.phone_verified       := OLD.phone_verified;
  NEW.referred_by          := OLD.referred_by;
  NEW.referral_code        := OLD.referral_code;
  NEW.first_deposit_at     := OLD.first_deposit_at;
  NEW.vip_last_seen_level  := OLD.vip_last_seen_level;
  NEW.terms_accepted_at    := OLD.terms_accepted_at;
  NEW.profile_completed    := OLD.profile_completed;

  -- KYC/document fields — must never be self-edited after admin sets them.
  NEW.document_type        := OLD.document_type;
  NEW.document_number      := OLD.document_number;
  NEW.document_issue_date  := OLD.document_issue_date;
  NEW.birth_date           := OLD.birth_date;
  NEW.gender               := OLD.gender;

  RETURN NEW;
END
$function$;