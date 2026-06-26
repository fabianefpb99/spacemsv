CREATE OR REPLACE FUNCTION public.get_recent_public_wins(p_limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, username text, avatar_key text, game text, amount numeric, multiplier numeric, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT t.id, t.user_id, t.game, t.amount, t.meta, t.game_round_id, t.created_at
    FROM public.transactions t
    WHERE t.type = 'win'
      AND t.amount > 0
      AND t.created_at > now() - interval '3 minutes'
    ORDER BY t.created_at DESC
    LIMIT 200
  ),
  enriched AS (
    SELECT b.*,
           NULLIF((b.meta->>'multiplier'), '')::numeric AS meta_mult,
           NULLIF((b.meta->>'bet'), '')::numeric        AS meta_bet,
           NULLIF((b.meta->>'bet_tx_id'), '')::uuid     AS bet_tx_id
    FROM base b
  ),
  with_refs AS (
    SELECT e.*, bt.amount AS bet_tx_amount, gb.payout AS gb_payout, gb.amount AS gb_amount
    FROM enriched e
    LEFT JOIN public.transactions bt ON bt.id = e.bet_tx_id AND bt.type = 'bet'
    LEFT JOIN public.game_bets gb ON gb.round_id = e.game_round_id AND gb.user_id = e.user_id
  )
  SELECT w.user_id,
         COALESCE(p.username, 'Jugador') AS username,
         p.avatar_key,
         COALESCE(w.game, 'casino') AS game,
         w.amount,
         GREATEST(1.00, ROUND(COALESCE(
           CASE WHEN w.meta_mult IS NOT NULL AND w.meta_mult > 0 THEN w.meta_mult END,
           CASE WHEN w.meta_bet IS NOT NULL AND w.meta_bet > 0 THEN w.amount / w.meta_bet END,
           CASE WHEN w.bet_tx_amount IS NOT NULL AND ABS(w.bet_tx_amount) > 0 THEN w.amount / ABS(w.bet_tx_amount) END,
           CASE WHEN w.gb_payout IS NOT NULL AND w.gb_amount > 0 THEN w.gb_payout / w.gb_amount END,
           1.00), 2)) AS multiplier,
         w.created_at
  FROM with_refs w
  LEFT JOIN public.profiles p ON p.id = w.user_id
  ORDER BY w.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$function$;