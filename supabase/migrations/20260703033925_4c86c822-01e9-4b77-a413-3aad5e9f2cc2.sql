-- Grant read access so the public /deportes page can list published matches via the Data API
GRANT SELECT ON public.sports_matches TO anon, authenticated;
GRANT SELECT ON public.sports_competitions TO anon, authenticated;
GRANT ALL ON public.sports_matches TO service_role;
GRANT ALL ON public.sports_competitions TO service_role;

-- Public read policy for active competitions (admin write policy already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sports_competitions' AND policyname = 'sports_competitions read active'
  ) THEN
    CREATE POLICY "sports_competitions read active"
      ON public.sports_competitions
      FOR SELECT
      USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;