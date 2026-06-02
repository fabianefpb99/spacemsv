-- ============================================================
-- 1. Bonus de 100.000 a NUEVOS registros
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username text;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, v_username)
  ON CONFLICT (id) DO NOTHING;

  -- Bonus de bienvenida: 100.000 COP
  INSERT INTO public.user_balances (user_id, balance, bonus_balance)
  VALUES (NEW.id, 100000, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Registrar la transacción del bono para trazabilidad
  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
  VALUES (
    NEW.id,
    'deposit'::transaction_type,
    100000,
    100000,
    NULL,
    jsonb_build_object('kind', 'welcome_bonus', 'amount', 100000)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. SPACEMAN — motor de ronda global server-authoritative
-- ============================================================

-- Constantes de la curva:
--   multiplier(t_seconds) = exp(0.06 * t)
--   crash_duration_s     = ln(crash_mult) / 0.06
-- Fases:
--   betting  → 7s ventana de apuestas
--   running  → vuelo hasta crash_duration
--   crashed  → 3s de "revelado" y se crea la siguiente

-- 2.1 Calculadora pura del multiplicador en un instante dado
CREATE OR REPLACE FUNCTION public.spaceman_mult_at_ms(p_elapsed_ms numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT GREATEST(1.00, ROUND(EXP(0.06 * (p_elapsed_ms / 1000.0))::numeric, 2));
$$;

-- 2.2 Generador provably-fair del multiplicador de crash (3% house edge)
CREATE OR REPLACE FUNCTION public._spaceman_gen_crash(p_server_seed text)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash text;
  v_h    bigint;
  v_r    numeric;
  v_crash numeric;
BEGIN
  v_hash := encode(digest(p_server_seed, 'sha256'), 'hex');
  -- Tomamos los primeros 13 hex chars = 52 bits
  v_h := ('x' || substring(v_hash, 1, 13))::bit(52)::bigint;
  v_r := v_h::numeric / power(2::numeric, 52);  -- [0,1)
  -- 3% de rondas crashean en 1.00x (instant)
  IF v_r < 0.03 THEN
    RETURN 1.00;
  END IF;
  -- Distribución estándar Aviator con 97% RTP
  v_crash := FLOOR((0.97 / (1 - v_r)) * 100) / 100.0;
  RETURN GREATEST(1.00, LEAST(v_crash, 1000.00));
END;
$$;

-- 2.3 Orquestador: idempotente, llamable desde pg_cron cada 1s
CREATE OR REPLACE FUNCTION public.spaceman_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_round            public.game_rounds%ROWTYPE;
  v_now              timestamptz := now();
  v_crash_duration_s numeric;
  v_new_id           uuid;
  v_seed             text;
  v_seed_hash        text;
  v_crash            numeric;
BEGIN
  -- Buscar ronda activa (la última creada con status betting o running)
  SELECT * INTO v_round
    FROM public.game_rounds
   WHERE game = 'spaceman'
     AND status IN ('betting', 'running')
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    -- Transición betting → running
    IF v_round.status = 'betting' AND v_now >= v_round.betting_ends_at THEN
      UPDATE public.game_rounds
         SET status = 'running',
             started_at = v_round.betting_ends_at  -- determinístico
       WHERE id = v_round.id;
      RETURN jsonb_build_object('action', 'start_flight', 'round_id', v_round.id);
    END IF;

    -- Transición running → crashed
    IF v_round.status = 'running' THEN
      v_crash_duration_s := LN(v_round.crash_multiplier) / 0.06;
      IF v_now >= v_round.started_at + (v_crash_duration_s || ' seconds')::interval THEN
        UPDATE public.game_rounds
           SET status = 'crashed',
               ended_at = v_round.started_at + (v_crash_duration_s || ' seconds')::interval,
               server_seed = v_round.server_seed  -- ya estaba seteado al crear
         WHERE id = v_round.id;

        -- Liquidar apuestas no cobradas como perdidas
        UPDATE public.game_bets
           SET status = 'lost',
               payout = 0,
               settled_at = v_now
         WHERE round_id = v_round.id
           AND status = 'active';

        RETURN jsonb_build_object('action', 'crash', 'round_id', v_round.id, 'crash', v_round.crash_multiplier);
      END IF;
    END IF;

    -- Ronda activa pero sin transición todavía
    RETURN jsonb_build_object('action', 'noop', 'round_id', v_round.id, 'status', v_round.status);
  END IF;

  -- No hay ronda activa: revisar si la última crashed ya cumplió los 3s de "reveal"
  SELECT * INTO v_round
    FROM public.game_rounds
   WHERE game = 'spaceman'
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND AND v_round.status = 'crashed' AND v_now < v_round.ended_at + interval '3 seconds' THEN
    RETURN jsonb_build_object('action', 'reveal_wait', 'round_id', v_round.id);
  END IF;

  -- Crear nueva ronda
  v_seed := encode(gen_random_bytes(32), 'hex');
  v_seed_hash := encode(digest(v_seed, 'sha256'), 'hex');
  v_crash := public._spaceman_gen_crash(v_seed);

  INSERT INTO public.game_rounds (
    game, status, server_seed, server_seed_hash,
    betting_ends_at, crash_multiplier
  ) VALUES (
    'spaceman',
    'betting',
    v_seed,
    v_seed_hash,
    v_now + interval '7 seconds',
    v_crash
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('action', 'new_round', 'round_id', v_new_id, 'crash', v_crash);
END;
$$;

-- 2.4 Ronda actual visible al cliente (oculta server_seed mientras corre)
CREATE OR REPLACE FUNCTION public.spaceman_current_round()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_round public.game_rounds%ROWTYPE;
BEGIN
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
    -- Solo revelamos seed y crash cuando ya terminó
    'server_seed',      CASE WHEN v_round.status = 'crashed' THEN v_round.server_seed ELSE NULL END,
    'crash_multiplier', CASE WHEN v_round.status = 'crashed' THEN v_round.crash_multiplier ELSE NULL END,
    'server_now',       now()
  );
END;
$$;

-- 2.5 Colocar apuesta (solo en fase betting)
CREATE OR REPLACE FUNCTION public.spaceman_place_bet(
  p_round_id          uuid,
  p_amount            numeric,
  p_client_action_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_round            public.game_rounds%ROWTYPE;
  v_existing_bet     public.game_bets%ROWTYPE;
  v_current_balance  numeric;
  v_new_balance      numeric;
  v_bet_id           uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotencia
  SELECT * INTO v_existing_bet
    FROM public.game_bets
   WHERE user_id = v_user_id
     AND client_action_id = p_client_action_id
   LIMIT 1;
  IF FOUND THEN
    SELECT balance INTO v_current_balance FROM public.user_balances WHERE user_id = v_user_id;
    RETURN jsonb_build_object(
      'was_duplicate', true,
      'bet_id',        v_existing_bet.id,
      'new_balance',   v_current_balance
    );
  END IF;

  IF p_amount IS NULL OR p_amount < 500 OR p_amount > 100000 OR (p_amount::numeric % 500) <> 0 THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;

  -- Validar ronda en betting y a tiempo
  SELECT * INTO v_round FROM public.game_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_round.status <> 'betting' OR now() >= v_round.betting_ends_at THEN
    RAISE EXCEPTION 'betting_closed' USING ERRCODE = 'P0001';
  END IF;

  -- Una sola apuesta por ronda por usuario
  IF EXISTS (SELECT 1 FROM public.game_bets WHERE round_id = p_round_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'already_bet_this_round' USING ERRCODE = 'P0001';
  END IF;

  -- Lock + debit
  SELECT balance INTO v_current_balance
    FROM public.user_balances WHERE user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'balance_row_missing' USING ERRCODE = 'P0002';
  END IF;
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;
  v_new_balance := v_current_balance - p_amount;
  UPDATE public.user_balances SET balance = v_new_balance, updated_at = now() WHERE user_id = v_user_id;

  -- Insertar apuesta
  INSERT INTO public.game_bets (round_id, user_id, amount, status, client_action_id)
  VALUES (p_round_id, v_user_id, p_amount, 'active', p_client_action_id)
  RETURNING id INTO v_bet_id;

  -- Transacción
  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, game_round_id, client_action_id, meta)
  VALUES (v_user_id, 'bet'::transaction_type, -p_amount, v_new_balance, 'spaceman', p_round_id, p_client_action_id,
          jsonb_build_object('kind', 'spaceman_bet', 'bet_id', v_bet_id));

  RETURN jsonb_build_object(
    'was_duplicate', false,
    'bet_id',        v_bet_id,
    'new_balance',   v_new_balance
  );
END;
$$;

-- 2.6 Cashout — el cliente envía SU elapsed_ms; el servidor lo valida y paga ese multiplicador
CREATE OR REPLACE FUNCTION public.spaceman_cashout(
  p_round_id          uuid,
  p_client_action_id  uuid,
  p_client_elapsed_ms numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_round            public.game_rounds%ROWTYPE;
  v_bet              public.game_bets%ROWTYPE;
  v_current_balance  numeric;
  v_new_balance      numeric;
  v_server_elapsed_ms numeric;
  v_crash_elapsed_ms  numeric;
  v_effective_ms     numeric;
  v_mult             numeric;
  v_payout           numeric;
  v_grace_ms         numeric := 500;  -- margen para compensar RTT
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotencia: si ya hicimos cashout de esta acción, devolver lo registrado
  SELECT * INTO v_bet
    FROM public.game_bets
   WHERE round_id = p_round_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bet_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_bet.status = 'cashed_out' THEN
    SELECT balance INTO v_current_balance FROM public.user_balances WHERE user_id = v_user_id;
    RETURN jsonb_build_object(
      'was_duplicate',      true,
      'cashout_multiplier', v_bet.cashout_multiplier,
      'payout',             v_bet.payout,
      'new_balance',        v_current_balance
    );
  END IF;
  IF v_bet.status = 'lost' THEN
    RAISE EXCEPTION 'already_lost' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_round FROM public.game_rounds WHERE id = p_round_id FOR UPDATE;
  IF v_round.status <> 'running' THEN
    -- Si ya crasheó antes de que llegara este request, perdió
    IF v_round.status = 'crashed' THEN
      UPDATE public.game_bets SET status = 'lost', payout = 0, settled_at = now() WHERE id = v_bet.id;
      RAISE EXCEPTION 'crashed_before_cashout' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'not_running' USING ERRCODE = 'P0001';
  END IF;

  -- Tiempos
  v_server_elapsed_ms := EXTRACT(EPOCH FROM (now() - v_round.started_at)) * 1000;
  v_crash_elapsed_ms  := (LN(v_round.crash_multiplier) / 0.06) * 1000;

  -- Validación: el cliente no puede pedir un cashout en el futuro (más allá de su tiempo real + gracia)
  IF p_client_elapsed_ms IS NULL OR p_client_elapsed_ms < 0 THEN
    p_client_elapsed_ms := v_server_elapsed_ms;
  END IF;
  IF p_client_elapsed_ms > v_server_elapsed_ms + v_grace_ms THEN
    -- Cliente "del futuro", lo capamos al ahora servidor
    v_effective_ms := v_server_elapsed_ms;
  ELSE
    v_effective_ms := p_client_elapsed_ms;
  END IF;

  -- No puede pasar del crash
  IF v_effective_ms >= v_crash_elapsed_ms THEN
    UPDATE public.game_bets SET status = 'lost', payout = 0, settled_at = now() WHERE id = v_bet.id;
    RAISE EXCEPTION 'crashed_before_cashout' USING ERRCODE = 'P0001';
  END IF;

  v_mult   := public.spaceman_mult_at_ms(v_effective_ms);
  v_payout := ROUND(v_bet.amount * v_mult);

  -- Acreditar
  SELECT balance INTO v_current_balance FROM public.user_balances WHERE user_id = v_user_id FOR UPDATE;
  v_new_balance := v_current_balance + v_payout;
  UPDATE public.user_balances SET balance = v_new_balance, updated_at = now() WHERE user_id = v_user_id;

  UPDATE public.game_bets
     SET status = 'cashed_out',
         cashout_multiplier = v_mult,
         payout = v_payout,
         settled_at = now()
   WHERE id = v_bet.id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, game_round_id, client_action_id, meta)
  VALUES (v_user_id, 'win'::transaction_type, v_payout, v_new_balance, 'spaceman', p_round_id, p_client_action_id,
          jsonb_build_object(
            'kind', 'spaceman_cashout',
            'bet_id', v_bet.id,
            'multiplier', v_mult,
            'client_elapsed_ms', p_client_elapsed_ms,
            'server_elapsed_ms', v_server_elapsed_ms,
            'effective_ms', v_effective_ms
          ));

  RETURN jsonb_build_object(
    'was_duplicate',      false,
    'cashout_multiplier', v_mult,
    'payout',             v_payout,
    'new_balance',        v_new_balance
  );
END;
$$;

-- 2.7 Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.spaceman_current_round() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.spaceman_place_bet(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spaceman_cashout(uuid, uuid, numeric) TO authenticated;
-- spaceman_tick no se expone — solo lo invoca pg_cron como superuser

-- 2.8 Realtime: que los clientes vean los cambios de fase
ALTER TABLE public.game_rounds REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_rounds'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds';
  END IF;
END $$;

-- 2.9 Cron: avanzar el motor cada 1 segundo
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Limpiar job anterior si existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'spaceman-tick') THEN
    PERFORM cron.unschedule('spaceman-tick');
  END IF;
END $$;

SELECT cron.schedule('spaceman-tick', '1 seconds', $$SELECT public.spaceman_tick();$$);

-- 2.10 Sembrar primera ronda inmediatamente para no esperar al cron
SELECT public.spaceman_tick();