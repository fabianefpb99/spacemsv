
-- =========================================================================
-- FASE 0: Fundaciones para lógica de juego autoritativa en backend
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. transactions: idempotencia + trazabilidad de ronda/partida
-- -------------------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS client_action_id uuid,
  ADD COLUMN IF NOT EXISTS game_round_id uuid;

-- Índice único parcial: misma acción del cliente nunca se procesa 2 veces
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_client_action_uniq
  ON public.transactions (user_id, client_action_id)
  WHERE client_action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_user_created_idx
  ON public.transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_round_idx
  ON public.transactions (game_round_id)
  WHERE game_round_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 2. Enums de juego
-- -------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.game_round_status AS ENUM ('betting','running','crashed','settled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.game_bet_status AS ENUM ('active','cashed_out','lost','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.game_session_status AS ENUM ('open','won','lost','cashed_out','aborted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------------------------------------------------------------------------
-- 3. game_rounds (rondas globales — Spaceman)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game text NOT NULL,
  status public.game_round_status NOT NULL DEFAULT 'betting',
  crash_multiplier numeric(12,4),
  server_seed_hash text NOT NULL,
  server_seed text,                 -- se revela tras crash
  client_seed text,
  betting_ends_at timestamptz NOT NULL,
  started_at timestamptz,           -- inicio de fase running
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_rounds_game_status_idx
  ON public.game_rounds (game, status, created_at DESC);

-- Solo una ronda activa por juego (betting o running)
CREATE UNIQUE INDEX IF NOT EXISTS game_rounds_one_active_per_game
  ON public.game_rounds (game)
  WHERE status IN ('betting','running');

GRANT SELECT ON public.game_rounds TO authenticated;
GRANT ALL ON public.game_rounds TO service_role;

ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_rounds_select_all_authenticated"
  ON public.game_rounds FOR SELECT
  TO authenticated
  USING (true);

-- -------------------------------------------------------------------------
-- 4. game_bets (apuestas por ronda)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  cashout_multiplier numeric(12,4),
  payout numeric(14,2),
  status public.game_bet_status NOT NULL DEFAULT 'active',
  client_action_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  UNIQUE (round_id, user_id),
  UNIQUE (user_id, client_action_id)
);

CREATE INDEX IF NOT EXISTS game_bets_user_idx
  ON public.game_bets (user_id, created_at DESC);

GRANT SELECT ON public.game_bets TO authenticated;
GRANT ALL ON public.game_bets TO service_role;

ALTER TABLE public.game_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_bets_select_own"
  ON public.game_bets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "game_bets_admin_select_all"
  ON public.game_bets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 5. game_sessions (estado privado por jugador — Mines, Blackjack)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game text NOT NULL,
  status public.game_session_status NOT NULL DEFAULT 'open',
  bet_amount numeric(14,2) NOT NULL CHECK (bet_amount >= 0),
  payout numeric(14,2),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,        -- SECRETO
  public_state jsonb NOT NULL DEFAULT '{}'::jsonb, -- visible al jugador
  server_seed text NOT NULL,
  server_seed_hash text NOT NULL,
  client_seed text,
  nonce integer NOT NULL DEFAULT 0,
  client_action_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (user_id, client_action_id)
);

CREATE INDEX IF NOT EXISTS game_sessions_user_status_idx
  ON public.game_sessions (user_id, status, created_at DESC);

-- Una sola partida abierta por (usuario, juego)
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_one_open_per_user_game
  ON public.game_sessions (user_id, game)
  WHERE status = 'open';

-- Vista pública: NUNCA expone state ni server_seed mientras está abierta
CREATE OR REPLACE VIEW public.game_sessions_public
WITH (security_invoker = on) AS
SELECT
  id,
  user_id,
  game,
  status,
  bet_amount,
  payout,
  public_state,
  server_seed_hash,
  CASE WHEN status <> 'open' THEN server_seed ELSE NULL END AS server_seed,
  CASE WHEN status <> 'open' THEN state ELSE NULL END AS state_revealed,
  client_seed,
  nonce,
  created_at,
  closed_at
FROM public.game_sessions;

GRANT SELECT ON public.game_sessions_public TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Cliente NO puede leer state/server_seed directamente: debe usar la vista
-- o las server functions. Bloqueamos SELECT directo desde authenticated.
-- (service_role bypassa RLS para las server functions.)
CREATE POLICY "game_sessions_no_direct_select"
  ON public.game_sessions FOR SELECT
  TO authenticated
  USING (false);

-- -------------------------------------------------------------------------
-- 6. Función central de movimiento de saldo (única vía permitida)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_balance(
  p_user_id uuid,
  p_delta numeric,
  p_type public.transaction_type,
  p_game text DEFAULT NULL,
  p_game_round_id uuid DEFAULT NULL,
  p_client_action_id uuid DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  new_balance numeric,
  transaction_id uuid,
  was_duplicate boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_tx public.transactions%ROWTYPE;
  v_current_balance numeric;
  v_new_balance numeric;
  v_tx_id uuid;
BEGIN
  -- 1. Idempotencia: si la acción ya se procesó, devolver resultado anterior
  IF p_client_action_id IS NOT NULL THEN
    SELECT * INTO v_existing_tx
      FROM public.transactions
     WHERE user_id = p_user_id
       AND client_action_id = p_client_action_id
     LIMIT 1;

    IF FOUND THEN
      SELECT balance INTO v_current_balance
        FROM public.user_balances
       WHERE user_id = p_user_id;
      RETURN QUERY SELECT v_current_balance, v_existing_tx.id, true;
      RETURN;
    END IF;
  END IF;

  -- 2. Lock fila de balance (evita condiciones de carrera)
  SELECT balance INTO v_current_balance
    FROM public.user_balances
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'balance_row_missing' USING ERRCODE = 'P0002';
  END IF;

  v_new_balance := v_current_balance + p_delta;

  -- 3. Validar saldo no negativo
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Aplicar
  UPDATE public.user_balances
     SET balance = v_new_balance,
         updated_at = now()
   WHERE user_id = p_user_id;

  -- 5. Registrar movimiento
  INSERT INTO public.transactions (
    user_id, type, amount, balance_after, game, game_round_id,
    client_action_id, meta
  )
  VALUES (
    p_user_id, p_type, p_delta, v_new_balance, p_game, p_game_round_id,
    p_client_action_id, COALESCE(p_meta, '{}'::jsonb)
  )
  RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_new_balance, v_tx_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_balance(uuid, numeric, public.transaction_type, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_balance(uuid, numeric, public.transaction_type, text, uuid, uuid, jsonb) TO service_role;
