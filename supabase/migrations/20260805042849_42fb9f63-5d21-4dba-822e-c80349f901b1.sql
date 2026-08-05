REVOKE ALL ON FUNCTION public.cleanup_old_game_data(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_game_data(integer) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_old_game_data(integer) FROM authenticated;