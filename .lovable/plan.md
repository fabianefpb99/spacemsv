# 🔐 BETSPACE — Auditoría Funcional, Penetración y RTP

Este es un **informe técnico, no un plan de implementación**. No se aplicará ningún cambio hasta que apruebes una segunda fase. Solicítame "implementar P0", "implementar P0+P1", etc.

---

## TL;DR (lo que rompería el casino hoy)

1. 🔴 **Matemática rota en 4 juegos**: Dice, Mines, Slot y Arena pagan MUCHO menos que el RTP declarado en `game_rtp_config`. La tabla de RTP es **decorativa** — ningún juego la lee en runtime. Para Dice la desviación llega a −70 puntos. Riesgo legal/reputacional altísimo si auditas o si un usuario hace ingeniería inversa.
2. 🔴 **Spaceman acepta `p_client_elapsed_ms` desde el cliente**. Hay grace de 500 ms y un tope `< v_crash_elapsed_ms`, pero el cliente puede al menos manipular el multiplicador hacia abajo y posiblemente hacia arriba (los dos agentes discrepan; hay que confirmar el cuerpo SQL).
3. 🔴 **Missions admin CRUD se hace directo desde el navegador** con `supabase.from("missions").insert/update/delete` usando el JWT del usuario. Si la RLS de `missions` no bloquea writes a no-admin, cualquier usuario crea una misión con `reward_value: 999_999_999` y se autoacredita bonus.
4. 🔴 **Profiles UPDATE permite escribir `verification_status`** (KYC self-verify). El trigger `_profiles_lock_sensitive_cols` mitiga parte, pero no cubre `document_*` ni `birth_date`/`gender`, y hubo ventana entre dos migraciones donde estaba abierto.
5. 🟠 **Boost no respeta su propio RTP**: el campo `rtp_value` de `boost_sessions` no lo lee ningún juego. Boost = **100% win rate** (forzado), no 99% RTP. Esto puede arruinar tus métricas si lo usas en una cuenta no-marketing.
6. 🟠 **`is_boost_target` callable por cualquier `authenticated`** → enumeración de cuentas boosteadas.
7. 🟠 **`has_role(_user_id, _role)` acepta UUID arbitrario** y está expuesto a `authenticated` → enumeración de admins.

---

## 🔴 CRÍTICO

### C-1 — Spaceman: `p_client_elapsed_ms` proviene del cliente
- **Archivos**: `src/components/SpacemanGame.tsx:722-733`, `supabase/migrations/20260602060742_*.sql` (función `spaceman_cashout`)
- **Vector**: Interceptar la RPC y enviar un `p_client_elapsed_ms` arbitrario. Hay un `v_grace_ms = 500` y aparente clamp `< v_crash_elapsed_ms`, pero el cliente influye en `v_effective_ms`.
- **Impacto**: Si no hay `LEAST(client, server)`, multiplicadores 10×/100× a voluntad → casa drenada en horas.
- **Urgencia**: Verificar HOY el cuerpo completo de `spaceman_cashout` y confirmar `v_effective_ms := LEAST(p_client_elapsed_ms, v_server_elapsed_ms)`.
- **Fix**: Ignorar `p_client_elapsed_ms` por completo. Usar solo `now() - started_at` y aplicar `LEAST(v_server_elapsed_ms, v_crash_elapsed_ms)`.

### C-2 — Missions admin: escritura directa desde el navegador
- **Archivos**: `src/components/admin/MissionsSection.tsx:125, 132-135, 339-340`
- **Vector**: Cualquier usuario autenticado emite `supabase.from("missions").insert({...reward_value: 1e9, trigger_event:'manual'})`. Si RLS de `missions` no exige `has_role('admin')` para INSERT/UPDATE/DELETE, gana.
- **Impacto**: Bonus infinito autoasignado, control total del sistema de misiones.
- **Fix**: Mover CRUD de misiones a `createServerFn` con `assertAdmin` + `supabaseAdmin`. Añadir RLS `WITH CHECK (has_role(auth.uid(),'admin'))` para INSERT/UPDATE/DELETE en `missions`.

### C-3 — `profiles.verification_status` y campos KYC editables por el usuario
- **Archivos**: policy `profiles_update_own` (`20260630234031_*.sql`), trigger `_profiles_lock_sensitive_cols`
- **Vector**: `supabase.from('profiles').update({verification_status:'verified', document_type:'CC', document_number:'...'})`. La última migración del `WITH CHECK` cubre 11 columnas, pero el trigger restaurador solo cubre 6 — los campos `document_*`, `birth_date`, `gender` dependen solo del `WITH CHECK`, que ya tuvo una ventana abierta entre dos migraciones (`20260630200959` → `20260630234031`).
- **Impacto**: Self-KYC, evasión de límites de retiro/bonus si dependen de `verification_status`.
- **Fix**: Sincronizar el trigger con el `WITH CHECK`. Considerar mover toda la edición de KYC a server fn con admin/usuario validado por flujo de soporte.

