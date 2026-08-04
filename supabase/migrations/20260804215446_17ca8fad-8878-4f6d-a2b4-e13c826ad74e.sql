-- =====================================================
-- PASO 2: Limpiar basura histórica de game_rounds (84 MB)
-- y dejar retención automática para que no vuelva a acumularse
-- =====================================================

-- 1. Borrar game_bets viejas que referencian rondas terminadas >7 días
DELETE FROM public.game_bets
WHERE round_id IN (
  SELECT id FROM public.game_rounds
  WHERE status IN ('crashed', 'settled')
    AND created_at < now() - interval '7 days'
);

-- 2. Borrar game_rounds terminadas >7 días
DELETE FROM public.game_rounds
WHERE status IN ('crashed', 'settled')
  AND created_at < now() - interval '7 days';

-- 3. Reconstruir game_rounds compacta para recuperar el espacio físico (84 MB → ~1 MB)
CREATE TABLE public._game_rounds_compact (LIKE public.game_rounds INCLUDING ALL);
INSERT INTO public._game_rounds_compact SELECT * FROM public.game_rounds;

-- Soltar FK de game_bets antes de eliminar la tabla vieja
ALTER TABLE public.game_bets DROP CONSTRAINT IF EXISTS game_bets_round_id_fkey;

-- Eliminar tabla inflada y renombrar la compacta
DROP TABLE public.game_rounds;
ALTER TABLE public._game_rounds_compact RENAME TO game_rounds;

-- 4. Restaurar permisos (LIKE INCLUDING ALL no copia GRANTs)
GRANT INSERT ON public.game_rounds TO authenticated;
GRANT ALL ON public.game_rounds TO service_role;

-- 5. Restaurar RLS y política
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_rounds_select_finished_only"
  ON public.game_rounds
  FOR SELECT
  USING (status IN ('crashed', 'settled'));

-- 6. Restaurar FK de game_bets → game_rounds
ALTER TABLE public.game_bets
  ADD CONSTRAINT game_bets_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES public.game_rounds(id);

-- 7. Función de retención: borra apuestas y rondas viejas automáticamente
CREATE OR REPLACE FUNCTION public.cleanup_old_game_data(p_retention_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Borrar game_bets que referencian rondas terminadas viejas
  DELETE FROM game_bets
  WHERE round_id IN (
    SELECT id FROM game_rounds
    WHERE status IN ('crashed', 'settled')
      AND created_at < now() - (p_retention_days || ' days')::interval
  );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Borrar rondas terminadas viejas
  DELETE FROM game_rounds
  WHERE status IN ('crashed', 'settled')
    AND created_at < now() - (p_retention_days || ' days')::interval;

  RETURN v_deleted;
END;
$$;

-- 8. Programar limpieza diaria a las 4 AM (desprogramar si ya existe)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-game-data');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-old-game-data',
  '0 4 * * *',
  $$ SELECT public.cleanup_old_game_data(7); $$
);