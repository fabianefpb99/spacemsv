DROP POLICY IF EXISTS "mission_rewards_public_read" ON storage.objects;
DROP POLICY IF EXISTS "vip_rewards_public_read" ON storage.objects;

CREATE POLICY "mission_rewards_authenticated_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mission-rewards');

CREATE POLICY "vip_rewards_authenticated_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vip-rewards');

REVOKE EXECUTE ON FUNCTION public.admin_bet_insights(timestamp with time zone, timestamp with time zone) FROM anon;