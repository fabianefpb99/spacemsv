# Migración de Blackjack al servidor

Cada usuario tendrá su propia partida privada (no compartida). El servidor es quien reparte cartas, controla el mazo y resuelve la mano. El cliente solo anima lo que el servidor le dice.

## Cómo va a sentirse el usuario

- Sin delay perceptible: cada acción (Repartir, Pedir, Plantarse, Doblar) hace **una sola llamada** al servidor y vuelve con todas las cartas necesarias para esa acción.
- Animaciones locales: el "vuelo" de las cartas, el flip del dealer y los sonidos siguen siendo instantáneos (no esperan al servidor más allá de la primera respuesta).
- Si el usuario recarga la página en medio de una mano, la partida se recupera tal cual estaba (las cartas siguen sobre la mesa).
- Saldo siempre sincronizado con el real (`useMe`), igual que ya hicimos en Slot.

## Reglas del juego (sin cambios)

- Apuesta mínima 500, máxima 100.000, paso 500.
- Blackjack natural paga 3:2, gana paga 2:1, empate devuelve la apuesta.
- Doblar solo disponible con 2 cartas.
- Dealer pide hasta 17 (soft 17 también se planta).
- **Ventaja de la casa preservada** (igual que hoy, pero ya validada y oculta en el servidor):
  - 8% de probabilidad de que la carta tapada del dealer sea una carta alta.
  - 5% de probabilidad de que el dealer mejore su mano al pedir.

---

## Detalles técnicos

### 1. Persistencia: usar `game_sessions` (ya existe)

Una partida = una fila con `game = 'blackjack'`, `user_id`, `status`. RLS ya bloquea SELECT directo del cliente: todo va por server functions con `supabaseAdmin`. Reutilizo las columnas existentes:

- `state` (jsonb privado): `{ shoe: number[] }` con los índices restantes del shoe de 6 mazos. Nunca se envía al cliente.
- `public_state` (jsonb público): `{ player: Card[], dealer: Card[], bet, doubled, phase, outcome?, payout? }`. La carta tapada del dealer va con `hidden: true` hasta el settle.
- `bet_amount`, `payout`, `server_seed`, `server_seed_hash`, `nonce` (concurrencia optimista), `client_action_id` (idempotencia de la jugada inicial).
- `status`: `open` mientras la mano corre, `closed` al terminar.

No hace falta migración: las columnas ya están y la policy `game_sessions_no_direct_select` ya bloquea el acceso directo del cliente.

### 2. Lógica server-only en TypeScript

Archivos nuevos:

- `src/lib/games/blackjack.shared.ts` (cliente + servidor): tipos (`Card`, `Suit`, `Outcome`, `BJPublicState`), constantes (`BJ_MIN_BET`, `BJ_MAX_BET`, `BJ_BET_STEP`), helpers puros (`handScore`, `isBlackjack`).
- `src/lib/games/blackjack.server.ts` (solo servidor): generación de shoe con `cryptoRandomInt`, draw normal, `drawHoleBiased` (8%), `drawForDealerHit` (5%), y la función `resolveDealer` que juega todo el turno del dealer en una sola pasada y devuelve la secuencia de cartas + resultado.
- `src/lib/games/blackjack.functions.ts`: 5 server functions, todas protegidas con `requireSupabaseAuth`:
  - `bjResume()` → devuelve la partida abierta del usuario si existe (para recuperar tras refresh).
  - `bjDeal({ bet, client_action_id })` → crea/abre sesión, debita apuesta vía `adjust_balance`, reparte 2+2 cartas, si es blackjack natural resuelve y settle.
  - `bjHit({ session_id, nonce, client_action_id })` → roba una carta, si pasa de 21 settle automático.
  - `bjStand({ session_id, nonce, client_action_id })` → juega el dealer completo, settle.
  - `bjDouble({ session_id, nonce, client_action_id })` → debita la segunda apuesta, roba una carta, juega dealer, settle.

Cada handler hace: lock de la fila (`SELECT ... FOR UPDATE` vía `rpc` o transacción), validar `nonce`, mutar `state`/`public_state`, incrementar `nonce`, devolver el nuevo `public_state` + `new_balance`. Si el settle suma payout, lo acredita con `adjust_balance` (tipo `win`, `game = 'blackjack'`, `client_action_id` derivado con `deriveActionId`).

Para evitar transacciones complejas en TS, voy a crear **una única función SQL** `bj_apply_action(p_session_id uuid, p_expected_nonce int, p_new_state jsonb, p_new_public_state jsonb, p_new_status text)` que hace `UPDATE ... WHERE id = ? AND nonce = ?` y devuelve la fila actualizada. Si no actualiza nada, error de concurrencia. La lógica de cartas vive en TS; SQL solo persiste el resultado de forma atómica.

### 3. Refactor del componente `BlackjackGame.tsx`

- Quitar `useState` del balance — usar `useMe()` (igual que `SlotGame.tsx`).
- Quitar `makeShoe`, `draw`, `drawHoleBiased`, `drawForDealerHit`, `resolve`, `dealerPlay` del cliente (ahora viven en el servidor).
- En vez de generar cartas localmente, el cliente:
  1. Llama a `bjDeal`, recibe `public_state` con las 4 cartas iniciales.
  2. Anima la repartida visualmente con los timings actuales (`setTimeout` 0/220/440/660ms para los 4 dealings), usando las cartas que vienen del servidor.
  3. Para `Stand`/`Double`/bust en `Hit`: el servidor devuelve la secuencia completa de cartas del dealer; el cliente las muestra una por una con `setTimeout` de 600ms, igual que hoy.
- En `useEffect` de mount: llama a `bjResume` y, si hay sesión abierta, rehidrata el estado visual sin animar.
- Optimistic update del saldo en `useMe` cache después de cada acción (igual que Slot).
- Mantener `client_action_id` (uuid v4) por acción para idempotencia.

### 4. Hardening

- Validación zod en cada server function (`bet` múltiplo de 500, dentro de rango, `nonce` int positivo, uuids válidos).
- El cliente nunca decide el resultado: aunque envíe "stand", el servidor recalcula `handScore` y juega al dealer él mismo.
- La carta tapada del dealer **nunca** se manda al cliente con su valor real hasta el settle.

### 5. Lo que NO toco

- Sonidos / animaciones / fondo / ticker de ganadores (puro cliente).
- Lógica de `RequireAuth` ya existente en la ruta.
- Tabla `game_sessions` (su schema ya alcanza).

---

## Archivos a crear

- `src/lib/games/blackjack.shared.ts`
- `src/lib/games/blackjack.server.ts`
- `src/lib/games/blackjack.functions.ts`
- Migración SQL: función `bj_apply_action(...)`.

## Archivos a modificar

- `src/components/BlackjackGame.tsx` (refactor a server-authoritative, mantiene 100% del UI).

## Riesgos / mitigaciones

- **Latencia en redes lentas**: cada acción es 1 round-trip. Para `Stand` se devuelve toda la secuencia del dealer en la primera respuesta, así no hay round-trips intermedios.
- **Doble click en "Repartir"**: idempotencia por `client_action_id` evita doble cobro.
- **Recarga en medio de la mano**: `bjResume` la recupera.
- **Concurrencia (usuario haciendo trampas con dos pestañas)**: `nonce` rechaza acciones obsoletas.