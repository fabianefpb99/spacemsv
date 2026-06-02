
-- ============================================================
-- Admin Panel Foundation
-- ============================================================

-- 1) Add is_blocked flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- 2) Game RTP central configuration
CREATE TABLE IF NOT EXISTS public.game_rtp_config (
  game            text PRIMARY KEY,
  rtp_target      numeric(5,2) NOT NULL,
  rtp_baseline    numeric(5,2) NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid
);

GRANT SELECT ON public.game_rtp_config TO authenticated;
GRANT ALL ON public.game_rtp_config TO service_role;

ALTER TABLE public.game_rtp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_rtp_config_select_auth ON public.game_rtp_config;
CREATE POLICY game_rtp_config_select_auth
  ON public.game_rtp_config
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS game_rtp_config_admin_all ON public.game_rtp_config;
CREATE POLICY game_rtp_config_admin_all
  ON public.game_rtp_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed RTP config for the 5 games (idempotent)
INSERT INTO public.game_rtp_config (game, rtp_target, rtp_baseline) VALUES
  ('spaceman',   96.20, 96.20),
  ('slot',       94.50, 94.50),
  ('mines',      97.00, 97.00),
  ('dice',       98.10, 98.10),
  ('blackjack',  99.00, 99.00)
ON CONFLICT (game) DO NOTHING;

-- 3) Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL,
  action          text NOT NULL,
  target_user_id  uuid,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON public.admin_audit_log (target_user_id);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_admin_select ON public.admin_audit_log;
CREATE POLICY admin_audit_log_admin_select
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only inserts via server function (service_role). Disallow direct client inserts.
DROP POLICY IF EXISTS admin_audit_log_no_direct_insert ON public.admin_audit_log;
CREATE POLICY admin_audit_log_no_direct_insert
  ON public.admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 4) Promote fabianefpb99@gmail.com to admin (idempotent)
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'fabianefpb99@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 5) RPC: admin_adjust_balance — credits/debits real or bonus with audit
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_target_user_id uuid,
  p_delta numeric,
  p_target text,            -- 'real' | 'bonus'
  p_reason text DEFAULT NULL
)
RETURNS TABLE(new_balance numeric, new_bonus numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_bal numeric;
  v_bonus numeric;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  IF p_target NOT IN ('real','bonus') THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = 'P0001';
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

  -- Trace as a transaction
  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
  VALUES (
    p_target_user_id,
    CASE WHEN p_delta >= 0 THEN 'deposit'::transaction_type ELSE 'withdrawal'::transaction_type END,
    p_delta,
    v_bal,
    NULL,
    jsonb_build_object('kind','admin_adjustment','target',p_target,'reason',p_reason,'admin_id',v_admin)
  );

  -- Audit
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'adjust_balance', p_target_user_id,
          jsonb_build_object('delta',p_delta,'target',p_target,'reason',p_reason,
                             'new_balance',v_bal,'new_bonus',v_bonus));

  RETURN QUERY SELECT v_bal, v_bonus;
END;
$$;

-- 6) RPC: admin_set_block — block/unblock a user
CREATE OR REPLACE FUNCTION public.admin_set_block(
  p_target_user_id uuid,
  p_blocked boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles SET is_blocked = p_blocked, updated_at = now()
   WHERE id = p_target_user_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, CASE WHEN p_blocked THEN 'block_user' ELSE 'unblock_user' END,
          p_target_user_id, jsonb_build_object('is_blocked', p_blocked));

  RETURN p_blocked;
END;
$$;

-- 7) RPC: admin_update_rtp — change RTP target for a game
CREATE OR REPLACE FUNCTION public.admin_update_rtp(
  p_game text,
  p_rtp_target numeric,
  p_is_active boolean DEFAULT NULL
)
RETURNS public.game_rtp_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.game_rtp_config;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF p_rtp_target IS NULL OR p_rtp_target < 50 OR p_rtp_target > 100 THEN
    RAISE EXCEPTION 'invalid_rtp' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.game_rtp_config
     SET rtp_target = p_rtp_target,
         is_active  = COALESCE(p_is_active, is_active),
         updated_at = now(),
         updated_by = v_admin
   WHERE game = p_game
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'game_not_found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'update_rtp', NULL,
          jsonb_build_object('game',p_game,'rtp_target',p_rtp_target,'is_active',v_row.is_active));

  RETURN v_row;
END;
$$;

-- 8) View: admin_users_overview — list with stats per user
CREATE OR REPLACE VIEW public.admin_users_overview AS
SELECT
  p.id,
  p.email,
  p.username,
  p.verification_status,
  p.is_blocked,
  p.created_at,
  COALESCE(b.balance, 0)        AS balance,
  COALESCE(b.bonus_balance, 0)  AS bonus_balance
FROM public.profiles p
LEFT JOIN public.user_balances b ON b.user_id = p.id;

GRANT SELECT ON public.admin_users_overview TO authenticated;
