-- Restaurar la distribución de crash ORIGINAL del Spaceman local (por tramos)
-- en lugar de la fórmula genérica de Aviator que se introdujo por error.
CREATE OR REPLACE FUNCTION public._spaceman_gen_crash(p_server_seed text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash  text;
  v_h1    bigint;
  v_h2    bigint;
  v_r     numeric;  -- uniforme [0,1) principal (selecciona el tramo)
  v_u     numeric;  -- uniforme [0,1) secundario (posición dentro del tramo)
BEGIN
  v_hash := encode(digest(p_server_seed, 'sha256'), 'hex');
  -- Dos uniformes independientes a partir de partes distintas del hash (52 bits c/u)
  v_h1 := ('x' || substring(v_hash, 1, 13))::bit(52)::bigint;
  v_h2 := ('x' || substring(v_hash, 14, 13))::bit(52)::bigint;
  v_r := v_h1::numeric / power(2::numeric, 52);
  v_u := v_h2::numeric / power(2::numeric, 52);

  -- Distribución ORIGINAL (idéntica a la del cliente local):
  -- 3.5%  instantáneo 1.00x
  IF v_r < 0.035 THEN
    RETURN 1.00;
  END IF;
  -- 20% zona 1.00x - 1.15x
  IF v_r < 0.235 THEN
    RETURN ROUND((1.0 + v_u * 0.15)::numeric, 2);
  END IF;
  -- 55% zona 1.15x - 2.50x
  IF v_r < 0.785 THEN
    RETURN ROUND((1.15 + v_u * 1.35)::numeric, 2);
  END IF;
  -- 16% zona 2.50x - 7.00x
  IF v_r < 0.945 THEN
    RETURN ROUND((2.5 + v_u * 4.5)::numeric, 2);
  END IF;
  -- 4.5% zona 7.00x - 20.00x
  IF v_r < 0.990 THEN
    RETURN ROUND((7.0 + v_u * 13.0)::numeric, 2);
  END IF;
  -- 0.8% zona 20.00x - 50.00x
  IF v_r < 0.998 THEN
    RETURN ROUND((20.0 + v_u * 30.0)::numeric, 2);
  END IF;
  -- 0.18% zona 50.00x - 100.00x
  IF v_r < 0.9998 THEN
    RETURN ROUND((50.0 + v_u * 50.0)::numeric, 2);
  END IF;
  -- 0.02% jackpot exacto 100.00x
  RETURN 100.00;
END;
$function$;