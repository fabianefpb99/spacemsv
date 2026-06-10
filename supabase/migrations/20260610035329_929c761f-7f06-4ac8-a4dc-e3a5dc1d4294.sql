ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_key_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_key_check
  CHECK (
    avatar_key IS NULL
    OR avatar_key ~ '^avatar-[1-8]$'
    OR avatar_key = 'avatar-arena'
    OR avatar_key ~ '^mission:[0-9a-fA-F-]{8,}$'
  );