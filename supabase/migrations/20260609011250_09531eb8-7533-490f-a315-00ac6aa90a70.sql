
-- ============ Withdrawals: tables ============

CREATE TABLE public.withdrawal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method public.deposit_method NOT NULL,
  identifier text NOT NULL,
  bank_label text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, method)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawal_accounts TO authenticated;
GRANT ALL ON public.withdrawal_accounts TO service_role;
ALTER TABLE public.withdrawal_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawal_accounts_own_all" ON public.withdrawal_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "withdrawal_accounts_admin_select" ON public.withdrawal_accounts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER withdrawal_accounts_set_updated_at BEFORE UPDATE ON public.withdrawal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  email text,
  amount numeric(14,2) NOT NULL,        -- gross (debited from balance)
  fee numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL,    -- what the user receives
  method public.deposit_method NOT NULL,
  account_identifier text NOT NULL,
  account_label text,
  status text NOT NULL DEFAULT 'pendiente',  -- pendiente | aprobada | rechazada | cancelada
  reject_reason text,
  prev_balance numeric(14,2),
  new_balance numeric(14,2),
  debit_tx_id uuid,
  refund_tx_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawal_requests_select_own" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "withdrawal_requests_admin_select" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX withdrawal_requests_user_idx ON public.withdrawal_requests(user_id, created_at DESC);
CREATE INDEX withdrawal_requests_status_idx ON public.withdrawal_requests(status, created_at DESC);
CREATE TRIGGER withdrawal_requests_set_updated_at BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============ RPC: create withdrawal request (debit immediately) ============

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_amount numeric,
  p_method public.deposit_method,
  p_account_identifier text,
  p_account_label text DEFAULT NULL
) RETURNS public.withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_min  numeric := 20000;
  v_fee  numeric;
  v_net  numeric;
  v_prev numeric;
  v_bonus numeric;
  v_new  numeric;
  v_prof record;
  v_row public.withdrawal_requests;
  v_tx_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='P0001'; END IF;
  IF p_amount IS NULL OR p_amount < v_min OR p_amount > 5000000 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE='P0001';
  END IF;
  IF p_account_identifier IS NULL OR length(trim(p_account_identifier)) < 4 THEN
    RAISE EXCEPTION 'invalid_account' USING ERRCODE='P0001';
  END IF;

  -- One active request at a time
  IF EXISTS (SELECT 1 FROM public.withdrawal_requests
              WHERE user_id = v_user AND status = 'pendiente') THEN
    RAISE EXCEPTION 'has_pending_withdrawal' USING ERRCODE='P0001';
  END IF;

  -- Lock balance row (real-only; bonus cannot be withdrawn)
  SELECT balance, bonus_balance INTO v_prev, v_bonus
    FROM public.user_balances WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_balance' USING ERRCODE='P0001'; END IF;
  IF v_prev < p_amount THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE='P0001';
  END IF;

  v_fee := ROUND(p_amount * 0.01);
  v_net := p_amount - v_fee;
  v_new := v_prev - p_amount;

  UPDATE public.user_balances SET balance = v_new, updated_at = now() WHERE user_id = v_user;

  SELECT username, email INTO v_prof FROM public.profiles WHERE id = v_user;

  INSERT INTO public.withdrawal_requests (
    user_id, username, email, amount, fee, net_amount, method,
    account_identifier, account_label, status, prev_balance, new_balance
  ) VALUES (
    v_user, v_prof.username, v_prof.email, p_amount, v_fee, v_net, p_method,
    trim(p_account_identifier), NULLIF(trim(p_account_label),''), 'pendiente', v_prev, v_new
  ) RETURNING * INTO v_row;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
  VALUES (v_user, 'withdrawal'::transaction_type, -p_amount, v_new, NULL,
    jsonb_build_object(
      'kind','withdrawal_request',
      'withdrawal_id', v_row.id,
      'method', p_method,
      'account', trim(p_account_identifier),
      'fee', v_fee,
      'net', v_net,
      'status', 'pendiente'
    ))
  RETURNING id INTO v_tx_id;

  UPDATE public.withdrawal_requests SET debit_tx_id = v_tx_id WHERE id = v_row.id RETURNING * INTO v_row;

  -- Upsert saved account
  INSERT INTO public.withdrawal_accounts (user_id, method, identifier, bank_label, is_default)
  VALUES (v_user, p_method, trim(p_account_identifier), NULLIF(trim(p_account_label),''), true)
  ON CONFLICT (user_id, method) DO UPDATE
    SET identifier = EXCLUDED.identifier,
        bank_label = EXCLUDED.bank_label,
        updated_at = now();

  RETURN v_row;
