CREATE OR REPLACE FUNCTION public.admin_bet_insights(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  WITH b AS (
    SELECT user_id, game, abs(amount) AS amt, created_at
    FROM public.transactions
    WHERE type = 'bet'
      AND created_at >= p_from
      AND created_at <= p_to
  ),
  summary AS (
    SELECT
      count(*)::bigint                                              AS bet_count,
      count(DISTINCT user_id)::bigint                               AS players,
      coalesce(sum(amt), 0)                                         AS handle,
      coalesce(round(avg(amt)), 0)                                  AS avg_bet,
      coalesce(round(percentile_cont(0.5) WITHIN GROUP (ORDER BY amt)), 0) AS median_bet,
      coalesce(min(amt), 0)                                         AS min_bet,
      coalesce(max(amt), 0)                                         AS max_bet
    FROM b
  ),
  top_amounts AS (
    SELECT amt, count(*)::bigint AS uses, sum(amt) AS wagered
    FROM b GROUP BY amt ORDER BY count(*) DESC, amt DESC LIMIT 8
  ),
  buckets AS (
    SELECT bucket, count(*)::bigint AS uses, sum(amt) AS wagered
    FROM (
      SELECT CASE
        WHEN amt < 1000 THEN '0-999'
        WHEN amt < 5000 THEN '1k-5k'
        WHEN amt < 10000 THEN '5k-10k'
        WHEN amt < 25000 THEN '10k-25k'
        WHEN amt < 50000 THEN '25k-50k'
        WHEN amt < 100000 THEN '50k-100k'
        ELSE '100k+' END AS bucket, amt
      FROM b
    ) x GROUP BY bucket
  ),
  hours AS (
    SELECT extract(hour FROM created_at AT TIME ZONE 'America/Bogota')::int AS hour,
           count(*)::bigint AS uses, sum(amt) AS wagered
    FROM b GROUP BY 1 ORDER BY count(*) DESC LIMIT 5
  ),
  per_game AS (
    SELECT game,
           mode() WITHIN GROUP (ORDER BY amt) AS common_bet,
           coalesce(round(avg(amt)), 0) AS avg_bet,
           count(*)::bigint AS bet_count,
           count(DISTINCT user_id)::bigint AS players
    FROM b WHERE game IS NOT NULL GROUP BY game ORDER BY count(*) DESC
  ),
  per_player AS (
    SELECT coalesce(round(avg(cnt)), 0) AS bets_per_player,
           coalesce(round(avg(total)), 0) AS wagered_per_player
    FROM (SELECT user_id, count(*) AS cnt, sum(amt) AS total FROM b GROUP BY user_id) p
  )
  SELECT jsonb_build_object(
    'summary', (SELECT to_jsonb(s) FROM summary s) || (SELECT to_jsonb(p) FROM per_player p),
    'topAmounts', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM top_amounts t), '[]'::jsonb),
    'buckets', coalesce((SELECT jsonb_agg(to_jsonb(k)) FROM buckets k), '[]'::jsonb),
    'peakHours', coalesce((SELECT jsonb_agg(to_jsonb(h)) FROM hours h), '[]'::jsonb),
    'perGame', coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM per_game g), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bet_insights(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_bet_insights(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bet_insights(timestamptz, timestamptz) TO service_role;