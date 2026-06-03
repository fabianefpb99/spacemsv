-- ============================================================
-- VIP SYSTEM: 100 niveles, 7 rangos, 5 subdivisiones
-- ============================================================

-- 1) ENUMs
CREATE TYPE public.vip_rank AS ENUM (
  'bronce','plata','oro','platino','diamante','maestro','leyenda'
);
CREATE TYPE public.vip_sub AS ENUM ('V','IV','III','II','I');

-- ============================================================
-- 2) vip_config (singleton: fórmula XP configurable)
-- ============================================================
CREATE TABLE public.vip_config (
  id              boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  -- xp = xp_per_bet_base + floor( log10( (bet/scale) + 1 ) * xp_log_factor )
  xp_per_bet_base integer NOT NULL DEFAULT 1,
  xp_log_factor   numeric NOT NULL DEFAULT 1.0,
  xp_log_scale    numeric NOT NULL DEFAULT 1000,
  min_bet_for_xp  numeric NOT NULL DEFAULT 100,
  cap_level       integer NOT NULL DEFAULT 100,
  is_active       boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid
);

GRANT SELECT ON public.vip_config TO authenticated;
GRANT ALL    ON public.vip_config TO service_role;

ALTER TABLE public.vip_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY vip_config_select_auth ON public.vip_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY vip_config_admin_all ON public.vip_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.vip_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============================================================
-- 3) vip_levels (1..100 con curva configurable; sembrada)
-- ============================================================
CREATE TABLE public.vip_levels (
  level         integer PRIMARY KEY CHECK (level BETWEEN 1 AND 100),
  rank          public.vip_rank NOT NULL,
  sub_division  public.vip_sub NOT NULL,
  xp_required   bigint NOT NULL,        -- XP ACUMULADO para alcanzar este nivel
  reward_amount numeric NOT NULL DEFAULT 0  -- futuro
);

GRANT SELECT ON public.vip_levels TO authenticated;
GRANT ALL    ON public.vip_levels TO service_role;

ALTER TABLE public.vip_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY vip_levels_select_auth ON public.vip_levels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY vip_levels_admin_write ON public.vip_levels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Seed 100 niveles
DO $$
DECLARE
  v_level   int;
  v_rank    public.vip_rank;
  v_sub     public.vip_sub;
  v_base    numeric := 100;
  v_growth  numeric := 1.045;
  v_acc     bigint := 0;
  v_req     bigint;
  -- rango -> rango de niveles
  v_rank_start int;
  v_rank_end   int;
  v_rank_size  int;
  v_rel        int;
  v_sub_idx    int;
BEGIN
  FOR v_level IN 1..100 LOOP
    -- determinar rango
    IF v_level <= 15 THEN
      v_rank := 'bronce'; v_rank_start := 1;  v_rank_end := 15;
    ELSIF v_level <= 30 THEN
      v_rank := 'plata';  v_rank_start := 16; v_rank_end := 30;
    ELSIF v_level <= 45 THEN
      v_rank := 'oro';    v_rank_start := 31; v_rank_end := 45;
    ELSIF v_level <= 60 THEN
      v_rank := 'platino';v_rank_start := 46; v_rank_end := 60;
    ELSIF v_level <= 75 THEN
      v_rank := 'diamante';v_rank_start := 61; v_rank_end := 75;
    ELSIF v_level <= 90 THEN
      v_rank := 'maestro'; v_rank_start := 76; v_rank_end := 90;
    ELSE
      v_rank := 'leyenda'; v_rank_start := 91; v_rank_end := 100;
    END IF;

    v_rank_size := v_rank_end - v_rank_start + 1;
    v_rel       := v_level - v_rank_start;            -- 0-based
    -- 5 subdivisiones V..I (V = primer tramo, I = último)
    v_sub_idx   := LEAST(4, (v_rel * 5) / v_rank_size);
    v_sub := (ARRAY['V','IV','III','II','I']::public.vip_sub[])[v_sub_idx + 1];

    -- XP acumulado: suma de la curva exponencial
    v_req := round(v_base * power(v_growth, v_level - 1))::bigint;
    v_acc := v_acc + v_req;

    INSERT INTO public.vip_levels(level, rank, sub_division, xp_required)
    VALUES (v_level, v_rank, v_sub, v_acc);
  END LOOP;
