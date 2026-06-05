-- ============================================================================
-- ARENA backend
-- ============================================================================

CREATE TABLE public.arena_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bet_amount numeric NOT NULL,
  character_bet text NOT NULL,
  odds_snapshot jsonb NOT NULL,
  winner text NOT NULL,
  won boolean NOT NULL,
  multiplier numeric NOT NULL,
  payout numeric NOT NULL DEFAULT 0,
  combat_log jsonb NOT NULL,
  server_seed text NOT NULL,
  server_seed_hash text NOT NULL,
  client_action_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_arena_rounds_user_created ON public.arena_rounds(user_id, created_at DESC);
CREATE INDEX idx_arena_rounds_created ON public.arena_rounds(created_at DESC);

GRANT SELECT ON public.arena_rounds TO authenticated;
GRANT ALL ON public.arena_rounds TO service_role;

ALTER TABLE public.arena_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own arena rounds"
  ON public.arena_rounds FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO public.game_rtp_config (game, rtp_target, rtp_baseline, is_active)
VALUES ('arena', 91.5, 91.5, true)
ON CONFLICT (game) DO NOTHING;

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
  -- Probs: 0.424 / 0.279 / 0.203 / 0.140  (suma 1.046 → RTP 91.5%)
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

  v_rounds_n         int;
  v_hp               int[] := ARRAY[100,100,100,100];
  v_atk_idx          int;
  v_target_idx       int;
  v_damage           int;
  v_alive_count      int;
  v_log_arr          jsonb := '[]'::jsonb;
  i int; j int; k int;
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

  -- Combat log determinístico desde el seed
  v_hash_bytes := digest(v_server_seed || '|combat', 'sha256');
  v_rounds_n := 3 + (get_byte(v_hash_bytes, 0) % 4);
  j := 1;
  v_alive_count := 4;
  FOR i IN 1..v_rounds_n LOOP
    EXIT WHEN v_alive_count <= 1;
    v_byte := get_byte(v_hash_bytes, (j % 32));
    j := j + 1;
    v_atk_idx := 1 + (v_byte % 4);
    FOR k IN 0..3 LOOP
      IF v_hp[((v_atk_idx - 1 + k) % 4) + 1] > 0 THEN
        v_atk_idx := ((v_atk_idx - 1 + k) % 4) + 1;
        EXIT;
      END IF;
    END LOOP;
    v_byte := get_byte(v_hash_bytes, (j % 32));
    j := j + 1;
    v_target_idx := 1 + (v_byte % 4);
    FOR k IN 0..3 LOOP
      v_target_idx := ((v_target_idx - 1 + k) % 4) + 1;
      EXIT WHEN v_target_idx <> v_atk_idx AND v_hp[v_target_idx] > 0;
    END LOOP;
    IF v_target_idx = v_atk_idx OR v_hp[v_target_idx] <= 0 THEN
      CONTINUE;
    END IF;
    v_byte := get_byte(v_hash_bytes, (j % 32));
    j := j + 1;
    v_damage := 15 + (v_byte % 26);
    v_hp[v_target_idx] := GREATEST(0, v_hp[v_target_idx] - v_damage);
    IF v_hp[v_target_idx] = 0 THEN
      v_alive_count := v_alive_count - 1;
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

  -- Asegurar que solo el ganador queda vivo
  FOR k IN 1..4 LOOP
    IF v_chars[k] <> v_winner AND v_hp[k] > 0 THEN
      v_log_arr := v_log_arr || jsonb_build_array(jsonb_build_object(
        'round',    v_rounds_n + k,
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