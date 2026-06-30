-- Boost Mode: tabla de sesiones + helpers + función de limpieza

CREATE TABLE public.boost_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES auth.users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_by uuid REFERENCES auth.users(id),
  rtp_value numeric NOT NULL DEFAULT 99.1,
  excluded_games text[] NOT NULL DEFAULT ARRAY['spaceman']::text[],
  cleanup_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Solo una sesión activa a la vez
CREATE UNIQUE INDEX boost_sessions_one_active
  ON public.boost_sessions ((1)) WHERE ended_at IS NULL;

CREATE INDEX boost_sessions_target ON public.boost_sessions (target_user_id, started_at);

GRANT SELECT ON public.boost_sessions TO authenticated;
GRANT ALL ON public.boost_sessions TO service_role;

ALTER TABLE public.boost_sessions ENABLE ROW LEVEL SECURITY;

-- Solo admins ven la tabla. Usuarios normales no se enteran de su existencia.
CREATE POLICY "admins read boost_sessions"
  ON public.boost_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Helper: es esta cuenta el target del boost activo?
-- Usada por server fns para decidir si forzar resultado favorable.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_boost_target(p_user_id uuid, p_game text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boost_sessions
    WHERE ended_at IS NULL
      AND target_user_id = p_user_id
      AND (p_game IS NULL OR NOT (p_game = ANY(excluded_games)))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_boost_target(uuid, text) TO authenticated, service_role;

-- ============================================================
-- Admin RPC: arrancar sesión de boost
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_start_boost(p_target_user_id uuid, p_rtp numeric DEFAULT 99.1)
RETURNS public.boost_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.boost_sessions;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_target' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_user_id = v_admin THEN
    RAISE EXCEPTION 'cannot_boost_self' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.boost_sessions WHERE ended_at IS NULL) THEN
    RAISE EXCEPTION 'boost_already_active' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.boost_sessions (target_user_id, started_by, rtp_value)
  VALUES (p_target_user_id, v_admin, COALESCE(p_rtp, 99.1))
  RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'boost_start', p_target_user_id,
          jsonb_build_object('session_id', v_row.id, 'rtp', v_row.rtp_value));

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_start_boost(uuid, numeric) TO authenticated;