END $$;

-- ============================================================
-- 4) user_vip
-- ============================================================
CREATE TABLE public.user_vip (
  user_id        uuid PRIMARY KEY,
  total_xp       bigint NOT NULL DEFAULT 0,
  current_level  integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_vip TO authenticated;
GRANT ALL    ON public.user_vip TO service_role;

ALTER TABLE public.user_vip ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_vip_select_own ON public.user_vip
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY user_vip_admin_select_all ON public.user_vip
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

-- ============================================================
-- 5) profiles.vip_last_seen_level
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_last_seen_level integer NOT NULL DEFAULT 0;

-- ============================================================
-- 6) award_xp(): suma XP y recalcula nivel (capped)
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id uuid,
  p_bet_amount numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg         public.vip_config%ROWTYPE;
  v_xp_gain     int;
  v_new_total   bigint;
  v_new_level   int;
BEGIN
  SELECT * INTO v_cfg FROM public.vip_config WHERE id = true;
  IF NOT FOUND OR NOT v_cfg.is_active THEN RETURN; END IF;
  IF p_bet_amount IS NULL OR p_bet_amount < v_cfg.min_bet_for_xp THEN RETURN; END IF;

  v_xp_gain := v_cfg.xp_per_bet_base
             + floor( log( (p_bet_amount / v_cfg.xp_log_scale) + 1 ) * v_cfg.xp_log_factor )::int;
  IF v_xp_gain <= 0 THEN RETURN; END IF;

  INSERT INTO public.user_vip (user_id, total_xp, current_level)
  VALUES (p_user_id, v_xp_gain, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = public.user_vip.total_xp + EXCLUDED.total_xp,
        updated_at = now()
  RETURNING total_xp INTO v_new_total;

  -- mayor nivel cuyo xp_required <= total_xp, capped a cap_level
  SELECT COALESCE(MAX(level), 0) INTO v_new_level
    FROM public.vip_levels
   WHERE xp_required <= v_new_total
     AND level <= v_cfg.cap_level;

  UPDATE public.user_vip
     SET current_level = v_new_level,
         updated_at = now()
   WHERE user_id = p_user_id
     AND current_level <> v_new_level;
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, numeric) TO authenticated, service_role;

-- ============================================================
-- 7) mark_vip_level_seen()
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_vip_level_seen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lvl int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='P0001'; END IF;
  SELECT current_level INTO v_lvl FROM public.user_vip WHERE user_id = v_uid;
  v_lvl := COALESCE(v_lvl, 0);
  UPDATE public.profiles SET vip_last_seen_level = v_lvl, updated_at = now()
   WHERE id = v_uid;
  RETURN v_lvl;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_vip_level_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_vip_level_seen() TO authenticated;

-- ============================================================
-- 8) Inyectar award_xp en _debit_bet (cubre todos los juegos)
-- ============================================================
CREATE OR REPLACE FUNCTION public._debit_bet(p_user_id uuid, p_amount numeric)
 RETURNS TABLE(new_balance numeric, new_bonus numeric, from_bonus numeric, from_real numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance numeric;
  v_bonus   numeric;
  v_from_bonus numeric;
  v_from_real  numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001';
  END IF;

  SELECT balance, bonus_balance INTO v_balance, v_bonus
    FROM public.user_balances
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'balance_row_missing' USING ERRCODE = 'P0002';
  END IF;

  IF (COALESCE(v_balance,0) + COALESCE(v_bonus,0)) < p_amount THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  v_from_bonus := LEAST(COALESCE(v_bonus,0), p_amount);
  v_from_real  := p_amount - v_from_bonus;

  v_bonus   := COALESCE(v_bonus,0)   - v_from_bonus;
  v_balance := COALESCE(v_balance,0) - v_from_real;

  UPDATE public.user_balances
     SET balance = v_balance,
         bonus_balance = v_bonus,
         updated_at = now()
   WHERE user_id = p_user_id;

  -- VIP XP (no debe romper la apuesta si falla)
  BEGIN
    PERFORM public.award_xp(p_user_id, p_amount);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT v_balance, v_bonus, v_from_bonus, v_from_real;
END;
$function$;