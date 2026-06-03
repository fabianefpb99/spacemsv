
CREATE OR REPLACE FUNCTION public.admin_adjust_xp(
  p_target_user_id uuid,
  p_delta bigint,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(total_xp bigint, current_level int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_cfg public.vip_config%ROWTYPE;
  v_new_total bigint;
  v_new_level int;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_cfg FROM public.vip_config WHERE id = true;

  INSERT INTO public.user_vip (user_id, total_xp, current_level)
  VALUES (p_target_user_id, GREATEST(0, p_delta), 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = GREATEST(0, public.user_vip.total_xp + EXCLUDED.total_xp - GREATEST(0, p_delta) + p_delta),
        updated_at = now()
  RETURNING public.user_vip.total_xp INTO v_new_total;

  -- Simplify: recompute directly
  UPDATE public.user_vip
     SET total_xp = GREATEST(0, COALESCE(total_xp,0))
   WHERE user_id = p_target_user_id
   RETURNING total_xp INTO v_new_total;

  SELECT COALESCE(MAX(level), 0) INTO v_new_level
    FROM public.vip_levels
   WHERE xp_required <= v_new_total
     AND level <= COALESCE(v_cfg.cap_level, 100);

  UPDATE public.user_vip
     SET current_level = v_new_level,
         updated_at = now()
   WHERE user_id = p_target_user_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'adjust_xp', p_target_user_id,
          jsonb_build_object('delta', p_delta, 'reason', p_reason,
                             'new_total_xp', v_new_total, 'new_level', v_new_level));

  RETURN QUERY SELECT v_new_total, v_new_level;
END;
$$;
