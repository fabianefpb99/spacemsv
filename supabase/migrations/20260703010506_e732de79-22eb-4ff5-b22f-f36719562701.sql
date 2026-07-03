
-- ============================================================
-- SPORTS MODULE — Phase 1: schema, security, automation
-- ============================================================

-- Timezone setting (server-authoritative)
INSERT INTO public.site_settings (key, value)
VALUES ('sports_timezone', to_jsonb('America/Bogota'::text))
ON CONFLICT (key) DO NOTHING;

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.sports_match_status AS ENUM ('scheduled','live','finished','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sports_bet_selection AS ENUM ('home','draw','away');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sports_bet_status AS ENUM ('pending','won','lost','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Competitions ----------
CREATE TABLE IF NOT EXISTS public.sports_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sports_competitions TO anon, authenticated;
GRANT ALL ON public.sports_competitions TO service_role;

ALTER TABLE public.sports_competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sports_competitions read active"
  ON public.sports_competitions FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "sports_competitions admin write"
  ON public.sports_competitions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- Matches ----------
CREATE TABLE IF NOT EXISTS public.sports_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.sports_competitions(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  home_name text NOT NULL,
  home_flag_code text NOT NULL,
  away_name text NOT NULL,
  away_flag_code text NOT NULL,
  start_at timestamptz NOT NULL,
  status public.sports_match_status NOT NULL DEFAULT 'scheduled',
  odds_home numeric(6,2) NOT NULL CHECK (odds_home >= 1.01 AND odds_home <= 999.99),
  odds_draw numeric(6,2) NOT NULL CHECK (odds_draw >= 1.01 AND odds_draw <= 999.99),
  odds_away numeric(6,2) NOT NULL CHECK (odds_away >= 1.01 AND odds_away <= 999.99),
  home_score integer CHECK (home_score IS NULL OR home_score >= 0),
  away_score integer CHECK (away_score IS NULL OR away_score >= 0),
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  bets_closed_at timestamptz,
  settled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sports_matches_start_at_idx ON public.sports_matches(start_at);
CREATE INDEX IF NOT EXISTS sports_matches_status_idx ON public.sports_matches(status);
CREATE INDEX IF NOT EXISTS sports_matches_competition_idx ON public.sports_matches(competition_id);
CREATE INDEX IF NOT EXISTS sports_matches_published_idx ON public.sports_matches(is_published) WHERE is_published = true;

GRANT SELECT ON public.sports_matches TO anon, authenticated;
GRANT ALL ON public.sports_matches TO service_role;

ALTER TABLE public.sports_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sports_matches read published"
  ON public.sports_matches FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "sports_matches admin write"
  ON public.sports_matches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- Bets ----------
CREATE TABLE IF NOT EXISTS public.sports_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.sports_matches(id) ON DELETE RESTRICT,
  selection public.sports_bet_selection NOT NULL,
  stake numeric(14,2) NOT NULL CHECK (stake > 0),
  odds numeric(6,2) NOT NULL CHECK (odds >= 1.01),
  potential_payout numeric(14,2) NOT NULL CHECK (potential_payout > 0),
  status public.sports_bet_status NOT NULL DEFAULT 'pending',
  payout numeric(14,2),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sports_bets_user_idx ON public.sports_bets(user_id);
CREATE INDEX IF NOT EXISTS sports_bets_match_idx ON public.sports_bets(match_id);
CREATE INDEX IF NOT EXISTS sports_bets_status_idx ON public.sports_bets(status);

GRANT SELECT, INSERT ON public.sports_bets TO authenticated;
GRANT ALL ON public.sports_bets TO service_role;

ALTER TABLE public.sports_bets ENABLE ROW LEVEL SECURITY;

-- Users can only read their own bets. Never insert directly (RPC does it).
CREATE POLICY "sports_bets user read own"
  ON public.sports_bets FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Deny client inserts; the SECURITY DEFINER RPC handles bet placement.
CREATE POLICY "sports_bets admin write"
  ON public.sports_bets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- updated_at triggers ----------
CREATE OR REPLACE FUNCTION public.sports_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sports_competitions_touch ON public.sports_competitions;
CREATE TRIGGER trg_sports_competitions_touch
  BEFORE UPDATE ON public.sports_competitions
  FOR EACH ROW EXECUTE FUNCTION public.sports_touch_updated_at();

DROP TRIGGER IF EXISTS trg_sports_matches_touch ON public.sports_matches;
CREATE TRIGGER trg_sports_matches_touch
  BEFORE UPDATE ON public.sports_matches
  FOR EACH ROW EXECUTE FUNCTION public.sports_touch_updated_at();

-- ============================================================
-- Server-authoritative RPCs (SECURITY DEFINER)
-- ============================================================

-- Place a bet: validates match is open, snapshots odds from DB,
-- debits balance atomically, creates transaction. Client-sent odds are ignored.
CREATE OR REPLACE FUNCTION public.sports_place_bet(
  _match_id uuid,
  _selection public.sports_bet_selection,
  _stake numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match public.sports_matches%ROWTYPE;
  v_odds numeric(6,2);
  v_balance numeric(14,2);
  v_stake numeric(14,2);
  v_payout numeric(14,2);
  v_bet_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_stake := round(_stake::numeric, 2);
  IF v_stake IS NULL OR v_stake <= 0 THEN
    RAISE EXCEPTION 'invalid_stake' USING ERRCODE = '22023';
  END IF;

  -- Lock the match row to prevent status-race between validation and insert
  SELECT * INTO v_match
    FROM public.sports_matches
    WHERE id = _match_id
    FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_match.is_published THEN
    RAISE EXCEPTION 'match_not_available' USING ERRCODE = '22023';
  END IF;
  IF v_match.status <> 'scheduled' OR v_match.start_at <= now() OR v_match.bets_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'bets_closed' USING ERRCODE = '22023';
  END IF;

  v_odds := CASE _selection
    WHEN 'home' THEN v_match.odds_home
    WHEN 'draw' THEN v_match.odds_draw
    WHEN 'away' THEN v_match.odds_away
  END;

  v_payout := round(v_stake * v_odds, 2);

  -- Lock user balance row and debit
  SELECT balance INTO v_balance
    FROM public.user_balances
    WHERE user_id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'balance_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_balance < v_stake THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_balances
    SET balance = balance - v_stake, updated_at = now()
    WHERE user_id = v_user_id;

  INSERT INTO public.sports_bets (
    user_id, match_id, selection, stake, odds, potential_payout, status
  ) VALUES (
    v_user_id, _match_id, _selection, v_stake, v_odds, v_payout, 'pending'
  )
  RETURNING id INTO v_bet_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
  VALUES (
    v_user_id, 'bet', -v_stake, v_balance - v_stake, 'sports',
    jsonb_build_object('sports_bet_id', v_bet_id, 'match_id', _match_id, 'selection', _selection, 'odds', v_odds)
  );

  RETURN v_bet_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sports_place_bet(uuid, public.sports_bet_selection, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sports_place_bet(uuid, public.sports_bet_selection, numeric) TO authenticated;

-- Settle a match: admin sets scores, server determines winner, pays winners
CREATE OR REPLACE FUNCTION public.sports_settle_match(
  _match_id uuid,
  _home_score integer,
  _away_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_match public.sports_matches%ROWTYPE;
  v_winner public.sports_bet_selection;
  v_bet RECORD;
  v_balance_after numeric(14,2);
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;
  IF _home_score IS NULL OR _away_score IS NULL OR _home_score < 0 OR _away_score < 0 THEN
    RAISE EXCEPTION 'invalid_score' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match FROM public.sports_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_match.status = 'cancelled' THEN RAISE EXCEPTION 'match_cancelled' USING ERRCODE = '22023'; END IF;
  IF v_match.status = 'finished' AND v_match.settled_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_settled' USING ERRCODE = '22023';
  END IF;

  v_winner := CASE
    WHEN _home_score > _away_score THEN 'home'::public.sports_bet_selection
    WHEN _home_score < _away_score THEN 'away'::public.sports_bet_selection
    ELSE 'draw'::public.sports_bet_selection
  END;

  UPDATE public.sports_matches
    SET status = 'finished',
        home_score = _home_score,
        away_score = _away_score,
        settled_at = now(),
        bets_closed_at = COALESCE(bets_closed_at, now())
    WHERE id = _match_id;

  FOR v_bet IN
    SELECT * FROM public.sports_bets
      WHERE match_id = _match_id AND status = 'pending'
      FOR UPDATE
  LOOP
    IF v_bet.selection = v_winner THEN
      -- Winner: credit potential_payout
      SELECT balance + v_bet.potential_payout INTO v_balance_after
        FROM public.user_balances WHERE user_id = v_bet.user_id FOR UPDATE;

      UPDATE public.user_balances
        SET balance = balance + v_bet.potential_payout, updated_at = now()
        WHERE user_id = v_bet.user_id;

      UPDATE public.sports_bets
        SET status = 'won', payout = v_bet.potential_payout, settled_at = now()
        WHERE id = v_bet.id;

      INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
      VALUES (
        v_bet.user_id, 'win', v_bet.potential_payout, v_balance_after, 'sports',
        jsonb_build_object('sports_bet_id', v_bet.id, 'match_id', _match_id, 'winner', v_winner)
      );
    ELSE
      UPDATE public.sports_bets
        SET status = 'lost', payout = 0, settled_at = now()
        WHERE id = v_bet.id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sports_settle_match(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sports_settle_match(uuid, integer, integer) TO authenticated;

-- Cancel a match: refund every pending bet
CREATE OR REPLACE FUNCTION public.sports_cancel_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_match public.sports_matches%ROWTYPE;
  v_bet RECORD;
  v_balance_after numeric(14,2);
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match FROM public.sports_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_match.status = 'cancelled' THEN RETURN; END IF;
  IF v_match.status = 'finished' AND v_match.settled_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_settled' USING ERRCODE = '22023';
  END IF;

  UPDATE public.sports_matches
    SET status = 'cancelled', cancelled_at = now(), bets_closed_at = COALESCE(bets_closed_at, now())
    WHERE id = _match_id;

  FOR v_bet IN
    SELECT * FROM public.sports_bets
      WHERE match_id = _match_id AND status = 'pending'
      FOR UPDATE
  LOOP
    SELECT balance + v_bet.stake INTO v_balance_after
      FROM public.user_balances WHERE user_id = v_bet.user_id FOR UPDATE;

    UPDATE public.user_balances
      SET balance = balance + v_bet.stake, updated_at = now()
      WHERE user_id = v_bet.user_id;

    UPDATE public.sports_bets
      SET status = 'refunded', payout = v_bet.stake, settled_at = now()
      WHERE id = v_bet.id;

    INSERT INTO public.transactions (user_id, type, amount, balance_after, game, meta)
    VALUES (
      v_bet.user_id, 'adjustment', v_bet.stake, v_balance_after, 'sports',
      jsonb_build_object('sports_bet_id', v_bet.id, 'match_id', _match_id, 'reason', 'match_cancelled_refund')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sports_cancel_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sports_cancel_match(uuid) TO authenticated;

-- Auto-transition scheduled → live when start time is reached
CREATE OR REPLACE FUNCTION public.sports_auto_transition()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.sports_matches
      SET status = 'live', bets_closed_at = now()
      WHERE is_published = true
        AND status = 'scheduled'
        AND start_at <= now()
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sports_auto_transition() FROM PUBLIC;

-- ============================================================
-- pg_cron: run auto-transition every minute
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'sports_auto_transition_every_minute';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'sports_auto_transition_every_minute',
    '* * * * *',
    $cron$SELECT public.sports_auto_transition();$cron$
  );
END $$;

-- ============================================================
-- Seed initial competition (Mundial 2026)
-- ============================================================
INSERT INTO public.sports_competitions (slug, name, sort_order)
VALUES ('mundial-2026', 'Mundial 2026', 0)
ON CONFLICT (slug) DO NOTHING;
