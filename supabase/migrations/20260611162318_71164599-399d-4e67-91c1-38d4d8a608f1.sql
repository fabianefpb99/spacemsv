
-- Expand allowed trigger_event values
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_trigger_event_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_trigger_event_check
  CHECK (trigger_event = ANY (ARRAY['bet_placed'::text, 'bet_won'::text, 'deposit_made'::text, 'manual'::text, 'referral_redeemed'::text]));

-- Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_deposit_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- Code generator
CREATE OR REPLACE FUNCTION public._gen_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_exists boolean;
BEGIN
  LOOP
    v_code := '';
    FOR v_i IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(gen_random_bytes(1),0) % length(v_alphabet)), 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public._gen_referral_code() WHERE id = r.id;
  END LOOP;
END$$;

-- Trigger to assign on insert
CREATE OR REPLACE FUNCTION public._assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public._gen_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.profiles;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._assign_referral_code();

-- Update mission to trigger via referral event
UPDATE public.missions
  SET trigger_event = 'referral_redeemed',
      metric = 'count',
      goal = 1,
      reward_kind = 'bonus',
      reward_value = 3000,
      reward_label = '3.000 Bonus'
  WHERE id = '96c273da-4d29-4de5-bc42-56ffa0c75442';

-- redeem_referral
CREATE OR REPLACE FUNCTION public.redeem_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_referrer uuid;
  v_code text;
  v_new_bonus numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'code_required' USING ERRCODE = 'P0001';
  END IF;

  v_code := upper(trim(p_code));

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND referred_by IS NOT NULL) THEN
    RAISE EXCEPTION 'already_referred' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = v_code;
  IF v_referrer IS NULL THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;
  IF v_referrer = v_user THEN
    RAISE EXCEPTION 'self_referral' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles SET referred_by = v_referrer WHERE id = v_user;

  INSERT INTO public.user_balances (user_id, balance, bonus_balance)
    VALUES (v_user, 0, 2000)
    ON CONFLICT (user_id) DO UPDATE
      SET bonus_balance = public.user_balances.bonus_balance + 2000,
          updated_at = now()
    RETURNING bonus_balance INTO v_new_bonus;

  INSERT INTO public.transactions (user_id, type, amount, meta)
    VALUES (v_user, 'bonus', 2000,
      jsonb_build_object('source','referral_signup','referrer_id', v_referrer, 'code', v_code));

  PERFORM public._award_mission_progress(v_referrer, 'referral_redeemed', NULL, 1);

  RETURN jsonb_build_object(
    'ok', true,
    'new_user_bonus', 2000,
    'new_bonus_balance', v_new_bonus
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;

-- Update admin_approve_deposit
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_id uuid)
 RETURNS deposit_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.deposit_requests;
  v_prev numeric; v_new numeric; v_prev_bonus numeric; v_new_bonus numeric;
  v_referrer uuid;
  v_first_dep timestamptz;
  v_commission numeric;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin,'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_row FROM public.deposit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0001'; END IF;
  IF v_row.status <> 'pendiente_revision' THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.user_balances (user_id, balance, bonus_balance)
  VALUES (v_row.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance, bonus_balance INTO v_prev, v_prev_bonus
    FROM public.user_balances WHERE user_id = v_row.user_id FOR UPDATE;

  v_new := v_prev + v_row.amount;
  v_new_bonus := v_prev_bonus + COALESCE(v_row.bonus,0);

  UPDATE public.user_balances
     SET balance = v_new, bonus_balance = v_new_bonus, updated_at = now()
   WHERE user_id = v_row.user_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
  VALUES (v_row.user_id, 'deposit'::transaction_type, v_row.amount, v_new, NULL,
    jsonb_build_object(
      'kind','manual_deposit','deposit_id', v_row.id, 'reference', v_row.reference,
      'method', v_row.method, 'admin_id', v_admin
    ));

  IF COALESCE(v_row.bonus,0) > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
    VALUES (v_row.user_id, 'deposit'::transaction_type, v_row.bonus, v_new, NULL,
      jsonb_build_object(
        'kind','manual_deposit_bonus','deposit_id', v_row.id,
        'reference', v_row.reference,'target','bonus','admin_id', v_admin
      ));
  END IF;

  UPDATE public.deposit_requests SET
    status='aprobada', approved_by=v_admin, approved_at=now(),
    prev_balance=v_prev, new_balance=v_new, bonus_applied=COALESCE(v_row.bonus,0)
  WHERE id = p_id RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'approve_deposit', v_row.user_id,
    jsonb_build_object('deposit_id',v_row.id,'reference',v_row.reference,
      'amount',v_row.amount,'bonus',v_row.bonus,'prev',v_prev,'new',v_new));

  -- Referral first-deposit commission (5% bonus)
  SELECT referred_by, first_deposit_at INTO v_referrer, v_first_dep
    FROM public.profiles WHERE id = v_row.user_id FOR UPDATE;

  IF v_referrer IS NOT NULL AND v_first_dep IS NULL THEN
    UPDATE public.profiles SET first_deposit_at = now() WHERE id = v_row.user_id;

    v_commission := ROUND(v_row.amount * 0.05);
    IF v_commission > 0 THEN
      INSERT INTO public.user_balances (user_id, balance, bonus_balance)
        VALUES (v_referrer, 0, v_commission)
        ON CONFLICT (user_id) DO UPDATE
          SET bonus_balance = public.user_balances.bonus_balance + v_commission,
              updated_at = now();

      INSERT INTO public.transactions (user_id, type, amount, meta)
        VALUES (v_referrer, 'bonus', v_commission,
          jsonb_build_object(
            'source','referral_first_deposit',
            'referred_user_id', v_row.user_id,
            'deposit_id', v_row.id,
            'deposit_amount', v_row.amount,
            'commission_pct', 5
          ));
    END IF;
  END IF;

  RETURN v_row;
END$function$;
