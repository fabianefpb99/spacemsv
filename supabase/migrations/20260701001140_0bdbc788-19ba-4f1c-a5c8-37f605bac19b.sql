-- ============================================================
-- P0 + P1 security hardening batch
-- ============================================================

-- ------------------------------------------------------------
-- C-1: spaceman_cashout — cap client elapsed at server elapsed
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spaceman_cashout(
  p_round_id uuid,
  p_client_action_id uuid,
  p_client_elapsed_ms numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- HARDENING: client value can only reduce, never inflate, effective ms.
  -- LEAST(client, server) prevents multiplier boost via clock manipulation.
  IF p_client_elapsed_ms IS NULL OR p_client_elapsed_ms < 0 THEN
    v_effective_ms := v_server_elapsed_ms;
  ELSE
    v_effective_ms := LEAST(p_client_elapsed_ms, v_server_elapsed_ms);
  END IF;

  IF v_effective_ms >= v_crash_elapsed_ms THEN
    UPDATE public.game_bets SET status = 'lost', payout = 0, settled_at = now() WHERE id = v_bet.id;
    RAISE EXCEPTION 'crashed_before_cashout' USING ERRCODE = 'P0001';
  END IF;

  v_mult   := public.spaceman_mult_at_ms(v_effective_ms);
  v_payout := ROUND(v_bet.amount * v_mult);

  SELECT cw.new_balance INTO v_new_balance
    FROM public._credit_win(v_user_id, v_payout) cw;

  UPDATE public.game_bets
     SET status = 'cashed_out',
         cashout_multiplier = v_mult,
         payout = v_payout,
         settled_at = now()
   WHERE id = v_bet.id;

  RETURN jsonb_build_object(
    'was_duplicate',      false,
    'cashout_multiplier', v_mult,
    'payout',             v_payout,
    'new_balance',        v_new_balance
  );
END
$function$;

-- ------------------------------------------------------------
-- C-3: profiles trigger — restore ALL sensitive KYC/document cols
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._profiles_lock_sensitive_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := false;
  v_is_service boolean := (current_setting('role', true) = 'service_role');
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  END IF;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Restore all sensitive columns for regular users.
  NEW.verification_status  := OLD.verification_status;
  NEW.is_blocked           := OLD.is_blocked;
  NEW.referred_by          := OLD.referred_by;
  NEW.referral_code        := OLD.referral_code;
  NEW.first_deposit_at     := OLD.first_deposit_at;
  NEW.vip_last_seen_level  := OLD.vip_last_seen_level;
  -- KYC/document fields — must never be self-edited after admin sets them.
  NEW.document_type        := OLD.document_type;
  NEW.document_number      := OLD.document_number;
  NEW.document_issue_date  := OLD.document_issue_date;
  NEW.birth_date           := OLD.birth_date;
  NEW.gender               := OLD.gender;

  RETURN NEW;
END
$function$;

-- ------------------------------------------------------------
-- A-3: revoke authenticated EXECUTE on admin RPCs
-- (SQL body still checks has_role internally; this is defense in depth
--  — TS handlers call them via supabaseAdmin/service_role.)
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_xp(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_block(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_rtp(text, numeric, boolean) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- A-7: play_arena_v2 generates odds_perm server-side, ignores client input
-- Fisher-Yates shuffle using gen_random_bytes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.play_arena_v2(
  p_bet_amount numeric,
  p_character text,
  p_client_action_id uuid,
  p_odds_perm integer[] DEFAULT NULL::integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perm int[] := ARRAY[1,2,3,4];
  v_i int;
  v_j int;
  v_tmp int;
  v_byte int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  -- Ignore client-provided p_odds_perm — attacker could pick most-favourable mapping.
  -- Fisher-Yates on [1,2,3,4] using cryptographic RNG. Rejection sampling per position.
  FOR v_i IN REVERSE 4..2 LOOP
    LOOP
      v_byte := get_byte(gen_random_bytes(1), 0);
      -- reject bytes that would bias modulo (accept < floor(256/v_i)*v_i)
      EXIT WHEN v_byte < (256 / v_i) * v_i;
    END LOOP;
    v_j := 1 + (v_byte % v_i);
    v_tmp := v_perm[v_i];
    v_perm[v_i] := v_perm[v_j];
    v_perm[v_j] := v_tmp;
  END LOOP;

  RETURN public.play_arena_v1(v_uid, p_bet_amount, p_character, p_client_action_id, v_perm);
END;
$function$;