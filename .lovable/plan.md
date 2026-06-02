
# Migración a backend autoritativo (Supabase como única fuente de verdad)

Esto es un cambio grande y sensible (dinero). Lo planteo en **fases secuenciales**, cada una desplegable y verificable de forma independiente. Nada se rompe en el camino: la UI sigue idéntica.

---

## Principios no negociables

1. **El cliente nunca escribe `user_balances` ni `transactions`.** RLS solo permite SELECT propio. Toda mutación pasa por server functions con `supabaseAdmin` dentro de una función SQL transaccional.
2. **El cliente nunca calcula resultados oficiales.** Multiplicadores, cartas, minas, dados y giros se generan con `crypto.randomBytes` en el servidor.
3. **Idempotencia obligatoria.** Cada acción del cliente envía un `client_action_id` (UUID). El backend deduplica por `(user_id, client_action_id)` para anular dobles clics, reintentos y condiciones de carrera.
4. **Locks por usuario y por partida.** Cada mutación usa `SELECT … FOR UPDATE` sobre la fila del balance / partida → cero race conditions.
5. **Auditoría completa.** Toda transacción queda en `transactions` con `balance_after`, `game`, `round_id`/`game_id` y `meta` (apuesta, resultado, seed hash). Append-only.
6. **Provably fair.** Cada resultado se genera con `server_seed` (secreto) + `client_seed` (opcional) + `nonce`. Se publica el `hash(server_seed)` antes y el `server_seed` después → el jugador puede verificar.

---

## Fase 0 — Fundaciones de seguridad (SQL)

Una sola migración que sienta la base para todo lo demás.

### Cambios de esquema

- `transactions`: añadir `client_action_id uuid`, `game_round_id uuid`, índice único `(user_id, client_action_id)` → idempotencia.
- Nueva tabla `game_rounds` (Spaceman y futuras rondas globales):
  - `id`, `game`, `status` (`betting | running | crashed | settled`), `crash_multiplier numeric`, `server_seed_hash text`, `server_seed text null` (se revela tras crash), `started_at`, `ended_at`.
- Nueva tabla `game_bets` (apuestas por ronda, Spaceman):
  - `id`, `round_id`, `user_id`, `amount`, `cashout_multiplier null`, `payout null`, `status` (`active | cashed_out | lost`), `client_action_id`, índice único `(round_id, user_id)`.
- Nueva tabla `game_sessions` (Mines, Blackjack — estado privado por partida):
  - `id`, `user_id`, `game`, `state jsonb` (oculto al cliente), `public_state jsonb` (lo que sí ve el cliente), `bet_amount`, `status`, `server_seed`, `server_seed_hash`, `created_at`, `closed_at`.
  - RLS: el usuario ve `public_state` pero **nunca** `state` ni `server_seed` mientras la partida está abierta (se exponen vía view filtrada o solo a través de server functions).

### Función SQL transaccional central

```sql
adjust_balance(p_user_id, p_delta numeric, p_type, p_game, p_round_id, p_client_action_id, p_meta)
  -- SECURITY DEFINER
  -- 1. SELECT … FOR UPDATE sobre user_balances
  -- 2. validar saldo >= 0 si p_delta < 0 (raise EXCEPTION 'insufficient_funds')
  -- 3. UPDATE balance
  -- 4. INSERT transactions con balance_after y client_action_id
  -- 5. ON CONFLICT (user_id, client_action_id) DO NOTHING + retornar transacción existente (idempotencia)
  -- 6. RETURN nuevo balance
```

Todas las server functions de juego llaman esta función → única ruta posible para mover dinero.

---

## Fase 1 — Server functions e infraestructura cliente

- `src/lib/games/_engine.server.ts`: helpers `requireUser`, `getBalance`, `adjustBalance`, RNG criptográfico (`crypto.randomBytes`), provably-fair (`sha256(server_seed:client_seed:nonce)`).
- `src/lib/games/_engine.functions.ts`: `getMyBalance` (reemplaza la lectura directa).
- Hook `useBalance()` (sustituye `useState(100000)` en todos los juegos) → React Query sobre `getMyBalance`, invalida en cada respuesta del backend.
- Middleware ya existente `requireSupabaseAuth` se reutiliza.
- Si el usuario **no está logueado** y entra a un juego: se muestra el juego en modo "solo demo visual" pero **no se puede apostar** (botón apostar deshabilitado → abre `AuthDialog`). Acordamos esto en el mensaje anterior; lo confirmas o cambiamos a "bloquear acceso completo".

---

## Fase 2 — Tragamonedas (el más simple, validamos la arquitectura aquí)

- `spinSlot.functions.ts`:
  - Input: `{ bet_amount, client_action_id }`.
  - Servidor: valida bet, descuenta saldo (`adjust_balance` tipo `bet`), genera símbolos con RNG, calcula payout con tabla oficial, acredita premio (`adjust_balance` tipo `win`), responde `{ symbols, payout, new_balance, round_id }`.
- Cliente `SlotGame.tsx`: en "girar" llama `spinSlot`, anima los carretes para **acabar exactamente** en los símbolos devueltos, muestra el `new_balance` real.
- Cero cambios visuales.

---

## Fase 3 — Dados

Mismo patrón que slot pero más simple:
- `rollDice({ bet_amount, prediction, client_action_id })` → genera 1-6 con `crypto`, calcula payout, ajusta balance, responde resultado oficial.
- Cliente anima el dado y aterriza en el número devuelto.

---

## Fase 4 — Mines (estado privado en servidor)

