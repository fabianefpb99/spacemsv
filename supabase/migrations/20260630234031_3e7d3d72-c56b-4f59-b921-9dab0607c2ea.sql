DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_rounds'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.game_rounds';
  END IF;
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds (id, game, status, crash_multiplier, server_seed_hash, client_seed, betting_ends_at, started_at, ended_at, created_at)';
END$$;