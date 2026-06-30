-- Boost-aware Roulette: si target del boost y perdió, fuerza ganancia en el color elegido
CREATE OR REPLACE FUNCTION public.spin_roulette_v1(p_user_id uuid, p_bet_amount numeric, p_choice text, p_client_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_min_bet      numeric := 500;
  v_max_bet      numeric := 500000;
  v_bet_step     numeric := 500;
  v_red_numbers  int[] := ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  v_black_numbers int[] := ARRAY[2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

  v_existing_tx     public.transactions%ROWTYPE;
  v_current_balance numeric;
  v_new_balance     numeric;
  v_new_bonus       numeric;
  v_from_bonus      numeric;
  v_from_real       numeric;

  v_server_seed      text;
  v_server_seed_hash text;
  v_byte            int;
  v_segment         int;
  v_winning_color   text;
  v_won             boolean;
  v_multiplier      numeric;
  v_payout          numeric := 0;
  v_bet_tx_id       uuid;
  v_result          jsonb;
  v_boost           boolean;
  v_choices         int[];
BEGIN
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

  IF p_choice NOT IN ('red','black','green') THEN
    RAISE EXCEPTION 'invalid_choice' USING ERRCODE = 'P0001';
  END IF;
  IF p_bet_amount IS NULL
     OR p_bet_amount < v_min_bet
     OR p_bet_amount > v_max_bet
     OR (p_bet_amount::numeric % v_bet_step) <> 0 THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;

  v_server_seed      := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

  LOOP
    v_byte := get_byte(gen_random_bytes(1), 0);
    EXIT WHEN v_byte < 222;
  END LOOP;
  v_segment := v_byte % 37;

  IF v_segment = 0 THEN
    v_winning_color := 'green';
  ELSIF v_segment = ANY(v_red_numbers) THEN
    v_winning_color := 'red';
  ELSE
    v_winning_color := 'black';
  END IF;

  v_won := (v_winning_color = p_choice);

  -- BOOST: si el jugador es target del boost y perdió, fuerza ganancia en su color
  v_boost := public.is_boost_target(p_user_id, 'ruleta');
  IF v_boost AND NOT v_won AND p_choice IN ('red','black') THEN
    v_choices := CASE WHEN p_choice = 'red' THEN v_red_numbers ELSE v_black_numbers END;
    v_byte := get_byte(gen_random_bytes(1), 0);
    v_segment := v_choices[1 + (v_byte % array_length(v_choices, 1))];
    v_winning_color := p_choice;
    v_won := true;
  END IF;

  v_multiplier := CASE
    WHEN v_won AND p_choice = 'green' THEN 14.0
    WHEN v_won THEN 2.0
    ELSE 0
  END;
  IF v_won THEN
    v_payout := ROUND(p_bet_amount * v_multiplier);
  END IF;

  SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
    INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
    FROM public._debit_bet(p_user_id, p_bet_amount) db;

  v_result := jsonb_build_object(
    'winning_segment', v_segment,
    'winning_color',   v_winning_color,
    'choice',          p_choice,
    'won',             v_won,
    'multiplier',      v_multiplier,
    'payout',          v_payout,
    'bet_amount',      p_bet_amount,
    'server_seed',     v_server_seed,
    'server_seed_hash', v_server_seed_hash
  );

  INSERT INTO public.transactions (
    user_id, type, amount, balance_after, game, client_action_id, meta
  ) VALUES (
    p_user_id, 'bet'::transaction_type, -p_bet_amount, v_new_balance, 'ruleta', p_client_action_id,
    jsonb_build_object(
      'kind',             'roulette_bet',
      'server_seed_hash', v_server_seed_hash,
      'server_seed',      v_server_seed,
      'bet_amount',       p_bet_amount,
      'choice',           p_choice,
      'from_bonus',       v_from_bonus,
      'from_real',        v_from_real,
      'result',           v_result
    )
  ) RETURNING id INTO v_bet_tx_id;

  IF v_payout > 0 THEN
    SELECT cw.new_balance INTO v_new_balance
      FROM public._credit_win(p_user_id, v_payout) cw;

    INSERT INTO public.transactions (
      user_id, type, amount, balance_after, game, client_action_id, meta
    ) VALUES (
      p_user_id, 'win'::transaction_type, v_payout, v_new_balance, 'ruleta', NULL,
      jsonb_build_object(
        'kind',          'roulette_win',
        'bet_tx_id',     v_bet_tx_id,
        'bet_action_id', p_client_action_id,
        'multiplier',    v_multiplier,
        'winning_segment', v_segment,
        'winning_color', v_winning_color,
        'to_real',       v_payout
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'was_duplicate', false,
    'new_balance',   v_new_balance,
    'cached',        v_result
  );
END;
$function$;


-- Boost-aware Slot: si target del boost y resultó cero, inyectamos una línea ganadora sintética
CREATE OR REPLACE FUNCTION public.spin_slot_v1(p_user_id uuid, p_bet_amount numeric, p_client_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
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

  v_server_seed      := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

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

  -- BOOST: inyecta línea ganadora sintética si era loss
  v_boost := public.is_boost_target(p_user_id, 'slot');
  IF v_boost AND v_total = 0 THEN
    -- Selecciona símbolo medio (idx 4 = 'watch') y rellena la fila central (idx 1) con 4 iguales
    v_boost_sym := 4;
    v_boost_row := 1;
    v_boost_count := 4;
    FOR k IN 1..v_boost_count LOOP
      v_grid[k][v_boost_row + 1] := v_boost_sym;
    END LOOP;
    v_payout := v_pay4[v_boost_sym + 1] * v_line_bet;
    v_cells := '[]'::jsonb;
    FOR k IN 1..v_boost_count LOOP
      v_cells := v_cells || jsonb_build_array(jsonb_build_array(k - 1, v_boost_row));
    END LOOP;
    v_wins := jsonb_build_array(jsonb_build_object(
      'lineIdx',  1,
      'symbolId', v_symbol_ids[v_boost_sym + 1],
      'count',    v_boost_count,
      'payout',   v_payout,
      'cells',    v_cells
    ));
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


-- Boost-aware Arena: si target del boost y la casa o un rival iba a ganar, fuerza victoria del personaje elegido
CREATE OR REPLACE FUNCTION public.play_arena_v1(p_user_id uuid, p_bet_amount numeric, p_character text, p_client_action_id uuid, p_odds_perm integer[] DEFAULT NULL::integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_min_bet  numeric := 1000;
  v_max_bet  numeric := 50000;
  v_bet_step numeric := 500;

  v_chars text[]   := ARRAY['nova','shadow','titan','blaze'];
  v_base_odds    numeric[] := ARRAY[3.30, 3.30, 3.30, 8.00];
  v_base_weights int[]     := ARRAY[280, 280, 280, 110];
  v_odds  numeric[];
  v_weights int[];
  v_total_w int := 1000;
  v_house_w int := 50;
  v_perm int[];

  v_existing_tx     public.transactions%ROWTYPE;
  v_current_balance numeric;
  v_new_balance     numeric;
  v_new_bonus       numeric;
  v_from_bonus      numeric;
  v_from_real       numeric;

  v_server_seed      text;
  v_server_seed_hash text;
  v_hash_bytes       bytea;
  v_byte             int;
  v_pick             int;
  v_acc              int;
  v_house_wins       boolean := false;
  v_winner_idx       int := 0;
  v_winner           text;
  v_won              boolean;
  v_multiplier       numeric;
  v_payout           numeric := 0;
  v_bet_idx          int;
  v_combat_log       jsonb;
  v_bet_tx_id        uuid;
  v_round_id         uuid;
  v_round_payload    jsonb;

  v_rounds_n                int;
  v_hp                      int[] := ARRAY[100,100,100,100];
  v_atk_idx                 int;
  v_target_idx              int;
  v_damage                  int;
  v_alive_count             int;
  v_alive                   int[];
  v_non_winner_alive        int[];
  v_log_arr                 jsonb := '[]'::jsonb;
  v_non_winner_kills        int := 0;
  v_rivals                  int[];
  v_boost                   boolean;
  i int; j int; k int; m int;

  v_seen boolean[] := ARRAY[false,false,false,false];
BEGIN
  SELECT * INTO v_existing_tx
    FROM public.transactions
   WHERE user_id = p_user_id AND client_action_id = p_client_action_id
   LIMIT 1;
  IF FOUND THEN
    SELECT balance INTO v_current_balance FROM public.user_balances WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'was_duplicate', true,
      'new_balance',   v_current_balance,
      'cached',        COALESCE(v_existing_tx.meta -> 'result', '{}'::jsonb)
    );
  END IF;

  IF p_character IS NULL OR NOT (p_character = ANY(v_chars)) THEN
    RAISE EXCEPTION 'invalid_character' USING ERRCODE = 'P0001';
  END IF;
  IF p_bet_amount IS NULL
     OR p_bet_amount < v_min_bet
     OR p_bet_amount > v_max_bet
     OR (p_bet_amount::numeric % v_bet_step) <> 0 THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;

  IF p_odds_perm IS NULL THEN
    v_perm := ARRAY[1,2,3,4];
  ELSE
    IF array_length(p_odds_perm, 1) <> 4 THEN
      RAISE EXCEPTION 'invalid_odds_perm' USING ERRCODE = 'P0001';
    END IF;
    FOR k IN 1..4 LOOP
      IF p_odds_perm[k] IS NULL OR p_odds_perm[k] < 1 OR p_odds_perm[k] > 4 THEN
        RAISE EXCEPTION 'invalid_odds_perm' USING ERRCODE = 'P0001';
      END IF;
      IF v_seen[p_odds_perm[k]] THEN
        RAISE EXCEPTION 'invalid_odds_perm' USING ERRCODE = 'P0001';
      END IF;
      v_seen[p_odds_perm[k]] := true;
    END LOOP;
    v_perm := p_odds_perm;
  END IF;

  v_weights := ARRAY[
    v_base_weights[v_perm[1]],
    v_base_weights[v_perm[2]],
    v_base_weights[v_perm[3]],
    v_base_weights[v_perm[4]]
  ];
  v_odds := ARRAY[
    v_base_odds[v_perm[1]],
    v_base_odds[v_perm[2]],
    v_base_odds[v_perm[3]],
    v_base_odds[v_perm[4]]
  ];

  v_bet_idx := array_position(v_chars, p_character);

  v_server_seed      := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

  DECLARE
    v_max_accept int := (65536 / v_total_w) * v_total_w;
    v_u int;
    v_b bytea;
  BEGIN
    LOOP
      v_b := gen_random_bytes(2);
      v_u := (get_byte(v_b, 0) * 256) + get_byte(v_b, 1);
      EXIT WHEN v_u < v_max_accept;
    END LOOP;
    v_pick := v_u % v_total_w;
  END;

  IF v_pick >= (v_total_w - v_house_w) THEN
    v_house_wins := true;
    v_rivals := ARRAY[]::int[];
    FOR k IN 1..4 LOOP
      IF k <> v_bet_idx THEN
        v_rivals := array_append(v_rivals, k);
      END IF;
    END LOOP;
    v_byte := get_byte(gen_random_bytes(1), 0);
    v_winner_idx := v_rivals[1 + (v_byte % array_length(v_rivals, 1))];
  ELSE
    v_acc := 0;
    FOR k IN 1..array_length(v_weights, 1) LOOP
      v_acc := v_acc + v_weights[k];
      IF v_pick < v_acc THEN
        v_winner_idx := k;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- BOOST: si el jugador es target y no eligió al ganador, forzamos victoria de su personaje
  v_boost := public.is_boost_target(p_user_id, 'arena');
  IF v_boost AND (v_house_wins OR v_winner_idx <> v_bet_idx) THEN
    v_winner_idx := v_bet_idx;
    v_house_wins := false;
  END IF;

  v_winner := v_chars[v_winner_idx];

  v_won := (NOT v_house_wins) AND (v_winner = p_character);
  v_multiplier := v_odds[v_bet_idx];
  IF v_won THEN
    v_payout := ROUND(p_bet_amount * v_multiplier);
  END IF;

  v_hash_bytes := digest(v_server_seed || '|combat', 'sha256');
  v_rounds_n   := 10 + (get_byte(v_hash_bytes, 0) % 6);
  j := 1;
  v_alive_count := 4;

  FOR i IN 1..v_rounds_n LOOP
    EXIT WHEN v_alive_count <= 2;

    v_target_idx := 0;
    v_alive := ARRAY[]::int[];
    v_non_winner_alive := ARRAY[]::int[];
    FOR k IN 1..4 LOOP
      IF v_hp[k] > 0 THEN
        v_alive := array_append(v_alive, k);
        IF k <> v_winner_idx THEN
          v_non_winner_alive := array_append(v_non_winner_alive, k);
        END IF;
      END IF;
    END LOOP;

    v_byte := get_byte(v_hash_bytes, (j % 32)); j := j + 1;
    IF array_length(v_non_winner_alive, 1) >= 2 AND v_byte < 166 THEN
      v_atk_idx := v_non_winner_alive[1 + (v_byte % array_length(v_non_winner_alive, 1))];
    ELSE
      v_atk_idx := v_alive[1 + (v_byte % array_length(v_alive, 1))];
    END IF;

    v_byte := get_byte(v_hash_bytes, (j % 32)); j := j + 1;
    IF v_atk_idx <> v_winner_idx AND array_length(v_non_winner_alive, 1) >= 2 AND v_byte < 179 THEN
      v_non_winner_alive := ARRAY[]::int[];
      FOR k IN 1..4 LOOP
        IF v_hp[k] > 0 AND k <> v_winner_idx AND k <> v_atk_idx THEN
          v_non_winner_alive := array_append(v_non_winner_alive, k);
        END IF;
      END LOOP;
      IF array_length(v_non_winner_alive, 1) >= 1 THEN
        v_target_idx := v_non_winner_alive[1 + (v_byte % array_length(v_non_winner_alive, 1))];
      END IF;
    END IF;

    IF COALESCE(v_target_idx, 0) = 0 THEN
      m := 1 + (v_byte % (array_length(v_alive, 1) - 1));
      v_target_idx := 0;
      FOR k IN 1..array_length(v_alive, 1) LOOP
        IF v_alive[k] <> v_atk_idx THEN
          m := m - 1;
          IF m = 0 THEN
            v_target_idx := v_alive[k];
            EXIT;
          END IF;
        END IF;
      END LOOP;
    END IF;

    IF v_target_idx = 0 THEN
      CONTINUE;
    END IF;

    v_byte   := get_byte(v_hash_bytes, (j % 32)); j := j + 1;
    v_damage := 20 + (v_byte % 21);

    IF v_target_idx = v_winner_idx AND v_damage >= v_hp[v_target_idx] THEN
      v_damage := GREATEST(1, v_hp[v_target_idx] - 1);
    END IF;

    v_hp[v_target_idx] := GREATEST(0, v_hp[v_target_idx] - v_damage);
    IF v_hp[v_target_idx] = 0 THEN
      v_alive_count := v_alive_count - 1;
      IF v_atk_idx <> v_winner_idx AND v_target_idx <> v_winner_idx THEN
        v_non_winner_kills := v_non_winner_kills + 1;
      END IF;
    END IF;

    v_log_arr := v_log_arr || jsonb_build_array(jsonb_build_object(
      'round',    i,
      'attacker', v_chars[v_atk_idx],
      'target',   v_chars[v_target_idx],
      'damage',   v_damage,
      'hp', jsonb_build_object(
        'nova',   v_hp[1], 'shadow', v_hp[2],
        'titan',  v_hp[3], 'blaze',  v_hp[4]
      )
    ));
  END LOOP;

  WHILE v_alive_count > 2 AND v_non_winner_kills < 2 LOOP
    v_non_winner_alive := ARRAY[]::int[];
    FOR k IN 1..4 LOOP
      IF v_hp[k] > 0 AND k <> v_winner_idx THEN
        v_non_winner_alive := array_append(v_non_winner_alive, k);
      END IF;
    END LOOP;

    EXIT WHEN array_length(v_non_winner_alive, 1) < 2;

    v_byte := get_byte(v_hash_bytes, (j % 32)); j := j + 1;
    v_atk_idx := v_non_winner_alive[1 + (v_byte % array_length(v_non_winner_alive, 1))];

    v_non_winner_alive := ARRAY[]::int[];
    FOR k IN 1..4 LOOP
      IF v_hp[k] > 0 AND k <> v_winner_idx AND k <> v_atk_idx THEN
        v_non_winner_alive := array_append(v_non_winner_alive, k);
      END IF;
    END LOOP;
    EXIT WHEN array_length(v_non_winner_alive, 1) < 1;

    v_byte := get_byte(v_hash_bytes, (j % 32)); j := j + 1;
    v_target_idx := v_non_winner_alive[1 + (v_byte % array_length(v_non_winner_alive, 1))];

    v_byte   := get_byte(v_hash_bytes, (j % 32)); j := j + 1;
    v_damage := LEAST(v_hp[v_target_idx], 22 + (v_byte % 18));

    v_hp[v_target_idx] := GREATEST(0, v_hp[v_target_idx] - v_damage);
    IF v_hp[v_target_idx] = 0 THEN
      v_alive_count := v_alive_count - 1;
      v_non_winner_kills := v_non_winner_kills + 1;
    END IF;

    v_log_arr := v_log_arr || jsonb_build_array(jsonb_build_object(
      'round',    9000 + v_non_winner_kills,
      'attacker', v_chars[v_atk_idx],
      'target',   v_chars[v_target_idx],
      'damage',   v_damage,
      'hp', jsonb_build_object(
        'nova',   v_hp[1], 'shadow', v_hp[2],
        'titan',  v_hp[3], 'blaze',  v_hp[4]
      )
    ));
  END LOOP;

  FOR k IN 1..4 LOOP
    IF k <> v_winner_idx AND v_hp[k] > 0 THEN
      v_byte   := get_byte(v_hash_bytes, (j % 32)); j := j + 1;
      v_damage := v_hp[k];
      v_hp[k]  := 0;
      v_log_arr := v_log_arr || jsonb_build_array(jsonb_build_object(
        'round',    9500 + k,
        'attacker', v_chars[v_winner_idx],
        'target',   v_chars[k],
        'damage',   v_damage,
        'finisher', true,
        'hp', jsonb_build_object(
          'nova',   v_hp[1], 'shadow', v_hp[2],
          'titan',  v_hp[3], 'blaze',  v_hp[4]
        )
      ));
    END IF;
  END LOOP;

  v_combat_log := v_log_arr;

  SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
    INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
    FROM public._debit_bet(p_user_id, p_bet_amount) db;

  v_round_payload := jsonb_build_object(
    'character_bet', p_character,
    'winner',        v_winner,
    'won',           v_won,
    'multiplier',    v_multiplier,
    'payout',        v_payout,
    'bet_amount',    p_bet_amount,
    'odds_snapshot', jsonb_build_object(
      'nova',   v_odds[1], 'shadow', v_odds[2],
      'titan',  v_odds[3], 'blaze',  v_odds[4]
    ),
    'combat_log',    v_combat_log,
    'server_seed',   v_server_seed,
    'server_seed_hash', v_server_seed_hash
  );

  INSERT INTO public.arena_rounds (
    user_id, bet_amount, character_bet, winner, won, multiplier, payout,
    odds_snapshot, combat_log, server_seed, server_seed_hash, client_action_id
  ) VALUES (
    p_user_id, p_bet_amount, p_character, v_winner, v_won, v_multiplier, v_payout,
    jsonb_build_object(
      'nova', v_odds[1], 'shadow', v_odds[2],
      'titan', v_odds[3], 'blaze', v_odds[4]
    ),
    v_combat_log, v_server_seed, v_server_seed_hash, p_client_action_id
  ) RETURNING id INTO v_round_id;

  INSERT INTO public.transactions (
    user_id, type, amount, balance_after, game, client_action_id, meta
  ) VALUES (
    p_user_id, 'bet'::transaction_type, -p_bet_amount, v_new_balance, 'arena', p_client_action_id,
    jsonb_build_object(
      'kind',             'arena_bet',
      'server_seed_hash', v_server_seed_hash,
      'server_seed',      v_server_seed,
      'bet_amount',       p_bet_amount,
      'character',        p_character,
      'from_bonus',       v_from_bonus,
      'from_real',        v_from_real,
      'result',           v_round_payload,
      'round_id',         v_round_id
    )
  ) RETURNING id INTO v_bet_tx_id;

  IF v_payout > 0 THEN
    SELECT cw.new_balance INTO v_new_balance
      FROM public._credit_win(p_user_id, v_payout) cw;

    INSERT INTO public.transactions (
      user_id, type, amount, balance_after, game, client_action_id, meta
    ) VALUES (
      p_user_id, 'win'::transaction_type, v_payout, v_new_balance, 'arena', NULL,
      jsonb_build_object(
        'kind',          'arena_win',
        'bet_tx_id',     v_bet_tx_id,
        'bet_action_id', p_client_action_id,
        'multiplier',    v_multiplier,
        'winner',        v_winner,
        'to_real',       v_payout,
        'round_id',      v_round_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'was_duplicate', false,
    'new_balance',   v_new_balance,
    'round_id',      v_round_id,
    'cached',        v_round_payload
  );
END;
$function$;
