-- ============================================================
-- BONUS-FIRST balance logic
-- Apuestas: debitan primero de bonus_balance, luego de balance
-- Ganancias: 100% a balance (real). bonus_balance no se regenera.
-- ============================================================

-- ----------------------------------------------------------------
-- Helper interno: débito atómico de una apuesta (bonus-first)
-- Devuelve la composición del débito para auditoría
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._debit_bet(p_user_id uuid, p_amount numeric)
RETURNS TABLE(new_balance numeric, new_bonus numeric, from_bonus numeric, from_real numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_bonus   numeric;
  v_from_bonus numeric;
  v_from_real  numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001';
  END IF;

  SELECT balance, bonus_balance INTO v_balance, v_bonus
    FROM public.user_balances
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'balance_row_missing' USING ERRCODE = 'P0002';
  END IF;

  IF (COALESCE(v_balance,0) + COALESCE(v_bonus,0)) < p_amount THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  v_from_bonus := LEAST(COALESCE(v_bonus,0), p_amount);
  v_from_real  := p_amount - v_from_bonus;

  v_bonus   := COALESCE(v_bonus,0)   - v_from_bonus;
  v_balance := COALESCE(v_balance,0) - v_from_real;

  UPDATE public.user_balances
     SET balance = v_balance,
         bonus_balance = v_bonus,
         updated_at = now()
   WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_balance, v_bonus, v_from_bonus, v_from_real;
END;
$$;

-- ----------------------------------------------------------------
-- Helper interno: acreditar ganancia (siempre a balance real)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._credit_win(p_user_id uuid, p_amount numeric)
RETURNS TABLE(new_balance numeric, new_bonus numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_bonus   numeric;
BEGIN
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001';
  END IF;

  SELECT balance, bonus_balance INTO v_balance, v_bonus
    FROM public.user_balances
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'balance_row_missing' USING ERRCODE = 'P0002';
  END IF;

  v_balance := COALESCE(v_balance,0) + p_amount;

  UPDATE public.user_balances
     SET balance = v_balance,
         updated_at = now()
   WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_balance, COALESCE(v_bonus,0);
END;
$$;

-- ----------------------------------------------------------------
-- adjust_balance: ahora consciente del bono
--   - type='bet' (delta < 0): débito bonus-first vía _debit_bet
--   - type='win' (delta > 0): crédito a real vía _credit_win
--   - otros (deposit/withdrawal/adjustment/bonus): comportamiento previo
--     (modifica balance real directamente — usar p_meta.target='bonus' para
--      depositar al bono explícitamente, ej. recargas con promo)
-- Mantiene firma e idempotencia anteriores.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_balance(
  p_user_id uuid,
  p_delta numeric,
  p_type transaction_type,
  p_game text DEFAULT NULL,
  p_game_round_id uuid DEFAULT NULL,
  p_client_action_id uuid DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(new_balance numeric, transaction_id uuid, was_duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_tx public.transactions%ROWTYPE;
  v_current_balance numeric;
  v_current_bonus   numeric;
  v_new_balance numeric;
  v_new_bonus   numeric;
  v_from_bonus  numeric := 0;
  v_from_real   numeric := 0;
  v_tx_id uuid;
  v_meta jsonb;
  v_target text;
BEGIN
  -- 1. Idempotencia
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

  v_meta := COALESCE(p_meta, '{}'::jsonb);

  -- 2. Ruteo según tipo
  IF p_type = 'bet'::transaction_type THEN
    -- Apuesta: delta debe ser negativo
    IF p_delta >= 0 THEN
      RAISE EXCEPTION 'bet_delta_must_be_negative' USING ERRCODE = 'P0001';
    END IF;
    SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
      INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
      FROM public._debit_bet(p_user_id, -p_delta) db;
    v_meta := v_meta || jsonb_build_object('from_bonus', v_from_bonus, 'from_real', v_from_real);

  ELSIF p_type = 'win'::transaction_type THEN
    IF p_delta < 0 THEN
      RAISE EXCEPTION 'win_delta_must_be_positive' USING ERRCODE = 'P0001';
    END IF;
    SELECT cw.new_balance, cw.new_bonus INTO v_new_balance, v_new_bonus
      FROM public._credit_win(p_user_id, p_delta) cw;
    v_meta := v_meta || jsonb_build_object('to_real', p_delta);

  ELSE
    -- deposit / withdrawal / adjustment / bonus
    -- Permite acreditar al bono explícitamente con p_meta->>'target' = 'bonus'
    v_target := COALESCE(v_meta->>'target', 'real');

    SELECT balance, bonus_balance INTO v_current_balance, v_current_bonus
      FROM public.user_balances WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'balance_row_missing' USING ERRCODE = 'P0002';
    END IF;

    IF v_target = 'bonus' THEN
      v_new_bonus := COALESCE(v_current_bonus,0) + p_delta;
      IF v_new_bonus < 0 THEN
        RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
      END IF;
      v_new_balance := COALESCE(v_current_balance,0);
      UPDATE public.user_balances
         SET bonus_balance = v_new_bonus, updated_at = now()
       WHERE user_id = p_user_id;
    ELSE
      v_new_balance := COALESCE(v_current_balance,0) + p_delta;
      IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
      END IF;
      v_new_bonus := COALESCE(v_current_bonus,0);
      UPDATE public.user_balances
         SET balance = v_new_balance, updated_at = now()
       WHERE user_id = p_user_id;
    END IF;
  END IF;

  -- 3. Registrar transacción
  INSERT INTO public.transactions (
    user_id, type, amount, balance_after, game, game_round_id,
    client_action_id, meta
  ) VALUES (
    p_user_id, p_type, p_delta, v_new_balance, p_game, p_game_round_id,
    p_client_action_id, v_meta
  ) RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_new_balance, v_tx_id, false;
END;
$$;

-- ----------------------------------------------------------------
-- spin_slot_v1 — usa _debit_bet y _credit_win
-- (resto de la lógica de RNG / paylines intacta)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spin_slot_v1(p_user_id uuid, p_bet_amount numeric, p_client_action_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_symbol_ids     text[] := ARRAY['boss','car','brief','gold','watch','chip','hat','card'];
  v_symbol_weights int[]  := ARRAY[2,3,4,5,6,8,10,12];
  v_pay3           int[]  := ARRAY[55,34,24,19,13,10,8,7];
  v_pay4           int[]  := ARRAY[240,130,72,50,32,24,18,14];
  v_pay5           int[]  := ARRAY[1100,440,240,165,95,68,50,32];
  v_total_weight   int    := 50;
  v_reels          int    := 5;
  v_rows           int    := 4;
  v_line_count     int    := 25;
  v_min_bet        numeric := 500;
  v_max_bet        numeric := 100000;
  v_bet_step       numeric := 500;
  v_paylines       int[][] := ARRAY[
    ARRAY[1,1,1,1,1],ARRAY[2,2,2,2,2],ARRAY[0,0,0,0,0],ARRAY[3,3,3,3,3],
    ARRAY[0,1,2,1,0],ARRAY[3,2,1,2,3],ARRAY[1,2,3,2,1],ARRAY[2,1,0,1,2],
    ARRAY[0,0,1,2,2],ARRAY[3,3,2,1,1],ARRAY[1,0,0,0,1],ARRAY[2,3,3,3,2],
    ARRAY[0,1,1,1,0],ARRAY[3,2,2,2,3],ARRAY[1,2,1,2,1],ARRAY[2,1,2,1,2],
    ARRAY[0,1,2,3,3],ARRAY[3,2,1,0,0],ARRAY[1,1,2,3,3],ARRAY[2,2,1,0,0],
    ARRAY[0,2,0,2,0],ARRAY[3,1,3,1,3],ARRAY[1,0,1,0,1],ARRAY[2,3,2,3,2],
    ARRAY[0,3,0,3,0]
  ];

  v_existing_tx     public.transactions%ROWTYPE;
  v_current_balance numeric;
  v_new_balance     numeric;
  v_new_bonus       numeric;
  v_from_bonus      numeric;
  v_from_real       numeric;
  v_line_bet        int;
  v_server_seed     text;
  v_server_seed_hash text;
  v_bet_tx_id       uuid;
  v_grid            int[][];
  v_grid_jsonb      jsonb;
  v_reel_jsonb      jsonb;
  v_wins            jsonb := '[]'::jsonb;
  v_cells           jsonb;
  v_total           int := 0;
  v_byte            int;
  v_pick            int;
  v_acc             int;
  v_first           int;
  v_last            int;
  v_cnt             int;
  v_payout          int;
  i int; j int; k int;
BEGIN
  -- Idempotencia
  SELECT * INTO v_existing_tx
    FROM public.transactions
   WHERE user_id = p_user_id AND client_action_id = p_client_action_id
   LIMIT 1;

  IF FOUND THEN
    SELECT balance INTO v_current_balance
      FROM public.user_balances WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'was_duplicate', true,
      'new_balance',   v_current_balance,
      'cached',        COALESCE(v_existing_tx.meta -> 'result', '{}'::jsonb)
    );
  END IF;

  IF p_bet_amount IS NULL
     OR p_bet_amount < v_min_bet
     OR p_bet_amount > v_max_bet
     OR (p_bet_amount::numeric % v_bet_step) <> 0 THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;
  v_line_bet := GREATEST(1, FLOOR(p_bet_amount / v_line_count)::int);

  -- Provably-fair
  v_server_seed      := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

  -- Grid
  v_grid := array_fill(0, ARRAY[v_reels, v_rows]);
  FOR i IN 1..v_reels LOOP
    FOR j IN 1..v_rows LOOP
      LOOP
        v_byte := get_byte(gen_random_bytes(1), 0);
        EXIT WHEN v_byte < 250;
      END LOOP;
      v_pick := v_byte % v_total_weight;
      v_acc := 0;
      FOR k IN 1..array_length(v_symbol_weights, 1) LOOP
        v_acc := v_acc + v_symbol_weights[k];
        IF v_pick < v_acc THEN
          v_grid[i][j] := k - 1;
          EXIT;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Evaluar paylines (sin cambios)
  FOR i IN 1..v_line_count LOOP
    v_first := v_grid[1][v_paylines[i][1] + 1];
    v_cnt := 1;
    FOR k IN 2..v_reels LOOP
      EXIT WHEN v_grid[k][v_paylines[i][k] + 1] <> v_first;
      v_cnt := v_cnt + 1;
    END LOOP;
    IF v_cnt >= 3 THEN
      v_payout := (CASE v_cnt
        WHEN 3 THEN v_pay3[v_first + 1]
        WHEN 4 THEN v_pay4[v_first + 1]
        WHEN 5 THEN v_pay5[v_first + 1]
      END) * v_line_bet;
      IF v_payout > 0 THEN
        v_cells := '[]'::jsonb;
        FOR k IN 1..v_cnt LOOP
          v_cells := v_cells || jsonb_build_array(jsonb_build_array(k - 1, v_paylines[i][k]));
        END LOOP;
        v_wins := v_wins || jsonb_build_array(jsonb_build_object(
          'lineIdx',  i - 1,
          'symbolId', v_symbol_ids[v_first + 1],
          'count',    v_cnt,
          'payout',   v_payout,
          'cells',    v_cells
        ));
        v_total := v_total + v_payout;
      END IF;
    END IF;

    IF v_cnt < v_reels THEN
      v_last := v_grid[v_reels][v_paylines[i][v_reels] + 1];
      v_cnt := 1;
      FOR k IN REVERSE (v_reels - 1)..1 LOOP
        EXIT WHEN v_grid[k][v_paylines[i][k] + 1] <> v_last;
        v_cnt := v_cnt + 1;
      END LOOP;
      IF v_cnt >= 3 THEN
        v_payout := (CASE v_cnt
          WHEN 3 THEN v_pay3[v_last + 1]
          WHEN 4 THEN v_pay4[v_last + 1]
          WHEN 5 THEN v_pay5[v_last + 1]
        END) * v_line_bet;
        IF v_payout > 0 THEN
          v_cells := '[]'::jsonb;
          FOR k IN 0..(v_cnt - 1) LOOP
            v_cells := v_cells || jsonb_build_array(jsonb_build_array(
              v_reels - 1 - k,
              v_paylines[i][v_reels - k]
            ));
          END LOOP;
          v_wins := v_wins || jsonb_build_array(jsonb_build_object(
            'lineIdx',  (i - 1) + v_line_count,
            'symbolId', v_symbol_ids[v_last + 1],
            'count',    v_cnt,
            'payout',   v_payout,
            'cells',    v_cells
          ));
          v_total := v_total + v_payout;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Serializar grid
  v_grid_jsonb := '[]'::jsonb;
  FOR i IN 1..v_reels LOOP
    v_reel_jsonb := '[]'::jsonb;
    FOR j IN 1..v_rows LOOP
      v_reel_jsonb := v_reel_jsonb || to_jsonb(v_symbol_ids[v_grid[i][j] + 1]);
    END LOOP;
    v_grid_jsonb := v_grid_jsonb || jsonb_build_array(v_reel_jsonb);
  END LOOP;

  -- DÉBITO BONUS-FIRST
  SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
    INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
    FROM public._debit_bet(p_user_id, p_bet_amount) db;

  INSERT INTO public.transactions (
    user_id, type, amount, balance_after, game, client_action_id, meta
  ) VALUES (
    p_user_id, 'bet'::transaction_type, -p_bet_amount, v_new_balance, 'slot', p_client_action_id,
    jsonb_build_object(
      'kind',             'slot_bet',
      'server_seed_hash', v_server_seed_hash,
      'server_seed',      v_server_seed,
      'bet_amount',       p_bet_amount,
      'from_bonus',       v_from_bonus,
      'from_real',        v_from_real,
      'result', jsonb_build_object(
        'grid', v_grid_jsonb, 'wins', v_wins, 'total', v_total,
        'bet_amount', p_bet_amount,
        'server_seed_hash', v_server_seed_hash,
        'server_seed', v_server_seed
      )
    )
  ) RETURNING id INTO v_bet_tx_id;

  -- CRÉDITO 100% A REAL
  IF v_total > 0 THEN
    SELECT cw.new_balance INTO v_new_balance
      FROM public._credit_win(p_user_id, v_total) cw;

    INSERT INTO public.transactions (
      user_id, type, amount, balance_after, game, client_action_id, meta
    ) VALUES (
      p_user_id, 'win'::transaction_type, v_total, v_new_balance, 'slot', NULL,
      jsonb_build_object(
        'kind', 'slot_win', 'bet_tx_id', v_bet_tx_id,
        'bet_action_id', p_client_action_id,
        'line_count', jsonb_array_length(v_wins),
        'to_real', v_total
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'was_duplicate', false,
    'new_balance',   v_new_balance,
    'cached', jsonb_build_object(
      'grid', v_grid_jsonb, 'wins', v_wins, 'total', v_total,
      'bet_amount', p_bet_amount,
      'server_seed_hash', v_server_seed_hash,
      'server_seed', v_server_seed
    )
  );
END;
$function$;

-- ----------------------------------------------------------------
-- spaceman_place_bet — débito bonus-first
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spaceman_place_bet(p_round_id uuid, p_amount numeric, p_client_action_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF p_amount IS NULL OR p_amount < 500 OR p_amount > 100000 OR (p_amount::numeric % 500) <> 0 THEN
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

-- ----------------------------------------------------------------
-- spaceman_cashout — crédito 100% a real
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spaceman_cashout(p_round_id uuid, p_client_action_id uuid, p_client_elapsed_ms numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
  v_grace_ms         numeric := 500;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

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
    IF v_round.status = 'crashed' THEN
      UPDATE public.game_bets SET status = 'lost', payout = 0, settled_at = now() WHERE id = v_bet.id;
      RAISE EXCEPTION 'crashed_before_cashout' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'not_running' USING ERRCODE = 'P0001';
  END IF;

  v_server_elapsed_ms := EXTRACT(EPOCH FROM (now() - v_round.started_at)) * 1000;
  v_crash_elapsed_ms  := (LN(v_round.crash_multiplier) / 0.06) * 1000;

  IF p_client_elapsed_ms IS NULL OR p_client_elapsed_ms < 0 THEN
    p_client_elapsed_ms := v_server_elapsed_ms;
  END IF;
  IF p_client_elapsed_ms > v_server_elapsed_ms + v_grace_ms THEN
    v_effective_ms := v_server_elapsed_ms;
  ELSE
    v_effective_ms := p_client_elapsed_ms;
  END IF;

  IF v_effective_ms >= v_crash_elapsed_ms THEN
    UPDATE public.game_bets SET status = 'lost', payout = 0, settled_at = now() WHERE id = v_bet.id;
    RAISE EXCEPTION 'crashed_before_cashout' USING ERRCODE = 'P0001';
  END IF;

  v_mult   := public.spaceman_mult_at_ms(v_effective_ms);
  v_payout := ROUND(v_bet.amount * v_mult);

  -- CRÉDITO 100% A REAL
  SELECT cw.new_balance INTO v_new_balance
    FROM public._credit_win(v_user_id, v_payout) cw;

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
            'effective_ms', v_effective_ms,
            'to_real', v_payout
          ));

  RETURN jsonb_build_object(
    'was_duplicate',      false,
    'cashout_multiplier', v_mult,
    'payout',             v_payout,
    'new_balance',        v_new_balance
  );
END;
$function$;
