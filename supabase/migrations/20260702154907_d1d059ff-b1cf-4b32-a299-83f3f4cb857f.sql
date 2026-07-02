CREATE TABLE public.roulette_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  green_weight numeric NOT NULL DEFAULT 1.0 CHECK (green_weight >= 1.0 AND green_weight <= 5.0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roulette_config TO authenticated;
GRANT ALL ON public.roulette_config TO service_role;

ALTER TABLE public.roulette_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage roulette config" ON public.roulette_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read roulette config" ON public.roulette_config
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anon users can read roulette config" ON public.roulette_config
  FOR SELECT TO anon
  USING (true);

INSERT INTO public.roulette_config (green_weight, updated_at, updated_by)
VALUES (1.0, now(), NULL)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.spin_roulette_v1(
  p_user_id uuid,
  p_bet_amount numeric,
  p_choice text,
  p_client_action_id uuid
) RETURNS jsonb
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

  v_green_weight    numeric;
  v_total_weight    int;
  v_green_threshold int;
  v_red_threshold   int;
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

  -- Leer peso configurable del verde (default 1.0 si no hay fila)
  SELECT COALESCE(green_weight, 1.0) INTO v_green_weight
    FROM public.roulette_config
   LIMIT 1;
  IF v_green_weight IS NULL THEN
    v_green_weight := 1.0;
  END IF;

  -- Pesos: rojo = 18, negro = 18, verde = green_weight
  -- Multiplicamos por 100 para trabajar con enteros y mantener un decimal de precisión.
  v_green_threshold := (v_green_weight * 100)::int;
  v_red_threshold   := v_green_threshold + 1800; -- 18 * 100
  v_total_weight    := v_red_threshold + 1800;     -- 36 + green_weight, en centésimas

  v_server_seed      := encode(gen_random_bytes(32), 'hex');
  v_server_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

  LOOP
    v_byte := get_byte(gen_random_bytes(1), 0);
    EXIT WHEN v_byte < v_total_weight;
  END LOOP;

  IF v_byte < v_green_threshold THEN
    v_segment := 0;
    v_winning_color := 'green';
  ELSIF v_byte < v_red_threshold THEN
    v_byte := get_byte(gen_random_bytes(1), 0);
    v_segment := v_red_numbers[1 + (v_byte % array_length(v_red_numbers, 1))];
    v_winning_color := 'red';
  ELSE
    v_byte := get_byte(gen_random_bytes(1), 0);
    v_segment := v_black_numbers[1 + (v_byte % array_length(v_black_numbers, 1))];
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
    'server_seed_hash', v_server_seed_hash,
    'green_weight',    v_green_weight
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