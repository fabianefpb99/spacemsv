DROP FUNCTION IF EXISTS public.get_recent_public_wins(integer);

CREATE FUNCTION public.get_recent_public_wins(p_limit integer DEFAULT 20)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_key text,
  game text,
  amount numeric,
  multiplier numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.user_id,
         COALESCE(p.username, 'Jugador') AS username,
         p.avatar_key,
         COALESCE(t.game, 'casino') AS game,
         t.amount,
         COALESCE(ROUND(b.payout / NULLIF(b.amount, 0), 2), 1.00) AS multiplier,
         t.created_at
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.game_bets b
    ON b.round_id = t.game_round_id AND b.user_id = t.user_id
  WHERE t.type = 'win'
    AND t.amount > 0
    AND t.created_at > now() - interval '24 hours'
  ORDER BY t.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_public_wins(integer) TO anon, authenticated, service_role;