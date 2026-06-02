-- 1) Block new deposits when user has a pendiente_revision
CREATE OR REPLACE FUNCTION public.create_deposit_request(p_amount numeric, p_bonus numeric, p_method deposit_method)
 RETURNS public.deposit_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Block when there's already a deposit waiting for admin review (any method)
  IF EXISTS (
    SELECT 1 FROM public.deposit_requests
     WHERE user_id = v_user AND status = 'pendiente_revision'
  ) THEN
    RAISE EXCEPTION 'has_pending_review' USING ERRCODE='P0001';
  END IF;

  SELECT id, username, email INTO v_prof FROM public.profiles WHERE id = v_user;

  INSERT INTO public.deposit_requests (
    user_id, username, email, amount, bonus, method, reference
  ) VALUES (
    v_user, v_prof.username, v_prof.email, p_amount, p_bonus, p_method,
    public._gen_deposit_reference()
  ) RETURNING * INTO v_row;

  RETURN v_row;
END$function$;

-- 2) Allow the user to cancel their own deposit (pendiente_pago or pendiente_revision)
CREATE OR REPLACE FUNCTION public.cancel_deposit_request(p_id uuid)
 RETURNS public.deposit_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_row public.deposit_requests;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_row FROM public.deposit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.user_id <> v_user THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE='P0001';
  END IF;
  IF v_row.status NOT IN ('pendiente_pago','pendiente_revision') THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE='P0001';
  END IF;

  UPDATE public.deposit_requests SET
    status = 'rechazada',
    rejected_by = v_user,
    rejected_at = now(),
    reject_reason = 'Cancelada por el usuario'
   WHERE id = p_id
   RETURNING * INTO v_row;

  RETURN v_row;
END$function$;