
-- =========================================================================
-- 1) ADMIN NOTIFICATIONS
-- =========================================================================
CREATE TYPE public.admin_notification_type AS ENUM (
  'new_user',
  'recharge_request',
  'game_red_alert'
);

CREATE TABLE public.admin_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        public.admin_notification_type NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_by     uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_notifications_created_idx ON public.admin_notifications (created_at DESC);
CREATE INDEX admin_notifications_type_idx ON public.admin_notifications (type, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update notifications (mark read)"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- =========================================================================
-- 2) TRIGGERS para new_user y recharge_request
-- =========================================================================
CREATE OR REPLACE FUNCTION public._notify_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, link, meta)
  VALUES (
    'new_user',
    'Nuevo usuario registrado',
    COALESCE(NEW.username, NEW.email, 'Usuario sin nombre'),
    '/adminpanel',
    jsonb_build_object('user_id', NEW.id, 'username', NEW.username, 'email', NEW.email)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_profile ON public.profiles;
CREATE TRIGGER notify_new_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public._notify_new_profile();

CREATE OR REPLACE FUNCTION public._notify_recharge_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notificar cuando entra a revisión (no en estado inicial pendiente_pago)
  IF NEW.status::text = 'pendiente_revision' AND (TG_OP = 'INSERT' OR OLD.status::text <> 'pendiente_revision') THEN
    INSERT INTO public.admin_notifications (type, title, body, link, meta)
    VALUES (
      'recharge_request',
      'Nueva solicitud de recarga',
      COALESCE(NEW.username, NEW.email, 'Usuario') || ' — $' || to_char(NEW.amount, 'FM999G999G999') || ' (' || COALESCE(NEW.reference,'') || ')',
      '/adminpanel',
      jsonb_build_object(
        'deposit_id', NEW.id,
        'user_id', NEW.user_id,
        'username', NEW.username,
        'amount', NEW.amount,
        'method', NEW.method,
        'reference', NEW.reference
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_recharge_request ON public.deposit_requests;
CREATE TRIGGER notify_recharge_request
  AFTER INSERT OR UPDATE OF status ON public.deposit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public._notify_recharge_request();

-- =========================================================================
-- 3) "JUEGO EN ROJO" — cooldown state + detector function
-- =========================================================================
CREATE TABLE public.game_red_state (
  game           text PRIMARY KEY,
  last_alert_at  timestamptz NOT NULL DEFAULT now(),
  last_net       numeric NOT NULL DEFAULT 0
);
GRANT SELECT ON public.game_red_state TO authenticated;
GRANT ALL ON public.game_red_state TO service_role;
ALTER TABLE public.game_red_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read red state"
  ON public.game_red_state FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.detect_games_in_red(
  p_window_minutes int DEFAULT 30,
  p_min_loss numeric DEFAULT 5000,
  p_min_txs int DEFAULT 2,
  p_cooldown_minutes int DEFAULT 15
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_inserted int := 0;
  v_last timestamptz;
BEGIN
  FOR v_row IN
    SELECT
      game,
      COUNT(*)        AS tx_count,
      -SUM(amount)    AS casino_net  -- positive = casino ganando, negative = casino perdiendo
    FROM public.transactions
    WHERE game IS NOT NULL
      AND type IN ('bet','win')
      AND created_at >= now() - (p_window_minutes || ' minutes')::interval
    GROUP BY game
    HAVING COUNT(*) >= p_min_txs
       AND -SUM(amount) <= -p_min_loss  -- casino_net <= -p_min_loss → perdiendo más que el umbral
  LOOP
    SELECT last_alert_at INTO v_last
      FROM public.game_red_state WHERE game = v_row.game;

    IF v_last IS NULL OR v_last < now() - (p_cooldown_minutes || ' minutes')::interval THEN
      INSERT INTO public.admin_notifications (type, title, body, link, meta)
      VALUES (
        'game_red_alert',
        'Juego en rojo: ' || upper(v_row.game),
        'Pérdida de $' || to_char(-v_row.casino_net, 'FM999G999G999') || ' COP en últimos ' || p_window_minutes || ' min (' || v_row.tx_count || ' jugadas)',
        '/adminpanel',
        jsonb_build_object(
          'game', v_row.game,
          'casino_net', v_row.casino_net,
          'tx_count', v_row.tx_count,
          'window_minutes', p_window_minutes
        )
      );

      INSERT INTO public.game_red_state (game, last_alert_at, last_net)
      VALUES (v_row.game, now(), v_row.casino_net)
      ON CONFLICT (game) DO UPDATE
        SET last_alert_at = EXCLUDED.last_alert_at,
            last_net      = EXCLUDED.last_net;

      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

-- Cron job: cada 2 minutos
DO $$
BEGIN
  PERFORM cron.unschedule('detect-games-in-red');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'detect-games-in-red',
  '*/2 * * * *',
  $$ SELECT public.detect_games_in_red(); $$
);

-- =========================================================================
-- 4) HOME SLIDES
-- =========================================================================
CREATE TABLE public.home_slides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position   int NOT NULL DEFAULT 0,
  image_url  text NOT NULL,
  eyebrow    text NOT NULL DEFAULT '',
  title      text NOT NULL,
  description text NOT NULL DEFAULT '',
  cta_label  text NOT NULL DEFAULT 'Ver más',
  cta_link   text NOT NULL DEFAULT '/home',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX home_slides_position_idx ON public.home_slides (position);

GRANT SELECT ON public.home_slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_slides TO authenticated;
GRANT ALL ON public.home_slides TO service_role;

ALTER TABLE public.home_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active slides"
  ON public.home_slides FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert slides"
  ON public.home_slides FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update slides"
  ON public.home_slides FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete slides"
  ON public.home_slides FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER home_slides_updated_at
  BEFORE UPDATE ON public.home_slides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 5) FEATURED GAMES
-- =========================================================================
CREATE TABLE public.home_featured_games (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position    int NOT NULL DEFAULT 0,
  image_url   text NOT NULL,
  name        text NOT NULL,
  tag         text NOT NULL DEFAULT 'POPULAR',
  tag_color   text NOT NULL DEFAULT 'purple', -- purple, emerald, rose, amber, fuchsia
  link        text NOT NULL DEFAULT '/home',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX home_featured_games_position_idx ON public.home_featured_games (position);

GRANT SELECT ON public.home_featured_games TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_featured_games TO authenticated;
GRANT ALL ON public.home_featured_games TO service_role;

ALTER TABLE public.home_featured_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active featured games"
  ON public.home_featured_games FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert featured games"
  ON public.home_featured_games FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update featured games"
  ON public.home_featured_games FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete featured games"
  ON public.home_featured_games FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER home_featured_games_updated_at
  BEFORE UPDATE ON public.home_featured_games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 6) Helpers para marcar notificaciones leídas (security definer)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mark_admin_notification_read(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.admin_notifications
     SET read_by = (SELECT array_agg(DISTINCT u) FROM unnest(read_by || ARRAY[v_user]) u)
   WHERE id = p_id
     AND NOT (v_user = ANY(read_by));
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_admin_notifications_read()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  WITH upd AS (
    UPDATE public.admin_notifications
       SET read_by = (SELECT array_agg(DISTINCT u) FROM unnest(read_by || ARRAY[v_user]) u)
     WHERE NOT (v_user = ANY(read_by))
     RETURNING 1
  ) SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;
