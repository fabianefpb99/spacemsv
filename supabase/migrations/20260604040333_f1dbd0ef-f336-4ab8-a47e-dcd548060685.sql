
INSERT INTO public.game_rtp_config (game, rtp_target, rtp_baseline, is_active)
VALUES ('ruleta', 97.3, 97.3, true)
ON CONFLICT (game) DO NOTHING;

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
  v_multiplier := CASE
    WHEN v_won AND p_choice = 'green' THEN 14.0
    WHEN v_won THEN 1.95
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
