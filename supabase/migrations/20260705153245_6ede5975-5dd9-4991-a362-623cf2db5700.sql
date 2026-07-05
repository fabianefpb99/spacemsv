-- 1) vip_rank_rewards: restrict SELECT to authenticated users (removes anon exposure of updated_by admin UUIDs)
DROP POLICY IF EXISTS vip_rank_rewards_read_all ON public.vip_rank_rewards;
CREATE POLICY vip_rank_rewards_read_auth
  ON public.vip_rank_rewards
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.vip_rank_rewards FROM anon;

-- 2) vip_config: restrict SELECT to admins only (internal XP/RTP parameters)
DROP POLICY IF EXISTS vip_config_select_auth ON public.vip_config;
CREATE POLICY vip_config_select_admin
  ON public.vip_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) set_my_avatar_key: revoke anon EXECUTE so unauthenticated callers cannot invoke this SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.set_my_avatar_key(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_avatar_key(text) TO authenticated;