- `startMines({ bet_amount, mines_count, client_action_id })` → crea `game_sessions`, genera tablero secreto, devuelve solo `{ session_id, mines_count, server_seed_hash }`. Descuenta apuesta.
- `revealTile({ session_id, tile_index, client_action_id })` → carga sesión (FOR UPDATE), verifica que la casilla no fue revelada, devuelve `{ is_mine, current_multiplier, public_state }`. Si es mina → cierra sesión, revela `server_seed`.
- `cashoutMines({ session_id, client_action_id })` → acredita premio, cierra sesión, revela `server_seed`.
- RLS impide leer `state` y `server_seed` mientras `status='open'`.

---

## Fase 5 — Blackjack (lógica completa server-side)

- `startBlackjack`, `hit`, `stand`, `double` como server functions independientes.
- `game_sessions.state` guarda mazo barajado (secreto), cartas del dealer ocultas, mano del jugador.
- `public_state` solo expone cartas visibles (jugador completa + 1 del dealer).
- Stand → backend resuelve dealer determinísticamente desde el mazo guardado, calcula resultado, ajusta saldo, revela mazo completo.
- Cliente solo renderiza cartas devueltas.

---

## Fase 6 — Spaceman (rondas globales) — el más complejo

Dos partes:

### 6a. Motor de rondas
- Server route `POST /api/internal/spaceman/tick` protegido por secret + `pg_cron` cada ~2-3 s.
- Cada tick:
  1. Si no hay ronda activa: crear nueva con `server_seed`, `server_seed_hash`, fase `betting` (5 s).
  2. Tras `betting` → fase `running`, calcular `crash_multiplier` desde `hash(server_seed)` con curva oficial.
  3. Cuando el tiempo de subida alcanza `crash_multiplier` → marcar `crashed`, liquidar perdedoras, revelar `server_seed`.
- Alternativa si `pg_cron` da problemas: tick disparado por el primer cliente activo (race-safe vía `INSERT ON CONFLICT`).

### 6b. Apuestas y cashout
- `placeSpacemanBet({ amount, client_action_id })` → solo en fase `betting`. Inserta `game_bets`, descuenta saldo.
- `cashoutSpaceman({ round_id, client_action_id })` → solo en `running` y antes del crash. Lee `current_multiplier` autoritativo del servidor (calculado desde `started_at` y curva), acredita premio.
- Realtime: cliente suscrito a `game_rounds` (estado/multiplicador) y a sus propias `game_bets`. Un canal único compartido por todos los juegos abiertos.

---

## Fase 7 — Endurecimiento

- Rate limiting por usuario (tabla `rate_limits` o memoria del Worker con KV) — máx N apuestas/segundo por juego.
- Logs estructurados de cada apuesta (`stack_modern--server-function-logs`).
- Tests de:
  - Idempotencia (mismo `client_action_id` 2 veces → un solo movimiento).
  - Saldo insuficiente → rechazo y cero efecto.
  - Doble cashout en Spaceman → segundo es no-op.
  - Manipulación de respuesta (cliente que miente) → no afecta porque el balance real solo lo conoce el servidor.
- Linter SQL (`supabase--linter`) en verde.
- Revisión de RLS (`security--run_security_scan`).

---

## Lo que NO cambia

- Diseño visual, sonidos, animaciones, navegación, rutas, layouts, identidad visual.
- Configuración de auth, OAuth Google, dominios, secrets.
- Tablas existentes (solo se **añaden** columnas/tablas, nada destructivo).

---

## Detalles técnicos clave

- **Sin Edge Functions.** Todo es `createServerFn` + server routes (TanStack Start) usando `supabaseAdmin` para escribir y `requireSupabaseAuth` para identificar al usuario.
- **Idempotencia:** UNIQUE `(user_id, client_action_id)` en `transactions` + manejo `ON CONFLICT` → reintentos seguros.
- **Concurrencia:** `FOR UPDATE` en `user_balances` y `game_sessions`. Todas las mutaciones dentro de una sola función SQL = atomicidad real.
- **RNG:** `crypto.randomBytes(32)` para `server_seed`, derivación determinística para cada resultado → auditable.
- **Realtime:** solo en Spaceman (`game_rounds` y `game_bets` del usuario). Una sola suscripción por canal, cleanup obligatorio.
- **Migración progresiva:** cada fase se mergea y verifica antes de la siguiente. Si una fase falla, las anteriores siguen funcionando.

---

## Lo que necesito confirmar antes de empezar

1. **Usuario no logueado en un juego:** ¿modo "demo visual sin apostar" o **bloquear** el juego y forzar login? (recomiendo bloquear — más simple y más seguro).
2. **Saldo inicial al registrarse:** hoy es **0**. ¿Quieres bono de bienvenida (ej. 10.000 COP) acreditado vía trigger / función? (puedo hacerlo configurable).
3. **Orden de fases:** propongo **0 → 1 → 2 (slot) → 3 (dados) → 4 (mines) → 5 (blackjack) → 6 (spaceman) → 7 (hardening)**. Spaceman al final porque es el más complejo (rondas globales + realtime + cron). ¿OK o prefieres otro orden?
4. **Tabla de pagos oficial:** ¿confirmas que las tablas de premios actuales de cada juego (multiplicadores de slot, payouts de dados, curva de mines, etc.) son las definitivas, o quieres revisarlas en esta migración? Si no me dices nada, replico exactamente las que están en el frontend hoy.

Cuando confirmes estos 4 puntos arranco con la Fase 0.
