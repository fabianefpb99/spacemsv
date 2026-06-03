ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_key TEXT;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_key_check CHECK (avatar_key IS NULL OR avatar_key ~ '^avatar-[1-8]$');