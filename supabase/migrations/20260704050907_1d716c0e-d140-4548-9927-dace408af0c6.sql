-- Fix sports public reads without exposing admin role checks to anonymous users.
-- Root cause: public/anon policies evaluated has_role(), but has_role execution was intentionally revoked from anon.
-- Solution: split public read policies from authenticated admin policies, and narrow table grants.

BEGIN;

-- -----------------------------------------------------------------------------
-- sports_matches: public can read only published matches; authenticated admins can manage.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "sports_matches read published" ON public.sports_matches;
DROP POLICY IF EXISTS "sports_matches admin write" ON public.sports_matches;
DROP POLICY IF EXISTS sports_matches_public_read_published ON public.sports_matches;
DROP POLICY IF EXISTS sports_matches_authenticated_admin_read_all ON public.sports_matches;
DROP POLICY IF EXISTS sports_matches_authenticated_admin_write ON public.sports_matches;

REVOKE ALL ON public.sports_matches FROM anon, authenticated;
GRANT SELECT ON public.sports_matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_matches TO authenticated;
GRANT ALL ON public.sports_matches TO service_role;

CREATE POLICY sports_matches_public_read_published
  ON public.sports_matches
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY sports_matches_authenticated_admin_read_all
  ON public.sports_matches
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY sports_matches_authenticated_admin_write
  ON public.sports_matches
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- -----------------------------------------------------------------------------
-- sports_competitions: public can read only active competitions; admins can manage.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "sports_competitions read active" ON public.sports_competitions;
DROP POLICY IF EXISTS "sports_competitions admin write" ON public.sports_competitions;
DROP POLICY IF EXISTS sports_competitions_public_read_active ON public.sports_competitions;
DROP POLICY IF EXISTS sports_competitions_authenticated_admin_read_all ON public.sports_competitions;
DROP POLICY IF EXISTS sports_competitions_authenticated_admin_write ON public.sports_competitions;

REVOKE ALL ON public.sports_competitions FROM anon, authenticated;
GRANT SELECT ON public.sports_competitions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_competitions TO authenticated;
GRANT ALL ON public.sports_competitions TO service_role;

CREATE POLICY sports_competitions_public_read_active
  ON public.sports_competitions
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY sports_competitions_authenticated_admin_read_all
  ON public.sports_competitions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY sports_competitions_authenticated_admin_write
  ON public.sports_competitions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- -----------------------------------------------------------------------------
-- sports_bets: no anonymous table access. Users read only their own bets;
-- admins can read/manage through authenticated role. Writes by players remain
-- through the locked sports_place_bet RPC, not direct client inserts.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "sports_bets user read own" ON public.sports_bets;
DROP POLICY IF EXISTS "sports_bets admin write" ON public.sports_bets;
DROP POLICY IF EXISTS sports_bets_authenticated_user_read_own ON public.sports_bets;
DROP POLICY IF EXISTS sports_bets_authenticated_admin_read_all ON public.sports_bets;
DROP POLICY IF EXISTS sports_bets_authenticated_admin_write ON public.sports_bets;

REVOKE ALL ON public.sports_bets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_bets TO authenticated;
GRANT ALL ON public.sports_bets TO service_role;

CREATE POLICY sports_bets_authenticated_user_read_own
  ON public.sports_bets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY sports_bets_authenticated_admin_read_all
  ON public.sports_bets
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY sports_bets_authenticated_admin_write
  ON public.sports_bets
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMIT;