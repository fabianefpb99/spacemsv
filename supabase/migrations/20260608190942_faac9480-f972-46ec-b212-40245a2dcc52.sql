DO $$
DECLARE r record;
BEGIN
  -- spin_slot_v1: 100000 -> 50000
  FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='spin_slot_v1' LOOP
    EXECUTE replace(
      pg_get_functiondef(r.oid),
      'v_max_bet        numeric := 100000',
      'v_max_bet        numeric := 50000'
    );
  END LOOP;

  -- spin_roulette_v1: 500000 -> 50000
  FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='spin_roulette_v1' LOOP
    EXECUTE replace(
      pg_get_functiondef(r.oid),
      'v_max_bet      numeric := 500000',
      'v_max_bet      numeric := 50000'
    );
  END LOOP;

  -- spaceman_place_bet: hardcoded 100000 -> 50000
  FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='spaceman_place_bet' LOOP
    EXECUTE replace(
      pg_get_functiondef(r.oid),
      'p_amount > 100000',
      'p_amount > 50000'
    );
  END LOOP;
END $$;