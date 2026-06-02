-- Ensure pgcrypto is available for gen_random_bytes() and digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- spin_slot_v1: atomic slot spin (debit + RNG + evaluate + credit + record)
-- Mirrors evaluateSlotGrid() in src/lib/games/slot.shared.ts exactly.
-- Symbols/weights/payouts MUST stay in sync with that file.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.spin_slot_v1(
  p_user_id          uuid,
  p_bet_amount       numeric,
  p_client_action_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- ----- Game constants (keep in sync with slot.shared.ts) -----
  v_symbol_ids     text[] := ARRAY['boss','car','brief','gold','watch','chip','hat','card'];
  v_symbol_weights int[]  := ARRAY[2,3,4,5,6,8,10,12];
  v_pay3           int[]  := ARRAY[55,34,24,19,13,10,8,7];
  v_pay4           int[]  := ARRAY[240,130,72,50,32,24,18,14];
  v_pay5           int[]  := ARRAY[1100,440,240,165,95,68,50,32];
  v_total_weight   int    := 50;  -- sum of symbol weights
  v_reels          int    := 5;
  v_rows           int    := 4;
  v_line_count     int    := 25;
  v_min_bet        numeric := 500;
  v_max_bet        numeric := 100000;
  v_bet_step       numeric := 500;
  v_paylines       int[][] := ARRAY[
    ARRAY[1,1,1,1,1],
    ARRAY[2,2,2,2,2],
    ARRAY[0,0,0,0,0],
    ARRAY[3,3,3,3,3],
    ARRAY[0,1,2,1,0],
    ARRAY[3,2,1,2,3],
    ARRAY[1,2,3,2,1],
    ARRAY[2,1,0,1,2],
    ARRAY[0,0,1,2,2],
    ARRAY[3,3,2,1,1],
    ARRAY[1,0,0,0,1],
    ARRAY[2,3,3,3,2],
    ARRAY[0,1,1,1,0],
    ARRAY[3,2,2,2,3],
    ARRAY[1,2,1,2,1],
    ARRAY[2,1,2,1,2],
    ARRAY[0,1,2,3,3],
    ARRAY[3,2,1,0,0],
    ARRAY[1,1,2,3,3],
    ARRAY[2,2,1,0,0],
    ARRAY[0,2,0,2,0],
    ARRAY[3,1,3,1,3],
    ARRAY[1,0,1,0,1],
    ARRAY[2,3,2,3,2],
    ARRAY[0,3,0,3,0]
  ];

  -- ----- State -----
  v_existing_tx     public.transactions%ROWTYPE;
  v_current_balance numeric;
  v_new_balance     numeric;
  v_line_bet        int;
  v_server_seed     text;
  v_server_seed_hash text;
  v_bet_tx_id       uuid;
  v_grid            int[][];      -- stores symbol indices 0..7
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
  -- ===== 1. Idempotency: if this client_action_id was already processed,
  --        return the cached result without touching the balance again.
  SELECT * INTO v_existing_tx
    FROM public.transactions
   WHERE user_id = p_user_id
     AND client_action_id = p_client_action_id
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

  -- ===== 2. Validate bet =====
  IF p_bet_amount IS NULL
     OR p_bet_amount < v_min_bet
     OR p_bet_amount > v_max_bet
     OR (p_bet_amount::numeric % v_bet_step) <> 0 THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;
  v_line_bet := GREATEST(1, FLOOR(p_bet_amount / v_line_count)::int);

  -- ===== 3. Lock balance row & verify funds =====
  SELECT balance INTO v_current_balance
    FROM public.user_balances
   WHERE user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'balance_row_missing' USING ERRCODE = 'P0002';
  END IF;
  IF v_current_balance < p_bet_amount THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  -- ===== 4. Provably-fair server seed =====
  v_server_seed      := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

  -- ===== 5. Generate 5x4 grid with weighted RNG (rejection sampling) =====
  v_grid := array_fill(0, ARRAY[v_reels, v_rows]);
  FOR i IN 1..v_reels LOOP
    FOR j IN 1..v_rows LOOP
      -- Rejection sample: keep bytes in [0, 250) → unbiased mod 50
      LOOP
        v_byte := get_byte(gen_random_bytes(1), 0);
        EXIT WHEN v_byte < 250;
      END LOOP;
      v_pick := v_byte % v_total_weight; -- 0..49
      v_acc := 0;
      FOR k IN 1..array_length(v_symbol_weights, 1) LOOP
        v_acc := v_acc + v_symbol_weights[k];
        IF v_pick < v_acc THEN
          v_grid[i][j] := k - 1; -- store 0-based symbol index
          EXIT;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ===== 6. Evaluate the 25 paylines, both directions =====
  -- paylines store 0-based row indices; PG arrays are 1-based, so +1 on read.
  FOR i IN 1..v_line_count LOOP
    -- ----- Left → Right -----
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
          v_cells := v_cells || jsonb_build_array(
            jsonb_build_array(k - 1, v_paylines[i][k])
          );
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

    -- ----- Right → Left (skip if L→R already used all 5 reels) -----
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
            -- 0-based reel = v_reels - 1 - k → PG 1-based payline index = v_reels - k
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

  -- ===== 7. Serialize grid as jsonb of symbol-id strings =====
  v_grid_jsonb := '[]'::jsonb;
  FOR i IN 1..v_reels LOOP
    v_reel_jsonb := '[]'::jsonb;
    FOR j IN 1..v_rows LOOP
      v_reel_jsonb := v_reel_jsonb || to_jsonb(v_symbol_ids[v_grid[i][j] + 1]);
    END LOOP;
    v_grid_jsonb := v_grid_jsonb || jsonb_build_array(v_reel_jsonb);
  END LOOP;

  -- ===== 8. Debit bet =====
  v_new_balance := v_current_balance - p_bet_amount;
  UPDATE public.user_balances
     SET balance = v_new_balance, updated_at = now()
   WHERE user_id = p_user_id;

  -- Record bet tx (carries the cached result for idempotent retries)
  INSERT INTO public.transactions (
    user_id, type, amount, balance_after, game, client_action_id, meta
  ) VALUES (
    p_user_id,
    'bet'::transaction_type,
    -p_bet_amount,
    v_new_balance,
    'slot',
    p_client_action_id,
    jsonb_build_object(
      'kind',             'slot_bet',
      'server_seed_hash', v_server_seed_hash,
      'server_seed',      v_server_seed,
      'bet_amount',       p_bet_amount,
      'result',           jsonb_build_object(
        'grid',             v_grid_jsonb,
        'wins',             v_wins,
        'total',            v_total,
        'bet_amount',       p_bet_amount,
        'server_seed_hash', v_server_seed_hash,
        'server_seed',      v_server_seed
      )
    )
  ) RETURNING id INTO v_bet_tx_id;

  -- ===== 9. Credit win (atomic with the debit above) =====
  IF v_total > 0 THEN
    v_new_balance := v_new_balance + v_total;
    UPDATE public.user_balances
       SET balance = v_new_balance, updated_at = now()
     WHERE user_id = p_user_id;

    -- Win tx has NULL client_action_id (the bet tx is the dedupe anchor)
    INSERT INTO public.transactions (
      user_id, type, amount, balance_after, game, client_action_id, meta
    ) VALUES (
      p_user_id,
      'win'::transaction_type,
      v_total,
      v_new_balance,
      'slot',
      NULL,
      jsonb_build_object(
        'kind',           'slot_win',
        'bet_tx_id',      v_bet_tx_id,
        'bet_action_id',  p_client_action_id,
        'line_count',     jsonb_array_length(v_wins)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'was_duplicate', false,
    'new_balance',   v_new_balance,
    'cached', jsonb_build_object(
      'grid',             v_grid_jsonb,
      'wins',             v_wins,
      'total',            v_total,
      'bet_amount',       p_bet_amount,
      'server_seed_hash', v_server_seed_hash,
      'server_seed',      v_server_seed
    )
  );
END;
$$;

-- Only the server (service_role) may execute this. End-users cannot bypass
-- the application layer and call it directly from the browser.
REVOKE EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) TO service_role;