END $$;


-- ============ RPC: cancel by user (refund) ============

CREATE OR REPLACE FUNCTION public.cancel_withdrawal_request(p_id uuid)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.withdrawal_requests;
  v_bal numeric;
  v_new numeric;
  v_tx_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_row FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.user_id <> v_user THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE='P0001';
  END IF;
  IF v_row.status <> 'pendiente' THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE='P0001';
  END IF;

  SELECT balance INTO v_bal FROM public.user_balances WHERE user_id = v_user FOR UPDATE;
  v_new := v_bal + v_row.amount;
  UPDATE public.user_balances SET balance = v_new, updated_at = now() WHERE user_id = v_user;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
  VALUES (v_user, 'adjustment'::transaction_type, v_row.amount, v_new, NULL,
    jsonb_build_object('kind','withdrawal_refund','withdrawal_id', v_row.id,
                       'reason','cancelled_by_user'))
  RETURNING id INTO v_tx_id;

  UPDATE public.withdrawal_requests
     SET status='cancelada', cancelled_at=now(), refund_tx_id=v_tx_id
   WHERE id = p_id RETURNING * INTO v_row;

  RETURN v_row;
END $$;


-- ============ RPC: admin approve (no balance change) ============

CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(p_id uuid)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.withdrawal_requests;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin,'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_row FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0001'; END IF;
  IF v_row.status <> 'pendiente' THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE='P0001';
  END IF;

  UPDATE public.withdrawal_requests
     SET status='aprobada', approved_by=v_admin, approved_at=now()
   WHERE id = p_id RETURNING * INTO v_row;

  -- update original transaction meta status
  UPDATE public.transactions
     SET meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('status','aprobada','approved_at', now())
   WHERE id = v_row.debit_tx_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin,'approve_withdrawal', v_row.user_id,
    jsonb_build_object('withdrawal_id', v_row.id, 'amount', v_row.amount, 'net', v_row.net_amount));

  RETURN v_row;
END $$;


-- ============ RPC: admin reject (refund) ============

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(p_id uuid, p_reason text)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.withdrawal_requests;
  v_bal numeric;
  v_new numeric;
  v_tx_id uuid;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin,'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE='P0001';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_row FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0001'; END IF;
  IF v_row.status <> 'pendiente' THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE='P0001';
  END IF;

  SELECT balance INTO v_bal FROM public.user_balances WHERE user_id = v_row.user_id FOR UPDATE;
  v_new := v_bal + v_row.amount;
  UPDATE public.user_balances SET balance = v_new, updated_at = now() WHERE user_id = v_row.user_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
  VALUES (v_row.user_id, 'adjustment'::transaction_type, v_row.amount, v_new, NULL,
    jsonb_build_object('kind','withdrawal_refund','withdrawal_id', v_row.id,
                       'reason','rejected_by_admin','reject_reason', trim(p_reason),
                       'admin_id', v_admin))
  RETURNING id INTO v_tx_id;

  UPDATE public.withdrawal_requests
     SET status='rechazada', rejected_by=v_admin, rejected_at=now(),
         reject_reason=trim(p_reason), refund_tx_id=v_tx_id
   WHERE id = p_id RETURNING * INTO v_row;

  UPDATE public.transactions
     SET meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('status','rechazada','reject_reason', trim(p_reason))
   WHERE id = v_row.debit_tx_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin,'reject_withdrawal', v_row.user_id,
    jsonb_build_object('withdrawal_id', v_row.id, 'amount', v_row.amount, 'reason', p_reason));

  RETURN v_row;
END $$;
