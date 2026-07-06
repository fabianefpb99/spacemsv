-- 1) profiles_update_own: extend WITH CHECK to make additional KYC/onboarding fields immutable from client
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
      AND NOT (p.verification_status IS DISTINCT FROM profiles.verification_status)
      AND NOT (p.is_blocked IS DISTINCT FROM profiles.is_blocked)
      AND NOT (p.phone_verified IS DISTINCT FROM profiles.phone_verified)
      AND NOT (p.referred_by IS DISTINCT FROM profiles.referred_by)
      AND NOT (p.referral_code IS DISTINCT FROM profiles.referral_code)
      AND NOT (p.first_deposit_at IS DISTINCT FROM profiles.first_deposit_at)
      AND NOT (p.email IS DISTINCT FROM profiles.email)
      AND NOT (p.username IS DISTINCT FROM profiles.username)
      -- Newly protected onboarding / KYC fields:
      AND NOT (p.terms_accepted_at IS DISTINCT FROM profiles.terms_accepted_at)
      AND NOT (p.profile_completed  IS DISTINCT FROM profiles.profile_completed)
      AND NOT (p.birth_date          IS DISTINCT FROM profiles.birth_date)
      AND NOT (p.gender              IS DISTINCT FROM profiles.gender)
      AND NOT (p.document_type       IS DISTINCT FROM profiles.document_type)
      AND NOT (p.document_number     IS DISTINCT FROM profiles.document_number)
      AND NOT (p.document_issue_date IS DISTINCT FROM profiles.document_issue_date)
      AND NOT (p.second_name         IS DISTINCT FROM profiles.second_name)
      AND NOT (p.second_last_name    IS DISTINCT FROM profiles.second_last_name)
  )
);

-- 2) game_rounds: hide server_seed from direct SELECT and from Realtime payloads.
--    - Revoke authenticated column-level SELECT on server_seed.
--    - Re-declare table column list on the realtime publication without server_seed.
--    - Provide a security-definer RPC that returns server_seed ONLY for finished rounds.

REVOKE SELECT ON public.game_rounds FROM authenticated;
GRANT SELECT (
  id, game, status, crash_multiplier, server_seed_hash,
  client_seed, betting_ends_at, started_at, ended_at, created_at
) ON public.game_rounds TO authenticated;

-- Rebuild realtime publication entry without the server_seed column.
ALTER PUBLICATION supabase_realtime DROP TABLE public.game_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds
  (id, game, status, crash_multiplier, server_seed_hash,
   client_seed, betting_ends_at, started_at, ended_at, created_at);

CREATE OR REPLACE FUNCTION public.get_round_server_seed(_round_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT server_seed
  FROM public.game_rounds
  WHERE id = _round_id
    AND status IN ('crashed'::game_round_status, 'settled'::game_round_status);
$$;

REVOKE ALL ON FUNCTION public.get_round_server_seed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_round_server_seed(uuid) TO authenticated;