### C-4 — RTP matemático no coincide con `game_rtp_config` (varios juegos)
| Juego | RTP teórico real | RTP configurado | Δ |
|---|---|---|---|
| Dice | **28–56 %** según multiplicador | 98.10 % | −40 a −70 pp |
| Mines | **80–84 %** (hardcoded en `rtpFor()`) | 97.00 % | −13 a −17 pp |
| Slot | **~71.6 %** (paytable × weights) | 94.50 % | −23 pp |
| Arena | **79.9–85.8 %** SQL real | 91.50 % | −6 a −12 pp |
| Chicken | **~85 %** (step1=1.05 rompe `CHICKEN_RTP=0.97`) | — | comentario dice 97 |
| Roulette | 97.30 % red/black v2 ✅ / **37.8 % verde** | 97.30 % | verde sin reflejar |
| Spaceman | 97.00 % por fórmula | 96.20 % | +0.8 pp (favor jugador) |
| Blackjack | ~99.4–99.5 % estimado | 99.00 % | ~+0.4 pp |
- **Vector**: la tabla `game_rtp_config` no se lee en ningún `play_*` SQL ni en los `*.shared.ts`. Cambiar el valor desde el admin no afecta nada.
- **Impacto**: Compliance/legal (publicidad engañosa), reputación, exposición a reclamaciones, y la UI de Arena muestra cuotas distintas a las reales del backend (3.30/8.0× vs 2.30/6.50×).
- **Fix**: O bien (a) reescribir los paytables/weights para que coincidan con el RTP declarado, o (b) ajustar `game_rtp_config` para que refleje el RTP real. Adicional: que los `play_*` lean `game_rtp_config` y deriven multiplicadores en runtime para que el admin tenga control real.

### C-5 — Boost ignora `rtp_value` y fuerza 100 % win rate
- **Archivos**: `20260630155134_*.sql:76-82` (roulette), `dice.functions.ts:116`, `slot` v1, `mines.functions.ts:285`, `chicken.functions.ts:205`
- **Vector**: Activar boost = ganar cada apuesta no-verde, todas las casillas safe, todas las gallinas vivas, dado siempre gana. `boost_sessions.rtp_value` (default 99.1) nunca se lee.
- **Impacto**: Imposible usar boost como "RTP elevado realista" para marketing/demos. Una cuenta boosteada es trivialmente detectable y puede vaciar la casa si el admin se equivoca de target.
- **Fix**: O renombrar a "Modo Demo Garantizado" y documentar, o implementar verdadero shift de RTP (manipular weights, no forzar `won=true`).

---

## 🟠 ALTO

### A-1 — `is_boost_target(uuid,text)` callable por `authenticated`
- `20260630154829_*.sql:50` (parcialmente revocado en `20260630234259_*.sql`, verificar estado actual).
- Vector: cualquier usuario enumera quién está boosteado. Un boosteado se autodetecta y maximiza su provecho.
- **Fix**: `REVOKE ... FROM authenticated, anon`. Solo `service_role`.

### A-2 — `has_role(_user_id,_role)` acepta UUID arbitrario y es público
- `migrations/20260602022000_*.sql`
- Vector: enumeración de admins, base para ataques sociales/credential stuffing dirigidos.
- **Fix**: Versión `has_role()` sin parámetros que use `auth.uid()` internamente. Restringir EXECUTE de la versión con `_user_id` a `service_role`.

### A-3 — Admin RPCs ejecutadas con cliente user-scoped y GRANT a `authenticated`
- `admin_adjust_balance`, `admin_update_rtp`, `admin_set_block`, `admin_adjust_xp`, `admin_start_boost`, `admin_stop_boost`, `admin_approve_deposit`, `admin_approve_withdrawal`
- Defensa actual: cada SQL hace `has_role(auth.uid(),'admin')`. Pero la GRANT a `authenticated` reduce defensa en profundidad — si alguna olvida el check (no se verificó `admin_adjust_balance/_set_block/_adjust_xp/_update_rtp`), es exploit directo.
- **Fix**: Auditar los 4 cuerpos SQL que faltaron. Revocar GRANT a `authenticated` en todas; llamarlas desde TS con `supabaseAdmin` después de `assertAdmin`.

### A-4 — `cancelMyDeposit` / `cancelMyWithdrawal` ignoran `context.userId`
- `src/lib/deposits/deposit.functions.ts:205-213`, `src/lib/withdrawals/withdrawal.functions.ts:63-71`
- Vector: si los SQL `cancel_*_request` no validan `user_id = auth.uid()`, cualquier usuario cancela transacciones ajenas.
- **Fix**: Pre-check de ownership con `supabaseAdmin` antes de la RPC (como ya hace `confirmDeposit:127`).

### A-5 — Mines boost usa `Math.random()` para el swap
- `mines.functions.ts:297`
- **Fix**: Usar `cryptoRandomInt(candidates.length)`.

### A-6 — `bj_apply_action` sin GRANTS verificados
- Llamada desde TS con `supabaseAdmin` (correcto), pero falta confirmar que esté revocada para `authenticated`. Si está abierta, un jugador podría avanzar/replay manos de Blackjack/Mines/Chicken de otros.
- **Fix**: `REVOKE EXECUTE ... FROM authenticated, anon` y dejar solo `service_role`.

