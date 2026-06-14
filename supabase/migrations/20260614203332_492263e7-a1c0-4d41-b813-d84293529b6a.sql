
-- 1) Tighten aggregate "game in red" detector
CREATE OR REPLACE FUNCTION public.detect_games_in_red(
  p_window_minutes int DEFAULT 30,
  p_min_loss numeric DEFAULT 20000,
  p_min_txs int DEFAULT 5,
  p_min_handle numeric DEFAULT 30000,
  p_min_payout_ratio numeric DEFAULT 1.30,
  p_cooldown_minutes int DEFAULT 60
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_inserted int := 0;
  v_last timestamptz;
BEGIN
  FOR v_row IN
    SELECT
      game,
      COUNT(*) AS tx_count,
      SUM(CASE WHEN type='bet' THEN ABS(amount) ELSE 0 END) AS handle,
      SUM(CASE WHEN type='win' THEN amount ELSE 0 END)      AS payout,
      -SUM(amount) AS casino_net
    FROM public.transactions
    WHERE game IS NOT NULL
      AND type IN ('bet','win')
      AND created_at >= now() - (p_window_minutes || ' minutes')::interval
    GROUP BY game
    HAVING COUNT(*) >= p_min_txs
       AND SUM(CASE WHEN type='bet' THEN ABS(amount) ELSE 0 END) >= p_min_handle
       AND -SUM(amount) <= -p_min_loss
       AND SUM(CASE WHEN type='bet' THEN ABS(amount) ELSE 0 END) > 0
       AND ( SUM(CASE WHEN type='win' THEN amount ELSE 0 END)
             / NULLIF(SUM(CASE WHEN type='bet' THEN ABS(amount) ELSE 0 END), 0) ) >= p_min_payout_ratio
  LOOP
    SELECT last_alert_at INTO v_last
      FROM public.game_red_state WHERE game = v_row.game;

    IF v_last IS NULL OR v_last < now() - (p_cooldown_minutes || ' minutes')::interval THEN
      INSERT INTO public.admin_notifications (type, title, body, link, meta)
      VALUES (
        'game_red_alert',
        'Juego en rojo: ' || upper(v_row.game),
        'Pérdida $' || to_char(-v_row.casino_net,'FM999G999G999')
          || ' COP · apostado $' || to_char(v_row.handle,'FM999G999G999')
          || ' · pagado $' || to_char(v_row.payout,'FM999G999G999')
          || ' (' || v_row.tx_count || ' jugadas en ' || p_window_minutes || ' min)',
        '/adminpanel',
        jsonb_build_object(
          'game', v_row.game,
          'casino_net', v_row.casino_net,
          'handle', v_row.handle,
          'payout', v_row.payout,
          'payout_ratio', round((v_row.payout / NULLIF(v_row.handle,0))::numeric, 3),
          'tx_count', v_row.tx_count,
          'window_minutes', p_window_minutes
        )
      );

      INSERT INTO public.game_red_state (game, last_alert_at, last_net)
      VALUES (v_row.game, now(), v_row.casino_net)
      ON CONFLICT (game) DO UPDATE
        SET last_alert_at = EXCLUDED.last_alert_at,
            last_net      = EXCLUDED.last_net;

      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

-- 2) Single-round big-payout detector (catches "ludópata" or lucky-strike rounds)
CREATE OR REPLACE FUNCTION public.detect_big_single_payouts(
  p_window_minutes int DEFAULT 10,
  p_min_win        numeric DEFAULT 50000,
  p_min_net        numeric DEFAULT 40000
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_inserted int := 0;
BEGIN
  FOR v_row IN
    SELECT
      t.user_id,
      t.game,
      t.game_round_id,
      SUM(CASE WHEN t.type='bet' THEN ABS(t.amount) ELSE 0 END) AS bet_total,
      SUM(CASE WHEN t.type='win' THEN t.amount ELSE 0 END)      AS win_total
    FROM public.transactions t
    WHERE t.game_round_id IS NOT NULL
      AND t.type IN ('bet','win')
      AND t.created_at >= now() - (p_window_minutes || ' minutes')::interval
    GROUP BY t.user_id, t.game, t.game_round_id
    HAVING SUM(CASE WHEN t.type='win' THEN t.amount ELSE 0 END) >= p_min_win
       AND ( SUM(CASE WHEN t.type='win' THEN t.amount ELSE 0 END)
             - SUM(CASE WHEN t.type='bet' THEN ABS(t.amount) ELSE 0 END) ) >= p_min_net
  LOOP
    -- Skip if we've already notified for this round
    IF EXISTS (
      SELECT 1 FROM public.admin_notifications
      WHERE type = 'game_red_alert'
        AND meta->>'round_id' = v_row.game_round_id::text
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.admin_notifications (type, title, body, link, meta)
    SELECT
      'game_red_alert',
      'Pago grande en ' || upper(v_row.game),
      COALESCE(p.username, p.email, 'Usuario')
        || ' apostó $' || to_char(v_row.bet_total,'FM999G999G999')
        || ' y ganó $' || to_char(v_row.win_total,'FM999G999G999')
        || ' (neto +$' || to_char(v_row.win_total - v_row.bet_total,'FM999G999G999') || ')',
      '/adminpanel',
      jsonb_build_object(
        'kind', 'single_round',
        'round_id', v_row.game_round_id,
        'user_id', v_row.user_id,
        'username', p.username,
        'game', v_row.game,
        'bet', v_row.bet_total,
        'win', v_row.win_total,
        'net', v_row.win_total - v_row.bet_total,
        'multiplier', round((v_row.win_total / NULLIF(v_row.bet_total,0))::numeric, 2)
      )
    FROM public.profiles p
    WHERE p.id = v_row.user_id;

    v_inserted := v_inserted + 1;
  END LOOP;
  RETURN v_inserted;
END;
$$;

-- 3) Re-schedule cron: aggregate detector every 2 min, single-round every 1 min
DO $$
BEGIN
  PERFORM cron.unschedule('detect-games-in-red');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('detect-big-single-payouts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'detect-games-in-red',
  '*/2 * * * *',
  $cron$ SELECT public.detect_games_in_red(); $cron$
);

SELECT cron.schedule(
  'detect-big-single-payouts',
  '* * * * *',
  $cron$ SELECT public.detect_big_single_payouts(); $cron$
);
