-- =============================================================
-- Security fix #3: _check_vip_rewards executable by anyone
-- -------------------------------------------------------------
-- Cualquier usuario autenticado podía invocarla y, gracias a
-- ON CONFLICT DO NOTHING, "sembrar" todos los premios del catálogo
-- para sí mismo (o cualquier user_id) sin haber alcanzado el rango.
-- Restringimos EXECUTE a service_role; los triggers internos que la
-- llaman corren como SECURITY DEFINER del owner y siguen funcionando.
-- =============================================================
REVOKE EXECUTE ON FUNCTION public._check_vip_rewards(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._check_vip_rewards(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public._check_vip_rewards(uuid, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public._check_vip_rewards(uuid, integer) TO service_role;

-- =============================================================
-- Security fix #4: columnas sensibles editables vía profiles_update_own
-- -------------------------------------------------------------
-- La policy permite que el usuario actualice cualquier columna de su
-- propia fila. Eso incluye verification_status, is_blocked, referred_by,
-- first_deposit_at, vip_last_seen_level y referral_code — todas
-- columnas que solo el backend (service_role / admin) debe tocar.
-- Bloqueamos con un trigger BEFORE UPDATE que restaura los valores
-- antiguos cuando el caller NO es admin ni service_role.
-- =============================================================
CREATE OR REPLACE FUNCTION public._profiles_lock_sensitive_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
  v_is_service boolean := (current_setting('role', true) = 'service_role');
BEGIN
  -- service_role bypassea (admin server-side / migraciones).
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  -- Admins humanos también pueden modificar todo.
  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  END IF;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Usuario normal: restaura columnas sensibles al valor anterior.
  NEW.verification_status := OLD.verification_status;
  NEW.is_blocked           := OLD.is_blocked;
  NEW.referred_by          := OLD.referred_by;
  NEW.referral_code        := OLD.referral_code;
  NEW.first_deposit_at     := OLD.first_deposit_at;
  NEW.vip_last_seen_level  := OLD.vip_last_seen_level;
  -- id, email los maneja Supabase auth; no los tocamos aquí.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_sensitive_cols ON public.profiles;
CREATE TRIGGER profiles_lock_sensitive_cols
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public._profiles_lock_sensitive_cols();