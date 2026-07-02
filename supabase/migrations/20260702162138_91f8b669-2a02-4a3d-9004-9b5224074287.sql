
-- Jackpot state singleton table
CREATE TABLE public.jackpot_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  amount numeric NOT NULL DEFAULT 63500,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.jackpot_state TO anon, authenticated;
GRANT ALL ON public.jackpot_state TO service_role;

ALTER TABLE public.jackpot_state ENABLE ROW LEVEL SECURITY;

-- Anyone can read the current jackpot amount (public display)
CREATE POLICY "jackpot_public_read" ON public.jackpot_state FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE policies: only service_role (bypass RLS) can mutate.

-- Seed initial row
INSERT INTO public.jackpot_state (id, amount) VALUES (true, 63500)
ON CONFLICT (id) DO NOTHING;

-- Increment function: SECURITY DEFINER so pg_cron/anon-key cron can call safely.
CREATE OR REPLACE FUNCTION public.increment_jackpot(p_delta numeric DEFAULT 125)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new numeric;
BEGIN
  IF p_delta IS NULL OR p_delta <= 0 OR p_delta > 10000 THEN
    RAISE EXCEPTION 'invalid_delta';
  END IF;
  UPDATE public.jackpot_state
    SET amount = amount + p_delta,
        updated_at = now()
    WHERE id = true
    RETURNING amount INTO v_new;
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_jackpot(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_jackpot(numeric) TO service_role;
