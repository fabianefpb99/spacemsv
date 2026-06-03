-- Add extended profile fields for KYC-style registration
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS second_name text,
  ADD COLUMN IF NOT EXISTS second_last_name text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- Constrain gender to allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_gender_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('masculino','femenino','otro'));
  END IF;
END $$;

-- Constrain document_type to allowed Colombian doc types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_document_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_document_type_check
      CHECK (document_type IS NULL OR document_type IN ('CC','CE','PA'));
  END IF;
END $$;