-- ============================================================
-- Admin RPC: apagar boost + limpieza quirúrgica
-- Borra SOLO datos del target dentro de la ventana exacta.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_stop_boost(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.boost_sessions;
  v_end timestamptz := now();
  v_tx int := 0;
  v_rounds int := 0;
  v_bets int := 0;
  v_arena int := 0;
  v_missions int := 0;
  v_sessions int := 0;
  v_balance_before numeric;
  v_bonus_before numeric;
  v_xp_before bigint;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.boost_sessions
   WHERE ended_at IS NULL FOR UPDATE LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_boost' USING ERRCODE = 'P0001';
  END IF;

  -- Conteo dry-run para mostrar al admin antes de borrar
  SELECT COUNT(*) INTO v_tx FROM public.transactions
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  SELECT COUNT(*) INTO v_bets FROM public.game_bets
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  SELECT COUNT(*) INTO v_rounds FROM public.game_rounds
   WHERE created_at >= v_row.started_at
     AND id IN (SELECT round_id FROM public.game_bets
                 WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at);
  SELECT COUNT(*) INTO v_arena FROM public.arena_rounds
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  SELECT COUNT(*) INTO v_missions FROM public.user_missions
   WHERE user_id = v_row.target_user_id
     AND (created_at >= v_row.started_at OR updated_at >= v_row.started_at);
  SELECT COUNT(*) INTO v_sessions FROM public.game_sessions
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;

  SELECT balance, bonus_balance INTO v_balance_before, v_bonus_before
    FROM public.user_balances WHERE user_id = v_row.target_user_id;
  SELECT total_xp INTO v_xp_before
    FROM public.user_vip WHERE user_id = v_row.target_user_id;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'session_id', v_row.id,
      'target_user_id', v_row.target_user_id,
      'started_at', v_row.started_at,
      'would_delete', jsonb_build_object(
        'transactions', v_tx,
        'game_bets', v_bets,
        'game_rounds_user_only', v_rounds,
        'arena_rounds', v_arena,
        'user_missions', v_missions,
        'game_sessions', v_sessions
      ),
      'will_reset_balance_from', jsonb_build_object('real', v_balance_before, 'bonus', v_bonus_before),
      'will_reset_xp_from', v_xp_before
    );
  END IF;

  -- BORRADO QUIRÚRGICO (solo del target, en la ventana exacta)
  DELETE FROM public.transactions
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  DELETE FROM public.game_bets
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  DELETE FROM public.arena_rounds
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  DELETE FROM public.user_missions
   WHERE user_id = v_row.target_user_id
     AND (created_at >= v_row.started_at OR updated_at >= v_row.started_at);
  DELETE FROM public.game_sessions
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;
  -- game_rounds compartidos (spaceman) NO se borran. Solo rondas con bets exclusivos del target ya quedaron sin referencias.

  -- Reset saldo + VIP del target (cuenta desechable, no afecta a nadie más)
  UPDATE public.user_balances
     SET balance = 0, bonus_balance = 0, updated_at = now()
   WHERE user_id = v_row.target_user_id;
  UPDATE public.user_vip
     SET total_xp = 0, current_level = 0, updated_at = now()
   WHERE user_id = v_row.target_user_id;
  DELETE FROM public.user_vip_rewards
   WHERE user_id = v_row.target_user_id AND created_at >= v_row.started_at;

  UPDATE public.boost_sessions
     SET ended_at = v_end,
         ended_by = v_admin,
         cleanup_summary = jsonb_build_object(
           'transactions', v_tx,
           'game_bets', v_bets,
           'arena_rounds', v_arena,
           'user_missions', v_missions,
           'game_sessions', v_sessions,
           'reset_balance_from', jsonb_build_object('real', v_balance_before, 'bonus', v_bonus_before),
           'reset_xp_from', v_xp_before
         )
   WHERE id = v_row.id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'boost_stop', v_row.target_user_id,
          jsonb_build_object('session_id', v_row.id, 'summary',
            jsonb_build_object('transactions', v_tx, 'bets', v_bets,
                               'arena', v_arena, 'missions', v_missions, 'sessions', v_sessions)));

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_row.id,
    'cleaned', jsonb_build_object(
      'transactions', v_tx,
      'game_bets', v_bets,
      'arena_rounds', v_arena,
      'user_missions', v_missions,
      'game_sessions', v_sessions
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_stop_boost(boolean) TO authenticated;

-- ============================================================
-- Auto-off: cierra y limpia sesiones > 6h sin tocar admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.boost_autoclose_expired()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.boost_sessions;
  v_summary jsonb := '{}'::jsonb;
BEGIN
  -- Solo callable por admin
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_row FROM public.boost_sessions
   WHERE ended_at IS NULL AND started_at < now() - interval '6 hours'
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('closed', false);
  END IF;
  -- Llama al stop como si lo hubiera apagado el admin actual
  v_summary := public.admin_stop_boost(false);
  RETURN jsonb_build_object('closed', true, 'auto', true, 'summary', v_summary);
END;
$$;

GRANT EXECUTE ON FUNCTION public.boost_autoclose_expired() TO authenticated;

-- ============================================================
-- Guard: Spaceman rechaza apuestas si el user está boosteado.
-- Modificamos spaceman_place_bet añadiendo el check al inicio.
-- ============================================================
CREATE OR REPLACE FUNCTION public.spaceman_place_bet(p_round_id uuid, p_amount numeric, p_client_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id          uuid := auth.uid();
  v_round            public.game_rounds%ROWTYPE;
  v_existing_bet     public.game_bets%ROWTYPE;
  v_current_balance  numeric;
  v_new_balance      numeric;
  v_new_bonus        numeric;
  v_from_bonus       numeric;
  v_from_real        numeric;
  v_bet_id           uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- Boost mode: Spaceman está excluido del modo boost (juego global).
  IF public.is_boost_target(v_user_id, 'spaceman') THEN
    RAISE EXCEPTION 'spaceman_disabled_for_boost' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing_bet
    FROM public.game_bets
   WHERE user_id = v_user_id AND client_action_id = p_client_action_id
   LIMIT 1;
  IF FOUND THEN
    SELECT balance INTO v_current_balance FROM public.user_balances WHERE user_id = v_user_id;
    RETURN jsonb_build_object(
      'was_duplicate', true,
      'bet_id',        v_existing_bet.id,
      'new_balance',   v_current_balance
    );
  END IF;

  IF p_amount IS NULL OR p_amount < 500 OR p_amount > 50000 OR (p_amount::numeric % 500) <> 0 THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_round FROM public.game_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_round.status <> 'betting' OR now() >= v_round.betting_ends_at THEN
    RAISE EXCEPTION 'betting_closed' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.game_bets WHERE round_id = p_round_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'already_bet_this_round' USING ERRCODE = 'P0001';
  END IF;

  SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
    INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
    FROM public._debit_bet(v_user_id, p_amount) db;

  INSERT INTO public.game_bets (round_id, user_id, amount, status, client_action_id)
  VALUES (p_round_id, v_user_id, p_amount, 'active', p_client_action_id)
  RETURNING id INTO v_bet_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, game_round_id, client_action_id, meta)
  VALUES (v_user_id, 'bet'::transaction_type, -p_amount, v_new_balance, 'spaceman', p_round_id, p_client_action_id,
          jsonb_build_object('kind', 'spaceman_bet', 'bet_id', v_bet_id,
                             'from_bonus', v_from_bonus, 'from_real', v_from_real));

  RETURN jsonb_build_object(
    'was_duplicate', false,
    'bet_id',        v_bet_id,
    'new_balance',   v_new_balance
  );
END;
$function$;

-- ============================================================
-- Slot RPC: añadir boost forcing
-- Cuando el user es target, si total = 0 (loss), después del spin
-- normal forzamos un retorno positivo via crédito extra y resultado modificado.
-- Patch mínimo: solo añadimos chequeo de boost al inicio del spin
-- y, si está boosteado y resulta loss, re-rolleamos hasta 12 veces
-- internamente. Las apuestas extra se contabilizan pero serán borradas
-- por cleanup.
-- ============================================================
-- (No modificamos spin_slot_v1 ni spin_roulette_v1 en SQL para no romper
-- nada — el boost para esos juegos se hará desde TS llamando al RPC
-- en bucle hasta obtener un win, refundando bets intermedios.)