### A-7 — Arena: `p_odds_perm` viene del cliente
- `20260630182029_*.sql:43-63`
- El SQL valida que es permutación de [1..4], pero el cliente decide qué personaje obtiene cada peso. Si el cliente conoce la permutación antes del commit y el server no la sortea, hay ventaja informacional (apostar al de mayor probabilidad/menor odd).
- **Fix**: Sortear `odds_perm` server-side con `gen_random_bytes` y devolverlo en la respuesta, no aceptar del cliente.

---

## 🟡 MEDIO

| ID | Hallazgo | Archivo |
|---|---|---|
| M-1 | Profiles `WITH CHECK` desincronizado con trigger en `document_*`/`birth_date`/`gender` | `20260630234031_*.sql` + trigger |
| M-2 | `claim_vip_reward`: crédito a balance ocurre antes del `UPDATE claimed_at` (idem trans, pero conviene reordenar) | `20260626010019_*.sql:251-316` |
| M-3 | Blackjack: sesiones `playing` no se auto-cierran (DoS personal, no exploit económico) | `blackjack.functions.ts:261-277` |
| M-4 | Realtime publica `deposit_requests` enteros (PII: `phone`, `first_name`, `last_name`) | `20260602200423_*.sql:288` |
| M-5 | `adminAdjustBalance.amount` sin límite superior — un click erróneo acredita 10^12 | `admin.functions.ts:173-196` |
| M-6 | `spin_slot_v1`/`spin_*_v1` reciben `p_user_id` por parámetro vía `supabaseAdmin` — depende 100% de que el TS no pase user_id del body | varios `*.functions.ts` |
| M-7 | RPCs `v1` (arena, roulette) siguen existiendo y son llamables por `service_role` con cualquier `p_user_id` | `20260630182029_*.sql` |
| M-8 | `redeem_referral` ejecutada desde el cliente — verificar `auth.uid()` y prevención self-referral (existe error `self_referral`, hay que confirmar uso) | `AuthDialog.tsx:300` |

---

## 🟢 BAJO / INFO

- `/api/public/img` con allowlist de buckets + MIME forzado — ✅ correcto.
- `safeRpcError` permite solo códigos `snake_case ≤64 chars` — ✅ correcto.
- Realtime admin topics (`admin-stats-tx`, `admin-deposits-rt`) — ✅ gated.
- `user_vip` / `user_missions` en Realtime — revisar que RLS limite a own-row.

---

## ✅ LO QUE ESTÁ BIEN PROTEGIDO

1. **JWT chain**: `requireSupabaseAuth` extrae `userId` de `getClaims(token)`, nunca del body. `auth-middleware.ts:63-76`.
2. **`adjust_balance`** REVOKE a `authenticated`, idempotente por `(user_id, client_action_id)`, locks `user_balances FOR UPDATE`, rechaza balance negativo.
3. **RNG criptográfico** (`cryptoRandomInt` con rejection sampling, `gen_random_bytes` server-side) — excepto el bug A-5.
4. **Withdrawals**: balance check + `FOR UPDATE` atómico, doble aprobación bloqueada por `status` + lock.
5. **VIP claim**: `FOR UPDATE` + `already_claimed` short-circuit.
6. **Spaceman crash point** se pre-determina server-side; `server_seed` REVOKE en `game_rounds` y excluido de Realtime.
7. **Blackjack hole card** y `state.shoe` enmascarados antes de salir del server.
8. **Mines `mineSet`** nunca se filtra al cliente hasta `phase = "result"`.
9. **`game_sessions` SELECT policy = USING(false)** — invisible para todos los usuarios.
10. **Game session nonce** previene replays en BJ/Mines/Chicken.
11. **Idempotencia universal** vía `client_action_id` + `deriveActionId` para escrituras secundarias.
12. **`_check_vip_rewards`, `is_boost_target`, `_profiles_lock_sensitive_cols`, `_mission_period_start`, email-queue helpers** con `search_path` fijo y revoke reciente — ✅.

---

## 📋 PLAN DE REMEDIACIÓN SUGERIDO (por prioridad)

**P0 (antes de lanzamiento público):**
- C-1 Spaceman elapsed (confirmar SQL y forzar `LEAST(client,server)`)
- C-2 Missions admin → server fns + RLS
- C-3 Profiles KYC: sincronizar trigger con `WITH CHECK`
- C-4 Decidir: ajustar `game_rtp_config` para que refleje el RTP real, o reescribir paytables para alcanzar los RTP declarados (decisión de negocio)
- C-5 Decidir si Boost se rediseña o se redefine como "Modo Demo"

**P1 (semana 1 post-lanzamiento):**
- A-1, A-2, A-3, A-4, A-6, A-7

**P2 (sprint de hardening):**
- A-5, M-1 a M-8

---

¿Quieres que pase a **modo build** y arranque por P0 (C-1 a C-5)? Si prefieres, dime qué hallazgos específicos atacar primero (por ID) y los implemento en lotes.