
-- Split home_slides read policy so anon does not evaluate has_role
DROP POLICY IF EXISTS "Anyone can read active slides" ON public.home_slides;
CREATE POLICY "Anon can read active slides"
  ON public.home_slides FOR SELECT TO anon
  USING (active = true);
CREATE POLICY "Authenticated can read slides"
  ON public.home_slides FOR SELECT TO authenticated
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Split home_featured_games read policy
DROP POLICY IF EXISTS "Anyone can read active featured games" ON public.home_featured_games;
CREATE POLICY "Anon can read active featured games"
  ON public.home_featured_games FOR SELECT TO anon
  USING (active = true);
CREATE POLICY "Authenticated can read featured games"
  ON public.home_featured_games FOR SELECT TO authenticated
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Scope user_vip_rewards admin/owner policies to authenticated
DROP POLICY IF EXISTS uvr_owner_read ON public.user_vip_rewards;
DROP POLICY IF EXISTS uvr_admin_all ON public.user_vip_rewards;
CREATE POLICY uvr_owner_read
  ON public.user_vip_rewards FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY uvr_admin_all
  ON public.user_vip_rewards FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Scope vip_rank_rewards admin write to authenticated
DROP POLICY IF EXISTS vip_rank_rewards_admin_write ON public.vip_rank_rewards;
CREATE POLICY vip_rank_rewards_admin_write
  ON public.vip_rank_rewards FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Now safe to revoke has_role EXECUTE from anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
