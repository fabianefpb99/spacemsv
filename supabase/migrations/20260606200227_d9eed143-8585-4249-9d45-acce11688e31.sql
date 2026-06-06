CREATE OR REPLACE FUNCTION public.play_arena_v1(
  p_user_id uuid,
  p_bet_amount numeric,
  p_character text,
  p_client_action_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_min_bet  numeric := 500;
  v_max_bet  numeric := 500000;
  v_bet_step numeric := 500;

  v_chars text[]   := ARRAY['nova','shadow','titan','blaze'];
  v_odds  numeric[] := ARRAY[2.30, 3.50, 4.80, 6.50];
  v_weights int[]  := ARRAY[424, 279, 203, 140];
  v_total_w int    := 1046;

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
  i int; j int; k int; m int;
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

  v_acc := 0;
  FOR k IN 1..array_length(v_weights, 1) LOOP
    v_acc := v_acc + v_weights[k];
    IF v_pick < v_acc THEN
      v_winner_idx := k;
      EXIT;
    END IF;
  END LOOP;
  v_winner := v_chars[v_winner_idx];

  v_won := (v_winner = p_character);
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
    v_damage := LEAST(v_hp[v_target_idx], 22 + (v_byte % 19));

    v_hp[v_target_idx] := GREATEST(0, v_hp[v_target_idx] - v_damage);
    IF v_hp[v_target_idx] = 0 THEN
      v_alive_count := v_alive_count - 1;
      v_non_winner_kills := v_non_winner_kills + 1;
    END IF;

    v_log_arr := v_log_arr || jsonb_build_array(jsonb_build_object(
      'round',    jsonb_array_length(v_log_arr) + 1,
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
    IF v_chars[k] <> v_winner AND v_hp[k] > 0 THEN
      v_log_arr := v_log_arr || jsonb_build_array(jsonb_build_object(
        'round',    jsonb_array_length(v_log_arr) + 1,
        'attacker', v_winner,
        'target',   v_chars[k],
        'damage',   v_hp[k],
        'hp', jsonb_build_object(
          'nova',   CASE WHEN v_chars[k]='nova'   THEN 0 ELSE v_hp[1] END,
          'shadow', CASE WHEN v_chars[k]='shadow' THEN 0 ELSE v_hp[2] END,
          'titan',  CASE WHEN v_chars[k]='titan'  THEN 0 ELSE v_hp[3] END,
          'blaze',  CASE WHEN v_chars[k]='blaze'  THEN 0 ELSE v_hp[4] END
        ),
        'finisher', true
      ));
      v_hp[k] := 0;
    END IF;
  END LOOP;

  v_combat_log := v_log_arr;

  v_round_payload := jsonb_build_object(
    'character_bet',  p_character,
    'winner',         v_winner,
    'won',            v_won,
    'multiplier',     v_multiplier,
    'payout',         v_payout,
    'bet_amount',     p_bet_amount,
    'odds_snapshot',  jsonb_build_object(
      'nova',v_odds[1],'shadow',v_odds[2],'titan',v_odds[3],'blaze',v_odds[4]
    ),
    'combat_log',     v_combat_log,
    'server_seed',    v_server_seed,
    'server_seed_hash', v_server_seed_hash
  );

  SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
    INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
    FROM public._debit_bet(p_user_id, p_bet_amount) db;

  INSERT INTO public.arena_rounds (
    user_id, bet_amount, character_bet, odds_snapshot, winner, won,
    multiplier, payout, combat_log, server_seed, server_seed_hash, client_action_id
  ) VALUES (
    p_user_id, p_bet_amount, p_character,
    jsonb_build_object('nova',v_odds[1],'shadow',v_odds[2],'titan',v_odds[3],'blaze',v_odds[4]),
    v_winner, v_won, v_multiplier, v_payout, v_combat_log,
    v_server_seed, v_server_seed_hash, p_client_action_id
  ) RETURNING id INTO v_round_id;

  INSERT INTO public.transactions (
    user_id, type, amount, balance_after, game, client_action_id, meta
  ) VALUES (
    p_user_id, 'bet'::transaction_type, -p_bet_amount, v_new_balance, 'arena', p_client_action_id,
    jsonb_build_object(
      'kind',             'arena_bet',
      'round_id',         v_round_id,
      'server_seed_hash', v_server_seed_hash,
      'server_seed',      v_server_seed,
      'bet_amount',       p_bet_amount,
      'character',        p_character,
      'from_bonus',       v_from_bonus,
      'from_real',        v_from_real,
      'result',           v_round_payload
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
        'round_id',      v_round_id,
        'bet_tx_id',     v_bet_tx_id,
        'bet_action_id', p_client_action_id,
        'multiplier',    v_multiplier,
        'winner',        v_winner,
        'character_bet', p_character,
        'to_real',       v_payout
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
$$;