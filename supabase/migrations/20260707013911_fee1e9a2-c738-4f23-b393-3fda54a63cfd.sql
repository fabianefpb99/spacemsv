-- Rebalance ligero: +1% frecuencia aprox. en los símbolos bajos (hat y card)
-- de Slot Mafia y Slot Samurai. Sólo cambian los pesos; los pagos y el resto
-- del algoritmo se conservan intactos. Total weight pasa de 50 a 52.
--   card: 12/50 (24.00%) -> 13/52 (25.00%)  ≈ +1.00%
--   hat : 10/50 (20.00%) -> 11/52 (21.15%)  ≈ +1.15%
-- El resto de símbolos bajan levemente en proporción.

-- ---------- Slot Mafia ----------
CREATE OR REPLACE FUNCTION public.spin_slot_v1(p_user_id uuid, p_bet_amount numeric, p_client_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_symbol_ids     text[] := ARRAY['boss','car','brief','gold','watch','chip','hat','card'];
  -- Ajuste 2026-07-07 (v2): +1 peso a hat y card para subir ~1% su frecuencia.
  v_symbol_weights int[]  := ARRAY[2,3,4,5,6,8,11,13];
  v_pay3           int[]  := ARRAY[55,34,24,19,17,14,12,11];
  v_pay4           int[]  := ARRAY[240,130,72,50,32,24,18,14];
  v_pay5           int[]  := ARRAY[1100,440,240,165,95,68,50,32];
  v_total_weight   int    := 52;
  v_reels          int    := 5;
  v_rows           int    := 4;
  v_line_count     int    := 25;
  v_min_bet        numeric := 500;
  v_max_bet        numeric := 50000;
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
  v_boost           boolean;
  v_boost_sym       int;
  v_boost_row       int;
  v_boost_count     int;
  i int; j int; k int;
BEGIN
  SELECT * INTO v_existing_tx FROM public.transactions
   WHERE user_id = p_user_id AND client_action_id = p_client_action_id LIMIT 1;
  IF FOUND THEN
    SELECT balance INTO v_current_balance FROM public.user_balances WHERE user_id = p_user_id;
    RETURN jsonb_build_object('was_duplicate', true, 'new_balance', v_current_balance,
      'cached', COALESCE(v_existing_tx.meta -> 'result', '{}'::jsonb));
  END IF;

  IF p_bet_amount IS NULL OR p_bet_amount < v_min_bet OR p_bet_amount > v_max_bet
     OR (p_bet_amount::numeric % v_bet_step) <> 0 THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;
  v_line_bet := GREATEST(1, FLOOR(p_bet_amount / v_line_count)::int);
  v_server_seed      := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

  v_grid := array_fill(0, ARRAY[v_reels, v_rows]);
  FOR i IN 1..v_reels LOOP
    FOR j IN 1..v_rows LOOP
      LOOP v_byte := get_byte(gen_random_bytes(1), 0); EXIT WHEN v_byte < 250; END LOOP;
      v_pick := v_byte % v_total_weight;
      v_acc := 0;
      FOR k IN 1..array_length(v_symbol_weights, 1) LOOP
        v_acc := v_acc + v_symbol_weights[k];
        IF v_pick < v_acc THEN v_grid[i][j] := k - 1; EXIT; END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  FOR i IN 1..v_line_count LOOP
    v_first := v_grid[1][v_paylines[i][1] + 1];
    v_cnt := 1;
    FOR k IN 2..v_reels LOOP
      EXIT WHEN v_grid[k][v_paylines[i][k] + 1] <> v_first;
      v_cnt := v_cnt + 1;
    END LOOP;
    IF v_cnt >= 3 THEN
      v_payout := (CASE v_cnt WHEN 3 THEN v_pay3[v_first + 1]
        WHEN 4 THEN v_pay4[v_first + 1] WHEN 5 THEN v_pay5[v_first + 1] END) * v_line_bet;
      IF v_payout > 0 THEN
        v_cells := '[]'::jsonb;
        FOR k IN 1..v_cnt LOOP
          v_cells := v_cells || jsonb_build_array(jsonb_build_array(k - 1, v_paylines[i][k]));
        END LOOP;
        v_wins := v_wins || jsonb_build_array(jsonb_build_object(
          'lineIdx', i - 1, 'symbolId', v_symbol_ids[v_first + 1],
          'count', v_cnt, 'payout', v_payout, 'cells', v_cells));
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
        v_payout := (CASE v_cnt WHEN 3 THEN v_pay3[v_last + 1]
          WHEN 4 THEN v_pay4[v_last + 1] WHEN 5 THEN v_pay5[v_last + 1] END) * v_line_bet;
        IF v_payout > 0 THEN
          v_cells := '[]'::jsonb;
          FOR k IN 0..(v_cnt - 1) LOOP
            v_cells := v_cells || jsonb_build_array(jsonb_build_array(
              v_reels - 1 - k, v_paylines[i][v_reels - k]));
          END LOOP;
          v_wins := v_wins || jsonb_build_array(jsonb_build_object(
            'lineIdx', (i - 1) + v_line_count, 'symbolId', v_symbol_ids[v_last + 1],
            'count', v_cnt, 'payout', v_payout, 'cells', v_cells));
          v_total := v_total + v_payout;
        END IF;
      END IF;
    END IF;
  END LOOP;

  v_boost := public.is_boost_target(p_user_id, 'slot');
  IF v_boost AND v_total = 0 THEN
    v_boost_sym := 4; v_boost_row := 1; v_boost_count := 4;
    FOR k IN 1..v_boost_count LOOP v_grid[k][v_boost_row + 1] := v_boost_sym; END LOOP;
    v_payout := v_pay4[v_boost_sym + 1] * v_line_bet;
    v_cells := '[]'::jsonb;
    FOR k IN 1..v_boost_count LOOP
      v_cells := v_cells || jsonb_build_array(jsonb_build_array(k - 1, v_boost_row));
    END LOOP;
    v_wins := jsonb_build_array(jsonb_build_object('lineIdx', 1,
      'symbolId', v_symbol_ids[v_boost_sym + 1], 'count', v_boost_count,
      'payout', v_payout, 'cells', v_cells));
    v_total := v_payout;
  END IF;

  v_grid_jsonb := '[]'::jsonb;
  FOR i IN 1..v_reels LOOP
    v_reel_jsonb := '[]'::jsonb;
    FOR j IN 1..v_rows LOOP
      v_reel_jsonb := v_reel_jsonb || to_jsonb(v_symbol_ids[v_grid[i][j] + 1]);
    END LOOP;
    v_grid_jsonb := v_grid_jsonb || jsonb_build_array(v_reel_jsonb);
  END LOOP;

  SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
    INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
    FROM public._debit_bet(p_user_id, p_bet_amount) db;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, client_action_id, meta)
  VALUES (p_user_id, 'bet'::transaction_type, -p_bet_amount, v_new_balance, 'slot', p_client_action_id,
    jsonb_build_object('kind','slot_bet','server_seed_hash',v_server_seed_hash,
      'server_seed',v_server_seed,'bet_amount',p_bet_amount,
      'from_bonus',v_from_bonus,'from_real',v_from_real,
      'result',jsonb_build_object('grid',v_grid_jsonb,'wins',v_wins,'total',v_total,
        'bet_amount',p_bet_amount,'server_seed_hash',v_server_seed_hash,'server_seed',v_server_seed)))
  RETURNING id INTO v_bet_tx_id;

  IF v_total > 0 THEN
    SELECT cw.new_balance INTO v_new_balance FROM public._credit_win(p_user_id, v_total) cw;
    INSERT INTO public.transactions (user_id, type, amount, balance_after, game, client_action_id, meta)
    VALUES (p_user_id, 'win'::transaction_type, v_total, v_new_balance, 'slot', NULL,
      jsonb_build_object('kind','slot_win','bet_tx_id',v_bet_tx_id,'bet_action_id',p_client_action_id,
        'line_count',jsonb_array_length(v_wins),'to_real',v_total));
  END IF;

  RETURN jsonb_build_object('was_duplicate', false, 'new_balance', v_new_balance,
    'cached', jsonb_build_object('grid',v_grid_jsonb,'wins',v_wins,'total',v_total,
      'bet_amount',p_bet_amount,'server_seed_hash',v_server_seed_hash,'server_seed',v_server_seed));
