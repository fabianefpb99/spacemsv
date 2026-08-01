-- Stop the always-on one-second engine. The authenticated, masked round reader
-- will advance the engine only while at least one player is in Spaceman.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spaceman-tick') THEN
    PERFORM cron.unschedule('spaceman-tick');
  END IF;
END $$;

-- Serialize engine advancement so simultaneous players cannot create two rounds.
CREATE OR REPLACE FUNCTION public.spaceman_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_round            public.game_rounds%ROWTYPE;
  v_now              timestamptz := now();
  v_crash_duration_s numeric;
  v_new_id           uuid;
  v_seed             text;
  v_seed_hash        text;
  v_crash            numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('betspace:spaceman_tick'));

  SELECT * INTO v_round
    FROM public.game_rounds
   WHERE game = 'spaceman'
     AND status IN ('betting', 'running')
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF v_round.status = 'betting' AND v_now >= v_round.betting_ends_at THEN
      UPDATE public.game_rounds
         SET status = 'running',
             started_at = v_round.betting_ends_at
       WHERE id = v_round.id;
      RETURN jsonb_build_object('action', 'start_flight', 'round_id', v_round.id);
    END IF;

    IF v_round.status = 'running' THEN
      v_crash_duration_s := LN(v_round.crash_multiplier) / 0.06;
      IF v_now >= v_round.started_at + (v_crash_duration_s || ' seconds')::interval THEN
        UPDATE public.game_rounds
           SET status = 'crashed',
               ended_at = v_round.started_at + (v_crash_duration_s || ' seconds')::interval,
               server_seed = v_round.server_seed
         WHERE id = v_round.id;

        UPDATE public.game_bets
           SET status = 'lost',
               payout = 0,
               settled_at = v_now
         WHERE round_id = v_round.id
           AND status = 'active';

        RETURN jsonb_build_object('action', 'crash', 'round_id', v_round.id, 'crash', v_round.crash_multiplier);
      END IF;
    END IF;

    RETURN jsonb_build_object('action', 'noop', 'round_id', v_round.id, 'status', v_round.status);
  END IF;

  SELECT * INTO v_round
    FROM public.game_rounds
   WHERE game = 'spaceman'
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND AND v_round.status = 'crashed' AND v_now < v_round.ended_at + interval '3 seconds' THEN
    RETURN jsonb_build_object('action', 'reveal_wait', 'round_id', v_round.id);
  END IF;

  v_seed := encode(gen_random_bytes(32), 'hex');
  v_seed_hash := encode(digest(v_seed, 'sha256'), 'hex');
  v_crash := public._spaceman_gen_crash(v_seed);

  INSERT INTO public.game_rounds (
    game, status, server_seed, server_seed_hash,
    betting_ends_at, crash_multiplier
  ) VALUES (
    'spaceman', 'betting', v_seed, v_seed_hash,
    v_now + interval '7 seconds', v_crash
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('action', 'new_round', 'round_id', v_new_id, 'crash', v_crash);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.spaceman_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spaceman_tick() TO service_role;

-- This is the only authenticated entry point. It advances the engine first,
-- then returns a masked shape that never reveals an active round's seed/crash.
CREATE OR REPLACE FUNCTION public.spaceman_current_round()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_round public.game_rounds%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.spaceman_tick();

  SELECT * INTO v_round
    FROM public.game_rounds
   WHERE game = 'spaceman'
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id',               v_round.id,
    'status',           v_round.status,
    'server_seed_hash', v_round.server_seed_hash,
    'betting_ends_at',  v_round.betting_ends_at,
    'started_at',       v_round.started_at,
    'ended_at',         v_round.ended_at,
    'server_seed',      CASE WHEN v_round.status = 'crashed' THEN v_round.server_seed ELSE NULL END,
    'crash_multiplier', CASE WHEN v_round.status = 'crashed' THEN v_round.crash_multiplier ELSE NULL END,
    'server_now',       now()
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.spaceman_current_round() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spaceman_current_round() TO authenticated, service_role;

-- Resolve the overloaded-function ambiguity that made this job fail continuously.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'detect-games-in-red') THEN
    PERFORM cron.unschedule('detect-games-in-red');
  END IF;
END $$;

SELECT cron.schedule(
  'detect-games-in-red',
  '*/5 * * * *',
  $cron$SELECT public.detect_games_in_red(30, 20000, 5, 30000, 1.30, 60);$cron$
);

-- Keep only useful Spaceman history. Bet-linked rounds remain untouched.
DELETE FROM public.game_rounds r
WHERE r.game = 'spaceman'
  AND r.created_at < now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.game_bets b WHERE b.round_id = r.id
  );

-- pg_cron logs are operational diagnostics, not product history.
DELETE FROM cron.job_run_details
WHERE start_time < now() - interval '1 day';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-job-runs') THEN
    PERFORM cron.unschedule('cleanup-cron-job-runs');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-cron-job-runs',
  '0 3 * * *',
  $cron$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '1 day';$cron$
);

CREATE INDEX IF NOT EXISTS transactions_user_type_game_idx
  ON public.transactions (user_id, type, game)
  WHERE game IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_type_created_idx
  ON public.transactions (type, created_at DESC);