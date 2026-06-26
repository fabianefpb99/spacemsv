
UPDATE public.user_vip
   SET total_xp = 0, current_level = 0, updated_at = now()
 WHERE user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');

DELETE FROM public.user_vip_rewards
 WHERE user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');

UPDATE public.profiles
   SET vip_last_seen_level = 0, updated_at = now()
 WHERE vip_last_seen_level IS DISTINCT FROM 0
   AND id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');

ALTER TABLE public.user_vip REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_vip'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_vip';
  END IF;
END$$;
