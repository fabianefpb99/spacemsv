-- Enum types
CREATE TYPE public.deposit_method AS ENUM ('nequi','breb');
CREATE TYPE public.deposit_status AS ENUM ('pendiente_pago','pendiente_revision','aprobada','rechazada','expirada');

-- Table
CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  email text,
  amount numeric NOT NULL CHECK (amount > 0),
  bonus numeric NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  method public.deposit_method NOT NULL,
  reference text NOT NULL UNIQUE,
  status public.deposit_status NOT NULL DEFAULT 'pendiente_pago',
  payer_self boolean,
  payer_first_name text,
  payer_last_name text,
  payer_phone text,
  payer_ip text,
  reject_reason text,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  prev_balance numeric,
  new_balance numeric,
  bonus_applied numeric,
  confirmed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deposits_user ON public.deposit_requests(user_id, created_at DESC);
CREATE INDEX idx_deposits_status ON public.deposit_requests(status, created_at DESC);

-- Grants
GRANT SELECT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;

-- RLS
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY deposit_select_own ON public.deposit_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY deposit_admin_select ON public.deposit_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER trg_deposits_updated
  BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reference generator: SPM-XXXX-XXXX (uppercase alnum, no ambiguous chars)
CREATE OR REPLACE FUNCTION public._gen_deposit_reference()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_a text := '';
  v_b text := '';
  v_ref text;
  v_attempt int := 0;
BEGIN
  LOOP
    v_a := ''; v_b := '';
    FOR i IN 1..4 LOOP
      v_a := v_a || substr(v_chars, 1 + floor(random()*length(v_chars))::int, 1);
      v_b := v_b || substr(v_chars, 1 + floor(random()*length(v_chars))::int, 1);
    END LOOP;
    v_ref := 'SPM-'||v_a||'-'||v_b;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.deposit_requests WHERE reference = v_ref);
    v_attempt := v_attempt + 1;
    IF v_attempt > 10 THEN RAISE EXCEPTION 'ref_collision'; END IF;
  END LOOP;
  RETURN v_ref;
END$$;

-- Create request
CREATE OR REPLACE FUNCTION public.create_deposit_request(
  p_amount numeric, p_bonus numeric, p_method public.deposit_method
) RETURNS public.deposit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_prof record;
  v_row public.deposit_requests;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='P0001'; END IF;
  IF p_amount IS NULL OR p_amount < 1000 OR p_amount > 5000000 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE='P0001';
  END IF;
  IF p_bonus IS NULL OR p_bonus < 0 OR p_bonus > p_amount THEN
    RAISE EXCEPTION 'invalid_bonus' USING ERRCODE='P0001';
  END IF;

  SELECT id, username, email INTO v_prof FROM public.profiles WHERE id = v_user;

  INSERT INTO public.deposit_requests (
    user_id, username, email, amount, bonus, method, reference
  ) VALUES (
    v_user, v_prof.username, v_prof.email, p_amount, p_bonus, p_method,
    public._gen_deposit_reference()
  ) RETURNING * INTO v_row;

  RETURN v_row;
END$$;

-- Confirm payment sent
CREATE OR REPLACE FUNCTION public.confirm_deposit_request(
  p_id uuid,
  p_payer_self boolean,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_ip text
) RETURNS public.deposit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.deposit_requests;
  v_prof record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_row FROM public.deposit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.user_id <> v_user THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE='P0001';
  END IF;
  IF v_row.status = 'pendiente_revision' THEN
    RETURN v_row; -- idempotent
  END IF;
  IF v_row.status <> 'pendiente_pago' THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE='P0001';
  END IF;
  IF now() > v_row.expires_at THEN
    UPDATE public.deposit_requests SET status='expirada' WHERE id = p_id;
    RAISE EXCEPTION 'expired' USING ERRCODE='P0001';
  END IF;

  IF p_payer_self THEN
    SELECT username, first_name, last_name, phone INTO v_prof FROM public.profiles WHERE id = v_user;
    UPDATE public.deposit_requests SET
      status = 'pendiente_revision',
      payer_self = true,
      payer_first_name = COALESCE(v_prof.first_name, v_prof.username),
      payer_last_name  = v_prof.last_name,
      payer_phone      = v_prof.phone,
      payer_ip         = p_ip,
      confirmed_at     = now()
     WHERE id = p_id
     RETURNING * INTO v_row;
  ELSE
    IF p_first_name IS NULL OR length(trim(p_first_name)) = 0
       OR p_last_name IS NULL OR length(trim(p_last_name)) = 0 THEN
      RAISE EXCEPTION 'payer_data_required' USING ERRCODE='P0001';
    END IF;
    UPDATE public.deposit_requests SET
      status = 'pendiente_revision',
      payer_self = false,
      payer_first_name = trim(p_first_name),
      payer_last_name  = trim(p_last_name),
      payer_phone      = NULLIF(trim(p_phone), ''),
      payer_ip         = p_ip,
      confirmed_at     = now()
     WHERE id = p_id
     RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END$$;

-- Admin approve
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_id uuid)
RETURNS public.deposit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.deposit_requests;
  v_prev numeric; v_new numeric; v_prev_bonus numeric; v_new_bonus numeric;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin,'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_row FROM public.deposit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0001'; END IF;
  IF v_row.status <> 'pendiente_revision' THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE='P0001';
  END IF;

  -- Ensure balance row
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

  -- Transactions: deposit (real) and bonus (if any)
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

  RETURN v_row;
END$$;

-- Admin reject
CREATE OR REPLACE FUNCTION public.admin_reject_deposit(p_id uuid, p_reason text)
RETURNS public.deposit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.deposit_requests;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin,'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE='P0001';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_row FROM public.deposit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0001'; END IF;
  IF v_row.status NOT IN ('pendiente_revision','pendiente_pago') THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE='P0001';
  END IF;

  UPDATE public.deposit_requests SET
    status='rechazada', rejected_by=v_admin, rejected_at=now(),
    reject_reason=trim(p_reason)
   WHERE id = p_id RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin,'reject_deposit', v_row.user_id,
    jsonb_build_object('deposit_id',v_row.id,'reference',v_row.reference,'reason',p_reason));

  RETURN v_row;
END$$;

-- Expire stale pending_pago
CREATE OR REPLACE FUNCTION public.expire_pending_deposits()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.deposit_requests
       SET status='expirada'
     WHERE status='pendiente_pago' AND expires_at < now()
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;
ALTER TABLE public.deposit_requests REPLICA IDENTITY FULL;

-- Cron job to expire deposits every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('expire-pending-deposits','*/5 * * * *', $$SELECT public.expire_pending_deposits();$$);
