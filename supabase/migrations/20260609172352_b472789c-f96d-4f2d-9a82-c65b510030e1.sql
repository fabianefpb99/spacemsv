
CREATE OR REPLACE FUNCTION public.get_today_top_winners(p_limit int DEFAULT 10)
RETURNS TABLE (user_id uuid, username text, avatar_key text, net_amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH today_tx AS (
    SELECT user_id,
           SUM(CASE WHEN type = 'win' THEN amount ELSE 0 END) AS wins,
           SUM(CASE WHEN type = 'bet' THEN amount ELSE 0 END) AS bets
    FROM public.transactions
    WHERE created_at >= date_trunc('day', now()) AND type IN ('win','bet')
    GROUP BY user_id
  )
  SELECT t.user_id,
         COALESCE(p.username, 'Jugador') AS username,
         p.avatar_key,
         (t.wins - t.bets) AS net_amount
  FROM today_tx t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  WHERE (t.wins - t.bets) > 0
  ORDER BY net_amount DESC
  LIMIT GREATEST(p_limit, 1);
$$;
REVOKE ALL ON FUNCTION public.get_today_top_winners(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_today_top_winners(int) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_today_top_arena(p_limit int DEFAULT 10)
RETURNS TABLE (user_id uuid, username text, avatar_key text, net_amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH today_arena AS (
    SELECT user_id, SUM(payout) - SUM(bet_amount) AS net
    FROM public.arena_rounds
    WHERE created_at >= date_trunc('day', now())
    GROUP BY user_id
  )
  SELECT a.user_id,
         COALESCE(p.username, 'Jugador') AS username,
         p.avatar_key,
         a.net AS net_amount
  FROM today_arena a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.net > 0
  ORDER BY a.net DESC
  LIMIT GREATEST(p_limit, 1);
$$;
REVOKE ALL ON FUNCTION public.get_today_top_arena(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_today_top_arena(int) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_today_position()
RETURNS TABLE (rank int, net_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH today_tx AS (
    SELECT user_id,
           SUM(CASE WHEN type = 'win' THEN amount ELSE 0 END)
         - SUM(CASE WHEN type = 'bet' THEN amount ELSE 0 END) AS net
    FROM public.transactions
    WHERE created_at >= date_trunc('day', now()) AND type IN ('win','bet')
    GROUP BY user_id
  ),
  ranked AS (
    SELECT user_id, net, RANK() OVER (ORDER BY net DESC) AS r
    FROM today_tx WHERE net > 0
  )
  SELECT r.r::int AS rank, r.net AS net_amount
  FROM ranked r WHERE r.user_id = v_uid;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_today_position() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_today_position() TO authenticated, service_role;
