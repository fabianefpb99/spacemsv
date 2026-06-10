
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id uuid, p_bet_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg         public.vip_config%ROWTYPE;
  v_xp_gain     int;
  v_new_total   bigint;
  v_new_level   int;
  v_dow         int;
  v_multiplier  numeric := 1;
BEGIN
  SELECT * INTO v_cfg FROM public.vip_config WHERE id = true;
  IF NOT FOUND OR NOT v_cfg.is_active THEN RETURN; END IF;
  IF p_bet_amount IS NULL OR p_bet_amount < v_cfg.min_bet_for_xp THEN RETURN; END IF;

  v_xp_gain := v_cfg.xp_per_bet_base
             + floor( log( (p_bet_amount / v_cfg.xp_log_scale) + 1 ) * v_cfg.xp_log_factor )::int;

  -- Doble XP fin de semana (sábado=6, domingo=0) en hora de Bogotá
  v_dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Bogota'))::int;
  IF v_dow = 0 OR v_dow = 6 THEN
    v_multiplier := 2;
  END IF;
  v_xp_gain := (v_xp_gain * v_multiplier)::int;

  IF v_xp_gain <= 0 THEN RETURN; END IF;

  INSERT INTO public.user_vip (user_id, total_xp, current_level)
  VALUES (p_user_id, v_xp_gain, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = public.user_vip.total_xp + EXCLUDED.total_xp,
        updated_at = now()
  RETURNING total_xp INTO v_new_total;

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
$function$;
