
-- 1) Reset puntual del admin actual
UPDATE public.user_vip
   SET total_xp = 0, current_level = 0, updated_at = now()
 WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');

DELETE FROM public.user_vip_rewards
 WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');

-- 2) RPC reusable para reset completo de VIP de un usuario
CREATE OR REPLACE FUNCTION public.admin_reset_vip_progress(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_deleted_rewards int;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.user_vip
     SET total_xp = 0, current_level = 0, updated_at = now()
   WHERE user_id = p_target_user_id;

  WITH d AS (
    DELETE FROM public.user_vip_rewards
     WHERE user_id = p_target_user_id
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted_rewards FROM d;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, meta)
  VALUES (v_admin, 'reset_vip_progress', p_target_user_id,
          jsonb_build_object('deleted_rewards', v_deleted_rewards));

  RETURN jsonb_build_object('ok', true, 'deleted_rewards', v_deleted_rewards);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_vip_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_vip_progress(uuid) TO authenticated;
