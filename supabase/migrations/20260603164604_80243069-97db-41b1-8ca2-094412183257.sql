DROP FUNCTION IF EXISTS public.admin_adjust_xp(uuid, bigint, text);

CREATE OR REPLACE FUNCTION public.admin_adjust_xp(
  p_target_user_id uuid,
  p_delta bigint,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(out_total_xp bigint, out_current_level int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_cap int;
  v_new_total bigint;
  v_new_level int;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(cap_level, 100) INTO v_cap FROM public.vip_config WHERE id = true;

  INSERT INTO public.user_vip AS uv (user_id, total_xp, current_level)
  VALUES (p_target_user_id, GREATEST(0, p_delta), 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = GREATEST(0, uv.total_xp + p_delta),
        updated_at = now()
  RETURNING uv.total_xp INTO v_new_total;

  SELECT COALESCE(MAX(vl.level), 0) INTO v_new_level
    FROM public.vip_levels vl
   WHERE vl.xp_required <= v_new_total
     AND vl.level <= COALESCE(v_cap, 100);

  UPDATE public.user_vip
     SET current_level = v_new_level,
         updated_at = now()
   WHERE user_id = p_target_user_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'adjust_xp', p_target_user_id,
          jsonb_build_object('delta', p_delta, 'reason', p_reason,
                             'new_total_xp', v_new_total, 'new_level', v_new_level));

  out_total_xp := v_new_total;
  out_current_level := v_new_level;
  RETURN NEXT;
END;
$$;