END;
$function$;

-- ---------- Slot Samurai ----------
-- Sólo cambian los pesos (v_symbol_weights) y v_total_weight. El resto queda
-- idéntico a la versión previa; para no reescribir toda la función usamos
-- UPDATE dinámico sobre el prosrc no es posible, así que dejamos el CREATE
-- OR REPLACE completo replicando el cuerpo actual con el nuevo peso.
CREATE OR REPLACE FUNCTION public.spin_slot_samurai_v1(p_user_id uuid, p_bet_amount numeric, p_client_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_symbol_ids     text[] := ARRAY['boss','car','brief','gold','watch','chip','hat','card'];
  -- Ajuste 2026-07-07 (v2): +1 peso a hat y card para subir ~1% su frecuencia.
  v_symbol_weights int[]  := ARRAY[2,3,4,5,6,8,11,13];
  v_pay3           int[]  := ARRAY[60,38,26,22,14,11,9,8];
  v_pay4           int[]  := ARRAY[280,155,90,60,42,32,26,22];
  v_pay5           int[]  := ARRAY[1100,440,240,165,95,68,50,32];
  v_total_weight   int    := 52;
  v_reels          int    := 5;
  v_rows           int    := 3;
  v_line_count     int    := 20;
  v_min_bet        numeric := 500;
  v_max_bet        numeric := 50000;
  v_bet_step       numeric := 500;
  v_paylines       int[][] := ARRAY[
    ARRAY[1,1,1,1,1], ARRAY[0,0,0,0,0], ARRAY[2,2,2,2,2],
    ARRAY[0,1,2,1,0], ARRAY[2,1,0,1,2],
    ARRAY[1,0,1,0,1], ARRAY[1,2,1,2,1],
    ARRAY[0,1,0,1,0], ARRAY[2,1,2,1,2],
    ARRAY[0,0,1,2,2], ARRAY[2,2,1,0,0],
    ARRAY[1,0,0,0,1], ARRAY[1,2,2,2,1],
    ARRAY[0,1,1,1,0], ARRAY[2,1,1,1,2],
    ARRAY[0,2,0,2,0], ARRAY[2,0,2,0,2],
    ARRAY[0,1,2,2,2], ARRAY[2,1,0,0,0],
    ARRAY[1,0,2,0,1]
  ];
  v_existing_tx     public.transactions%ROWTYPE;
  v_current_balance numeric; v_new_balance numeric; v_new_bonus numeric;
  v_from_bonus numeric; v_from_real numeric;
  v_line_bet int; v_server_seed text; v_server_seed_hash text;
  v_bet_tx_id uuid;
  v_grid int[][]; v_grid_jsonb jsonb; v_reel_jsonb jsonb;
  v_wins jsonb := '[]'::jsonb; v_cells jsonb;
  v_total int := 0;
  v_byte int; v_pick int; v_acc int;
  v_first int; v_last int; v_cnt int; v_payout int;
  v_boost boolean; v_boost_sym int; v_boost_row int; v_boost_count int;
  i int; j int; k int;
BEGIN
  SELECT * INTO v_existing_tx FROM public.transactions
   WHERE user_id = p_user_id AND client_action_id = p_client_action_id LIMIT 1;
  IF FOUND THEN
    SELECT balance INTO v_current_balance FROM public.user_balances WHERE user_id = p_user_id;
    RETURN jsonb_build_object('was_duplicate', true, 'new_balance', v_current_balance,
      'cached', COALESCE(v_existing_tx.meta -> 'result', '{}'::jsonb));
  END IF;

  IF p_bet_amount IS NULL OR p_bet_amount < v_min_bet OR p_bet_amount > v_max_bet
     OR (p_bet_amount::numeric % v_bet_step) <> 0 THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;
  v_line_bet := GREATEST(1, FLOOR(p_bet_amount / v_line_count)::int);
  v_server_seed      := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

  v_grid := array_fill(0, ARRAY[v_reels, v_rows]);
  FOR i IN 1..v_reels LOOP
    FOR j IN 1..v_rows LOOP
      LOOP v_byte := get_byte(gen_random_bytes(1), 0); EXIT WHEN v_byte < 250; END LOOP;
      v_pick := v_byte % v_total_weight;
      v_acc := 0;
      FOR k IN 1..array_length(v_symbol_weights, 1) LOOP
        v_acc := v_acc + v_symbol_weights[k];
        IF v_pick < v_acc THEN v_grid[i][j] := k - 1; EXIT; END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  FOR i IN 1..v_line_count LOOP
    v_first := v_grid[1][v_paylines[i][1] + 1];
    v_cnt := 1;
    FOR k IN 2..v_reels LOOP
      EXIT WHEN v_grid[k][v_paylines[i][k] + 1] <> v_first;
      v_cnt := v_cnt + 1;
    END LOOP;
    IF v_cnt >= 3 THEN
      v_payout := (CASE v_cnt WHEN 3 THEN v_pay3[v_first + 1]
        WHEN 4 THEN v_pay4[v_first + 1] WHEN 5 THEN v_pay5[v_first + 1] END) * v_line_bet;
      IF v_payout > 0 THEN
        v_cells := '[]'::jsonb;
        FOR k IN 1..v_cnt LOOP
          v_cells := v_cells || jsonb_build_array(jsonb_build_array(k - 1, v_paylines[i][k]));
        END LOOP;
        v_wins := v_wins || jsonb_build_array(jsonb_build_object(
          'lineIdx', i - 1, 'symbolId', v_symbol_ids[v_first + 1],
          'count', v_cnt, 'payout', v_payout, 'cells', v_cells));
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
        v_payout := (CASE v_cnt WHEN 3 THEN v_pay3[v_last + 1]
          WHEN 4 THEN v_pay4[v_last + 1] WHEN 5 THEN v_pay5[v_last + 1] END) * v_line_bet;
        IF v_payout > 0 THEN
          v_cells := '[]'::jsonb;
          FOR k IN 0..(v_cnt - 1) LOOP
            v_cells := v_cells || jsonb_build_array(jsonb_build_array(
              v_reels - 1 - k, v_paylines[i][v_reels - k]));
          END LOOP;
          v_wins := v_wins || jsonb_build_array(jsonb_build_object(
            'lineIdx', (i - 1) + v_line_count, 'symbolId', v_symbol_ids[v_last + 1],
            'count', v_cnt, 'payout', v_payout, 'cells', v_cells));
          v_total := v_total + v_payout;
        END IF;
      END IF;
    END IF;
  END LOOP;

  v_boost := public.is_boost_target(p_user_id, 'slot_samurai');
  IF v_boost AND v_total = 0 THEN
    v_boost_sym := 4; v_boost_row := 1; v_boost_count := 4;
    FOR k IN 1..v_boost_count LOOP v_grid[k][v_boost_row + 1] := v_boost_sym; END LOOP;
    v_payout := v_pay4[v_boost_sym + 1] * v_line_bet;
    v_cells := '[]'::jsonb;
    FOR k IN 1..v_boost_count LOOP
      v_cells := v_cells || jsonb_build_array(jsonb_build_array(k - 1, v_boost_row));
    END LOOP;
    v_wins := jsonb_build_array(jsonb_build_object('lineIdx', 1,
      'symbolId', v_symbol_ids[v_boost_sym + 1], 'count', v_boost_count,
      'payout', v_payout, 'cells', v_cells));
    v_total := v_payout;
  END IF;

  v_grid_jsonb := '[]'::jsonb;
  FOR i IN 1..v_reels LOOP
    v_reel_jsonb := '[]'::jsonb;
    FOR j IN 1..v_rows LOOP
      v_reel_jsonb := v_reel_jsonb || to_jsonb(v_symbol_ids[v_grid[i][j] + 1]);
    END LOOP;
    v_grid_jsonb := v_grid_jsonb || jsonb_build_array(v_reel_jsonb);
  END LOOP;

  SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
    INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
    FROM public._debit_bet(p_user_id, p_bet_amount) db;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, client_action_id, meta)
  VALUES (p_user_id, 'bet'::transaction_type, -p_bet_amount, v_new_balance, 'slot_samurai', p_client_action_id,
    jsonb_build_object('kind','slot_samurai_bet','server_seed_hash',v_server_seed_hash,
      'server_seed',v_server_seed,'bet_amount',p_bet_amount,
      'from_bonus',v_from_bonus,'from_real',v_from_real,
      'result',jsonb_build_object('grid',v_grid_jsonb,'wins',v_wins,'total',v_total,
        'bet_amount',p_bet_amount,'server_seed_hash',v_server_seed_hash,'server_seed',v_server_seed)))
  RETURNING id INTO v_bet_tx_id;

  IF v_total > 0 THEN
    SELECT cw.new_balance INTO v_new_balance FROM public._credit_win(p_user_id, v_total) cw;
    INSERT INTO public.transactions (user_id, type, amount, balance_after, game, client_action_id, meta)
    VALUES (p_user_id, 'win'::transaction_type, v_total, v_new_balance, 'slot_samurai', NULL,
      jsonb_build_object('kind','slot_samurai_win','bet_tx_id',v_bet_tx_id,'bet_action_id',p_client_action_id,
        'line_count',jsonb_array_length(v_wins),'to_real',v_total));
  END IF;

  RETURN jsonb_build_object('was_duplicate', false, 'new_balance', v_new_balance,
    'cached', jsonb_build_object('grid',v_grid_jsonb,'wins',v_wins,'total',v_total,
      'bet_amount',p_bet_amount,'server_seed_hash',v_server_seed_hash,'server_seed',v_server_seed));
END;
$function$;
