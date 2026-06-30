
DROP POLICY IF EXISTS game_rounds_select_all_authenticated ON public.game_rounds;
DROP POLICY IF EXISTS game_rounds_select_finished_only ON public.game_rounds;

CREATE POLICY game_rounds_select_finished_only
  ON public.game_rounds
  FOR SELECT
  TO authenticated
  USING (status IN ('crashed','settled'));

REVOKE EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spin_slot_v1(uuid, numeric, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.spin_roulette_v1(uuid, numeric, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spin_roulette_v1(uuid, numeric, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.spin_roulette_v2(
  p_bet_amount numeric,
  p_choice text,
  p_client_action_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;
  RETURN public.spin_roulette_v1(v_uid, p_bet_amount, p_choice, p_client_action_id);
END;
$$;

REVOKE ALL ON FUNCTION public.spin_roulette_v2(numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spin_roulette_v2(numeric, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.play_arena_v1(uuid, numeric, text, uuid, integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.play_arena_v1(uuid, numeric, text, uuid, integer[]) TO service_role;

CREATE OR REPLACE FUNCTION public.play_arena_v2(
  p_bet_amount numeric,
  p_character text,
  p_client_action_id uuid,
  p_odds_perm integer[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;
  RETURN public.play_arena_v1(v_uid, p_bet_amount, p_character, p_client_action_id, p_odds_perm);
END;
$$;

REVOKE ALL ON FUNCTION public.play_arena_v2(numeric, text, uuid, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.play_arena_v2(numeric, text, uuid, integer[]) TO authenticated;
