-- ============================================================
-- Ruleta tradicional: casillas + pagos + giro con apuestas múltiples
-- ============================================================

CREATE OR REPLACE FUNCTION public._roulette_bet_cells(p_type text, p_key text)
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_parts text[];
  a int;
  b int;
  r int;
  c int;
  v_out int[];
BEGIN
  IF p_key IS NULL THEN
    RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE = 'P0001';
  END IF;

  CASE p_type
    WHEN 'straight' THEN
      IF p_key !~ '^\d{1,2}$' THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      a := p_key::int;
      IF a < 0 OR a > 36 THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      RETURN ARRAY[a];

    WHEN 'split' THEN
      v_parts := string_to_array(p_key, '-');
      IF array_length(v_parts, 1) <> 2
         OR v_parts[1] !~ '^\d{1,2}$' OR v_parts[2] !~ '^\d{1,2}$' THEN
        RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001';
      END IF;
      a := v_parts[1]::int;
      b := v_parts[2]::int;
      IF a < 1 OR b < 1 OR a > 36 OR b > 36 OR b <= a THEN
        RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001';
      END IF;
      -- adyacencia: horizontal (misma calle) o vertical
      IF NOT ((b = a + 1 AND (a % 3) <> 0) OR b = a + 3) THEN
        RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001';
      END IF;
      RETURN ARRAY[a, b];

    WHEN 'street' THEN
      IF p_key !~ '^\d{1,2}$' THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      r := p_key::int;
      IF r < 1 OR r > 12 THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      RETURN ARRAY[3*r-2, 3*r-1, 3*r];

    WHEN 'corner' THEN
      IF p_key !~ '^\d{1,2}$' THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      a := p_key::int;
      IF a < 1 OR a > 32 OR (a % 3) = 0 THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      RETURN ARRAY[a, a+1, a+3, a+4];

    WHEN 'line' THEN
      IF p_key !~ '^\d{1,2}$' THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      r := p_key::int;
      IF r < 1 OR r > 11 THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      RETURN ARRAY[3*r-2, 3*r-1, 3*r, 3*r+1, 3*r+2, 3*r+3];

    WHEN 'dozen' THEN
      IF p_key !~ '^\d$' THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      r := p_key::int;
      IF r < 1 OR r > 3 THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      SELECT array_agg(g ORDER BY g) INTO v_out FROM generate_series(12*r-11, 12*r) g;
      RETURN v_out;

    WHEN 'column' THEN
      IF p_key !~ '^\d$' THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      c := p_key::int;
      IF c < 1 OR c > 3 THEN RAISE EXCEPTION 'invalid_bet_key' USING ERRCODE='P0001'; END IF;
      SELECT array_agg(g ORDER BY g) INTO v_out
        FROM generate_series(1, 36) g WHERE (g % 3) = (c % 3);
      RETURN v_out;

    WHEN 'red' THEN
      RETURN ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

    WHEN 'black' THEN
      RETURN ARRAY[2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

    WHEN 'even' THEN
      SELECT array_agg(g ORDER BY g) INTO v_out FROM generate_series(1,36) g WHERE g % 2 = 0;
      RETURN v_out;

    WHEN 'odd' THEN
      SELECT array_agg(g ORDER BY g) INTO v_out FROM generate_series(1,36) g WHERE g % 2 = 1;
      RETURN v_out;

    WHEN 'low' THEN
      SELECT array_agg(g ORDER BY g) INTO v_out FROM generate_series(1,18) g;
      RETURN v_out;

    WHEN 'high' THEN
      SELECT array_agg(g ORDER BY g) INTO v_out FROM generate_series(19,36) g;
      RETURN v_out;

    ELSE
      RAISE EXCEPTION 'invalid_bet_type' USING ERRCODE='P0001';
  END CASE;
END;
$function$;

-- Pagos europeos estándar (retorno total incluida la apuesta).
-- El pleno al 0 se escala por el peso del verde para conservar la ventaja de casa.
CREATE OR REPLACE FUNCTION public._roulette_bet_multiplier(p_type text, p_key text, p_green_weight numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE p_type
    WHEN 'straight' THEN
      CASE WHEN p_key = '0'
        THEN ROUND(36.0 / GREATEST(COALESCE(p_green_weight, 1.0), 1.0), 2)
        ELSE 36.0 END
    WHEN 'split'  THEN 18.0
    WHEN 'street' THEN 12.0
    WHEN 'corner' THEN 9.0
    WHEN 'line'   THEN 6.0
    WHEN 'dozen'  THEN 3.0
    WHEN 'column' THEN 3.0
    ELSE 2.0
  END;
$function$;

-- ============================================================
-- Giro con apuestas múltiples
-- p_bets: [{ "type": "...", "key": "...", "amount": 1000 }, ...]
-- ============================================================
CREATE OR REPLACE FUNCTION public.spin_roulette_multi_v1(p_bets jsonb, p_client_action_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();

  v_min_bet   numeric := 500;
  v_bet_step  numeric := 500;
  v_max_total numeric := 500000;
  v_max_bets  int     := 40;

  v_red_numbers int[] := ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  v_outside_types text[] := ARRAY['red','black','even','odd','low','high','dozen','column'];

  v_existing_tx public.transactions%ROWTYPE;
  v_current_balance numeric;

  v_item        jsonb;
  v_type        text;
  v_key         text;
  v_amount      numeric;
  v_cells       int[];
  v_mult        numeric;
  v_seen        text[] := '{}';
  v_norm        jsonb  := '[]'::jsonb;
  v_total       numeric := 0;
  v_outside     int[]  := '{}';
  v_count       int    := 0;

  v_green_weight    numeric;
  v_green_threshold int;
  v_total_weight    int;
  v_rejection_limit int;
  v_bytes           bytea;
  v_random_int      int;
  v_pick            int;
  v_segment         int;
  v_winning_color   text;
  v_payout          numeric := 0;
  v_won             boolean := false;
  v_boost           boolean;
  v_settled         jsonb := '[]'::jsonb;
  v_bet_payout      numeric;

  v_new_balance numeric;
  v_new_bonus   numeric;
  v_from_bonus  numeric;
  v_from_real   numeric;
  v_bet_tx_id   uuid;
  v_result      jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  -- Idempotencia
  SELECT * INTO v_existing_tx
    FROM public.transactions
   WHERE user_id = v_uid AND client_action_id = p_client_action_id
   LIMIT 1;
  IF FOUND THEN
    SELECT balance INTO v_current_balance FROM public.user_balances WHERE user_id = v_uid;
    RETURN jsonb_build_object(
      'was_duplicate', true,
      'new_balance',   v_current_balance,
      'cached',        COALESCE(v_existing_tx.meta -> 'result', '{}'::jsonb)
    );
  END IF;

  IF p_bets IS NULL OR jsonb_typeof(p_bets) <> 'array' OR jsonb_array_length(p_bets) = 0 THEN
    RAISE EXCEPTION 'no_bets' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_bets) > v_max_bets THEN
    RAISE EXCEPTION 'too_many_bets' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(green_weight, 1.0) INTO v_green_weight FROM public.roulette_config LIMIT 1;
  IF v_green_weight IS NULL THEN v_green_weight := 1.0; END IF;
  IF v_green_weight < 1.0 THEN v_green_weight := 1.0; END IF;

  -- Validación y normalización de cada ficha
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_bets) LOOP
    v_type   := v_item ->> 'type';
    v_key    := COALESCE(v_item ->> 'key', '');
    v_amount := (v_item ->> 'amount')::numeric;

    IF v_amount IS NULL OR v_amount < v_min_bet OR (v_amount % v_bet_step) <> 0 THEN
      RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
    END IF;

    IF (v_type || ':' || v_key) = ANY (v_seen) THEN
      RAISE EXCEPTION 'duplicate_bet' USING ERRCODE = 'P0001';
    END IF;
    v_seen := v_seen || (v_type || ':' || v_key);

    v_cells := public._roulette_bet_cells(v_type, v_key);
    v_mult  := public._roulette_bet_multiplier(v_type, v_key, v_green_weight);

    IF v_type = ANY (v_outside_types) THEN
      v_outside := v_outside || v_cells;
    END IF;

    v_total := v_total + v_amount;
    v_count := v_count + 1;
    v_norm := v_norm || jsonb_build_object(
      'type', v_type, 'key', v_key, 'amount', v_amount,
      'cells', to_jsonb(v_cells), 'multiplier', v_mult
    );
  END LOOP;

  IF v_total < v_min_bet OR v_total > v_max_total THEN
    RAISE EXCEPTION 'invalid_bet' USING ERRCODE = 'P0001';
  END IF;

  -- Sorteo del número ganador: peso(0) = green_weight*100, peso(n>0) = 100
  v_green_threshold := (v_green_weight * 100)::int;
  v_total_weight    := v_green_threshold + 3600;
  v_rejection_limit := v_total_weight * (65536 / v_total_weight);

  LOOP
    v_bytes := gen_random_bytes(2);
    v_random_int := (get_byte(v_bytes, 0) << 8) | get_byte(v_bytes, 1);
    EXIT WHEN v_random_int < v_rejection_limit;
  END LOOP;
  v_pick := v_random_int % v_total_weight;

  IF v_pick < v_green_threshold THEN
    v_segment := 0;
  ELSE
    v_segment := 1 + ((v_pick - v_green_threshold) / 100);
    IF v_segment > 36 THEN v_segment := 36; END IF;
  END IF;

  -- Liquidación
  v_settled := '[]'::jsonb;
  v_payout := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_norm) LOOP
    v_bet_payout := 0;
    IF v_segment = ANY (ARRAY(SELECT jsonb_array_elements_text(v_item -> 'cells')::int)) THEN
      v_bet_payout := ROUND((v_item ->> 'amount')::numeric * (v_item ->> 'multiplier')::numeric);
      v_payout := v_payout + v_bet_payout;
    END IF;
    v_settled := v_settled || (v_item || jsonb_build_object('payout', v_bet_payout));
  END LOOP;

  -- BOOST: si perdió todo y tiene apuestas exteriores, se fuerza un número de esas apuestas
  v_boost := public.is_boost_target(v_uid, 'ruleta');
  IF v_boost AND v_payout = 0 AND COALESCE(array_length(v_outside, 1), 0) > 0 THEN
    v_segment := v_outside[1 + (get_byte(gen_random_bytes(1), 0) % array_length(v_outside, 1))];
    v_settled := '[]'::jsonb;
    v_payout := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_norm) LOOP
      v_bet_payout := 0;
      IF v_segment = ANY (ARRAY(SELECT jsonb_array_elements_text(v_item -> 'cells')::int)) THEN
        v_bet_payout := ROUND((v_item ->> 'amount')::numeric * (v_item ->> 'multiplier')::numeric);
        v_payout := v_payout + v_bet_payout;
      END IF;
      v_settled := v_settled || (v_item || jsonb_build_object('payout', v_bet_payout));
    END LOOP;
  END IF;

  v_winning_color := CASE
    WHEN v_segment = 0 THEN 'green'
    WHEN v_segment = ANY (v_red_numbers) THEN 'red'
    ELSE 'black'
  END;
  v_won := v_payout > 0;

  SELECT db.new_balance, db.new_bonus, db.from_bonus, db.from_real
    INTO v_new_balance, v_new_bonus, v_from_bonus, v_from_real
    FROM public._debit_bet(v_uid, v_total) db;

  v_result := jsonb_build_object(
    'winning_segment', v_segment,
    'winning_color',   v_winning_color,
    'won',             v_won,
    'payout',          v_payout,
    'total_bet',       v_total,
    'bet_count',       v_count,
    'bets',            v_settled,
    'green_weight',    v_green_weight
  );

  INSERT INTO public.transactions (
    user_id, type, amount, balance_after, game, client_action_id, meta
  ) VALUES (
    v_uid, 'bet'::transaction_type, -v_total, v_new_balance, 'ruleta', p_client_action_id,
    jsonb_build_object(
      'kind',       'roulette_multi_bet',
      'bet_amount', v_total,
      'from_bonus', v_from_bonus,
      'from_real',  v_from_real,
      'result',     v_result
    )
  ) RETURNING id INTO v_bet_tx_id;

  IF v_payout > 0 THEN
    SELECT cw.new_balance INTO v_new_balance
      FROM public._credit_win(v_uid, v_payout) cw;

    INSERT INTO public.transactions (
      user_id, type, amount, balance_after, game, client_action_id, meta
    ) VALUES (
      v_uid, 'win'::transaction_type, v_payout, v_new_balance, 'ruleta', NULL,
      jsonb_build_object(
        'kind',            'roulette_multi_win',
        'bet_tx_id',       v_bet_tx_id,
        'bet_action_id',   p_client_action_id,
        'multiplier',      ROUND(v_payout / NULLIF(v_total, 0), 4),
        'winning_segment', v_segment,
        'winning_color',   v_winning_color,
        'to_real',         v_payout
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

REVOKE ALL ON FUNCTION public.spin_roulette_multi_v1(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_roulette_multi_v1(jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._roulette_bet_cells(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._roulette_bet_multiplier(text, text, numeric) TO authenticated, service_role;