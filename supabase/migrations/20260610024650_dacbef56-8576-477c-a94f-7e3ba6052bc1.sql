
DROP POLICY IF EXISTS "mission_rewards_public_read" ON storage.objects;
CREATE POLICY "mission_rewards_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'mission-rewards');

DROP POLICY IF EXISTS "mission_rewards_admin_insert" ON storage.objects;
CREATE POLICY "mission_rewards_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'mission-rewards' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "mission_rewards_admin_update" ON storage.objects;
CREATE POLICY "mission_rewards_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'mission-rewards' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'mission-rewards' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "mission_rewards_admin_delete" ON storage.objects;
CREATE POLICY "mission_rewards_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'mission-rewards' AND public.has_role(auth.uid(), 'admin'));
