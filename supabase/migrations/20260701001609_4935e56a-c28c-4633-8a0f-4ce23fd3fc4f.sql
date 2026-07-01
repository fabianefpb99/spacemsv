-- M-2: claim_vip_reward — set claimed_at BEFORE side-effects.
CREATE OR REPLACE FUNCTION public.claim_vip_reward(p_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  public.user_vip_rewards%ROWTYPE;
  v_new_bonus numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
    FROM public.user_vip_rewards
   WHERE id = p_reward_id
     AND user_id = v_user
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_claimed', true);
  END IF;

  UPDATE public.user_vip_rewards
     SET claimed_at = now()
   WHERE id = p_reward_id;

  IF v_row.reward_kind = 'bonus' AND v_row.reward_amount > 0 THEN
    INSERT INTO public.user_balances(user_id, bonus_balance)
      VALUES (v_user, v_row.reward_amount)
      ON CONFLICT (user_id) DO UPDATE
        SET bonus_balance = public.user_balances.bonus_balance + EXCLUDED.bonus_balance,
            updated_at = now()
      RETURNING bonus_balance INTO v_new_bonus;

    INSERT INTO public.transactions (user_id, type, amount, meta)
    VALUES (v_user, 'bonus', v_row.reward_amount,
      jsonb_build_object(
        'source','vip_rank_reward',
        'rank', v_row.rank,
        'sub_division', v_row.sub_division,
        'reward_id', v_row.id
      ));
  ELSIF v_row.reward_kind = 'avatar' THEN
    NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'kind', v_row.reward_kind,
    'amount', v_row.reward_amount,
    'avatar_key', v_row.reward_avatar_key,
    'new_bonus_balance', v_new_bonus
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_vip_reward(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_vip_reward(uuid) TO authenticated;

-- M-4: Strip PII from deposit_requests realtime publication.
ALTER PUBLICATION supabase_realtime DROP TABLE public.deposit_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests
  (id, user_id, amount, bonus, method, reference, status, payer_self,
   reject_reason, approved_by, approved_at, rejected_by, rejected_at,
   prev_balance, new_balance, bonus_applied, confirmed_at, expires_at,
   created_at, updated_at);

-- M-5: Cap admin_adjust_balance delta at ±10,000,000.
-- DROP then CREATE because the return signature is being reshaped
-- (Postgres forbids in-place changes via CREATE OR REPLACE when a
-- default or RETURNS structure changes).
DROP FUNCTION IF EXISTS public.admin_adjust_balance(uuid, numeric, text, text);
CREATE FUNCTION public.admin_adjust_balance(
  p_target_user_id uuid,
  p_delta numeric,
  p_target text,
  p_reason text
)
RETURNS TABLE(new_balance numeric, new_bonus numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_bal numeric;
  v_bonus numeric;
  v_max_delta constant numeric := 10000000;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  IF p_target NOT IN ('real','bonus') THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = 'P0001';
  END IF;

  IF p_delta IS NULL OR abs(p_delta) > v_max_delta THEN
    RAISE EXCEPTION 'delta_out_of_range' USING ERRCODE = 'P0001';
  END IF;

  SELECT balance, bonus_balance INTO v_bal, v_bonus
    FROM public.user_balances WHERE user_id = p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.user_balances (user_id, balance, bonus_balance)
    VALUES (p_target_user_id, 0, 0);
    v_bal := 0; v_bonus := 0;
  END IF;

  IF p_target = 'real' THEN
    v_bal := COALESCE(v_bal,0) + p_delta;
    IF v_bal < 0 THEN RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.user_balances SET balance = v_bal, updated_at = now() WHERE user_id = p_target_user_id;
  ELSE
    v_bonus := COALESCE(v_bonus,0) + p_delta;
    IF v_bonus < 0 THEN RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.user_balances SET bonus_balance = v_bonus, updated_at = now() WHERE user_id = p_target_user_id;
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
  VALUES (
    p_target_user_id,
    CASE WHEN p_delta >= 0 THEN 'deposit'::transaction_type ELSE 'withdrawal'::transaction_type END,
    p_delta,
    v_bal,
    NULL,
    jsonb_build_object('kind','admin_adjustment','target',p_target,'reason',p_reason,'admin_id',v_admin)
  );

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'adjust_balance', p_target_user_id,
          jsonb_build_object('delta',p_delta,'target',p_target,'reason',p_reason,
                             'new_balance',v_bal,'new_bonus',v_bonus));

  RETURN QUERY SELECT v_bal, v_bonus;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text, text) TO service_role;

-- M-7: Drop deprecated v1 RPCs (replaced by v2).
DROP FUNCTION IF EXISTS public.play_arena_v1(uuid, numeric, text, uuid, integer[]);
DROP FUNCTION IF EXISTS public.spin_roulette_v1(uuid, numeric, text, uuid);