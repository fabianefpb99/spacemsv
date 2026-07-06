-- Restore replica identity to DEFAULT (primary key) so UPDATEs succeed
-- under the column-scoped realtime publication. FULL required every column
-- to be in the publication column list, which caused spaceman_tick to fail
-- with "Column list used by the publication does not cover the replica identity".
ALTER TABLE public.game_rounds REPLICA IDENTITY DEFAULT;

-- Force-close any spaceman round that is stuck in running/betting past its expected end
UPDATE public.game_rounds
   SET status = 'crashed',
       ended_at = COALESCE(ended_at, started_at + ((LN(GREATEST(crash_multiplier, 1.0001)) / 0.06) || ' seconds')::interval, now())
 WHERE game = 'spaceman'
   AND status IN ('betting', 'running')
   AND (started_at IS NULL OR started_at + interval '5 minutes' < now());

-- Also settle any orphan active bets on those rounds as lost
UPDATE public.game_bets
   SET status = 'lost', payout = 0, settled_at = now()
 WHERE status = 'active'
   AND round_id IN (
     SELECT id FROM public.game_rounds
      WHERE game = 'spaceman' AND status = 'crashed' AND ended_at < now() - interval '10 seconds'
   );