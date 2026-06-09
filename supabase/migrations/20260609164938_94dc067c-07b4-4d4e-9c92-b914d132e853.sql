
CREATE POLICY "Admins can upload home-content"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'home-content' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update home-content"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'home-content' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete home-content"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'home-content' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can list home-content"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'home-content' AND public.has_role(auth.uid(), 'admin'::app_role));
