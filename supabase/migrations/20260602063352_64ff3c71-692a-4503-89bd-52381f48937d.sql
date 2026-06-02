
-- Fix search_path on spaceman_mult_at_ms
CREATE OR REPLACE FUNCTION public.spaceman_mult_at_ms(p_elapsed_ms numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(1.00, ROUND(EXP(0.06 * (p_elapsed_ms / 1000.0))::numeric, 2));
$function$;

-- Lock down EXECUTE on all SECURITY DEFINER / internal functions.
-- Revoke from PUBLIC (which covers anon + authenticated by default).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spaceman_tick() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spaceman_current_round() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spaceman_place_bet(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spaceman_cashout(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_balance(uuid, numeric, transaction_type, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._spaceman_gen_crash(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spaceman_mult_at_ms(numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Re-grant EXECUTE only where the app needs it:
-- User-facing RPCs called from the authenticated client.
GRANT EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spaceman_current_round() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.spaceman_place_bet(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spaceman_cashout(uuid, uuid, numeric) TO authenticated;

-- service_role keeps full access for server-side / cron usage (spaceman_tick, adjust_balance, etc.)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_tick() TO service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_current_round() TO service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_place_bet(uuid, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_cashout(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_balance(uuid, numeric, transaction_type, text, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._spaceman_gen_crash(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.spaceman_mult_at_ms(numeric) TO service_role;
