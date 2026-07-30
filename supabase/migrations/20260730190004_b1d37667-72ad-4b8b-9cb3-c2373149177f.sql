DO $$
DECLARE d text;
BEGIN
  -- Slot Mafia: -3% en premios bajos (3 iguales), ese valor va a los premios mayores (5 iguales)
  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'spin_slot_v1';
  IF d IS NULL THEN RAISE EXCEPTION 'spin_slot_v1 not found'; END IF;
  IF position('ARRAY[55,34,24,19,17,14,12,11]' in d) = 0
     OR position('ARRAY[1100,440,240,165,95,68,50,32]' in d) = 0 THEN
    RAISE EXCEPTION 'spin_slot_v1 paytable no coincide con lo esperado';
  END IF;
  d := replace(d, 'ARRAY[55,34,24,19,17,14,12,11]', 'ARRAY[53,33,23,18,16,14,11,11]');
  d := replace(d, 'ARRAY[1100,440,240,165,95,68,50,32]', 'ARRAY[1420,570,310,213,123,88,65,41]');
  EXECUTE d;

  -- Slot Samurai: mismo criterio
  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'spin_slot_samurai_v1';
  IF d IS NULL THEN RAISE EXCEPTION 'spin_slot_samurai_v1 not found'; END IF;
  IF position('ARRAY[60,38,26,22,14,11,9,8]' in d) = 0
     OR position('ARRAY[1100,440,240,165,95,68,50,32]' in d) = 0 THEN
    RAISE EXCEPTION 'spin_slot_samurai_v1 paytable no coincide con lo esperado';
  END IF;
  d := replace(d, 'ARRAY[60,38,26,22,14,11,9,8]', 'ARRAY[58,37,25,21,13,10,9,8]');
  d := replace(d, 'ARRAY[1100,440,240,165,95,68,50,32]', 'ARRAY[1265,506,276,190,109,78,58,37]');
  EXECUTE d;
END $$;