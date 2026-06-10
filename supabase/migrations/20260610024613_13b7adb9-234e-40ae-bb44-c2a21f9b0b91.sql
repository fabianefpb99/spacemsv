
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('daily','weekly','special')),
  title text NOT NULL,
  subtitle text,
  goal numeric NOT NULL DEFAULT 1,
  icon_key text NOT NULL DEFAULT 'swords',
  accent text NOT NULL DEFAULT 'purple' CHECK (accent IN ('purple','emerald','amber','rose','blue')),
  reward_kind text NOT NULL CHECK (reward_kind IN ('bonus','spins','xp','avatar')),
  reward_value numeric NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  reward_image_url text,
  cta_label text NOT NULL DEFAULT 'Jugar',
  cta_to text NOT NULL DEFAULT '/home',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.missions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions_public_select"
  ON public.missions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "missions_admin_insert"
  ON public.missions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "missions_admin_update"
  ON public.missions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "missions_admin_delete"
  ON public.missions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_missions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER missions_touch_updated
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.touch_missions_updated_at();
