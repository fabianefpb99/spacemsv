CREATE INDEX IF NOT EXISTS game_rounds_game_created_idx
  ON public.game_rounds (game, created_at DESC);

ALTER TABLE public.game_rounds SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-empty-spaceman-rounds') THEN
    PERFORM cron.unschedule('prune-empty-spaceman-rounds');
  END IF;
END $$;

SELECT cron.schedule(
  'prune-empty-spaceman-rounds',
  '20 3 * * *',
  $cron$
    DELETE FROM public.game_rounds r
    WHERE r.game = 'spaceman'
      AND r.status = 'crashed'
      AND r.created_at < now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.game_bets b WHERE b.round_id = r.id
      );
  $cron$
);