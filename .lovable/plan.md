# Propuesta: Modo "Showcase" para cuentas de marketing/demo

No hay código por implementar todavía. Esto es solo un análisis de arquitectura y trade-offs.

## 1. Cómo está construido BETSPACE hoy (lo relevante)

- **Toda la economía pasa por un único punto**: `public.adjust_balance` (SQL, SECURITY DEFINER). Lo llama `engine.server.ts → adjustBalance(...)`, y todos los juegos (`slot`, `dice`, `mines`, `blackjack`, `chicken`, `arena`, `ruleta`) entran por ahí.
- **Cada juego es un `createServerFn` con `requireSupabaseAuth`**: el `userId` y el `supabase` autenticado llegan en `context`. El RNG vive 100% en el server (`engine.server.ts`, `*.shared.ts`, RPC `spin_roulette_v1`, etc.).
- **Roles ya existen** vía `user_roles` + enum `app_role` + función `has_role(uuid, app_role)`. Hoy solo se usa `admin`.
- **Estadísticas/ranking/misiones/RTP/recent wins** se derivan de `transactions`, `game_rounds`, `game_bets`, `arena_rounds`, `user_missions`, `user_vip`. Todas las escrituras pasan por los mismos server fns o por triggers sobre esas tablas.
- **Saldo se lee** de `user_balances` (real + bonus). El header suma ambos.

Esto es muy bueno para nosotros: hay **un cuello de botella** (`adjust_balance` y los server fns) en lugar de lógica de dinero esparcida por la UI.

## 2. Recomendación: "Modo Showcase" basado en rol, aplicado en el borde server (NO en la UI)

### 2.1 Rol vs modo
Usar **rol** (`app_role` += `'showcase'`), no un toggle de UI:
- Server-authoritative: ningún usuario normal puede "activarlo" desde el cliente.
- Se asigna/quita desde el panel admin igual que `admin`.
- Encaja con el patrón ya existente (`has_role`).

### 2.2 ¿Simular en memoria o persistir aparte?
**Persistir en un esquema separado**, no en memoria.
- En memoria: se pierde al refrescar, no hay historial de grabaciones, y obliga a meter `if` en cada componente.
- Esquema `showcase` aparte: mismas tablas que `public` (balances, transactions, rounds…) pero aisladas. La UI no se entera.

### 2.3 La idea central: **un solo "router" en el borde server**

En lugar de tocar cada juego, se cambia **solo `adjustBalance()` y las lecturas de saldo/historial** para que, si el caller tiene rol `showcase`, escriban/lean contra `showcase.*` en vez de `public.*`. El resto (RNG, payouts, validaciones) queda idéntico.

```text
ChickenGame ──► chicken.functions.ts ──► adjustBalance(userId, ...)
                                              │
                                              ▼
                                ┌─ has_role(userId,'showcase')? ─┐
                                │                                │
                                ▼                                ▼
                       showcase.adjust_balance        public.adjust_balance
                       (tablas espejo)                (economía real)
```

Lo mismo para:
- `useMe()` (balance) → lee `showcase.user_balances` si el rol aplica.
- "Mis transacciones" / "Mis recargas" → leen el espejo.
- Ranking, recent wins, RTP, misiones, VIP, eventos: **filtran por rol** (excluyen `user_roles.role = 'showcase'`) una sola vez en cada RPC agregada, no por componente.

Ningún componente de juego cambia. Ninguna UI conoce el modo.

### 2.4 Control de "quiero ganar / quiero perder"

Dos capas:
1. **RTP por usuario (suave)**: `showcase.user_rtp_overrides(user_id, game, mode)` con `mode ∈ ('lucky','unlucky','normal')`. Los `*.server.ts` ya leen RTP — agregar "si el caller es showcase, usa override" es **1 línea por juego**.
2. **Forzado determinístico (fuerte)**: `showcase.next_outcome(user_id, game, payload jsonb)`. Antes del RNG, el server consume esa fila si existe (Chicken: secuencia de asteroides; Mines: posiciones; Slot: reels; Ruleta: número; Blackjack: próxima carta). Tú la rellenas desde un panel admin.

Todo concentrado en `engine.server.ts` + cada `*.server.ts`. Sin `if(role==='marketing')` en componentes.

### 2.5 Saldo editable
Panel Admin → "Showcase": "Setear saldo", "+10k", "Reset". Escribe en `showcase.user_balances`. Cero impacto en `public.user_balances`.

### 2.6 Exclusión de métricas reales

Tres mecanismos:
- **Aislamiento físico**: las escrituras showcase van a `showcase.*`, así que ranking/recent wins/RTP/historial admin/earnings (que leen `public.*`) ni se enteran.
- **Filtro defensivo**: `WHERE user_id NOT IN (SELECT user_id FROM user_roles WHERE role='showcase')` en RPCs agregados.
- **Misiones / VIP / eventos / promos**: el trigger o server fn correspondiente recibe `IF has_role(uid,'showcase') THEN RETURN;` arriba. Son 4–5 puntos concretos.

### 2.7 Lo que sí queda visible (a propósito)
- Header muestra el saldo del espejo → puedes grabar "tengo $1M".
- "Últimas ganancias" en Home **no** muestra showcase (excluido); si para un video lo quieres, override temporal.

## 3. Qué hay que tocar (alcance real)

1. **Migración SQL** (una sola):
   - Enum `app_role` += `'showcase'`.
   - Esquema `showcase` con tablas espejo mínimas: `user_balances`, `transactions`, `game_rounds`, `next_outcome`, `user_rtp_overrides`.
   - Funciones `showcase.adjust_balance(...)` y `showcase.get_balance(...)`.
   - Triggers de misiones/VIP: early-return si showcase.
   - Filtros de exclusión en RPCs de ranking / recent wins / RTP.

2. **Server (TypeScript)** — punto único:
   - `engine.server.ts`: `adjustBalance()` decide `public` vs `showcase` según rol cacheado.
   - Helper `maybeForcedOutcome(userId, game)` que cada `*.server.ts` consulta antes del RNG (1 línea por juego).
   - `useMe`: el server devuelve el balance correcto desde un único endpoint; cliente no decide.

3. **Admin Panel**: nueva sección "Showcase": asignar/quitar rol, setear saldo, set RTP por juego, encolar `next_outcome`.

4. **Componentes de juego**: **0 cambios**. Esto es lo importante.

## 4. Invasividad y riesgos

- **Invasividad**: baja-media. Una migración, edits puntuales en ~7 server fns (1 línea cada uno) y un panel admin nuevo. La UI de juegos no se toca.
- **Riesgos**:
  - *Fuga de showcase a métricas reales*: mitigado por aislamiento físico + filtros defensivos.
  - *Olvido en juegos nuevos*: convención clara — todo juego nuevo entra por `adjustBalance()` y `maybeForcedOutcome()`.
  - *RLS*: tablas `showcase.*` necesitan policies (dueño lee su espejo, admin lee todo).
  - *Confusión operativa*: una cuenta showcase NO debe poder pagar depósitos/retiros reales — `deposit_requests` / `withdrawal_requests` deben rechazar si `has_role(uid,'showcase')`.

## 5. Alternativa más barata (no recomendada)

Misma tabla `public.user_balances` y `public.transactions` con columna `is_showcase boolean`. Todas las queries filtran `WHERE NOT is_showcase`. ~30% menos trabajo pero mete una columna sensible en todas las tablas de dinero y obliga a recordar el filtro siempre.

## 6. Estimación de créditos (orden de magnitud)

- Migración SQL + RLS + triggers de exclusión: **~30–45**.
- Wiring server (`engine.server.ts`, `useMe`, 7 juegos × 1 línea, forzado de outcome): **~40–60**.
- Panel admin "Showcase" (asignar rol, saldo, override RTP, encolar resultados): **~50–80**.
- Pruebas/ajustes (verificar exclusiones en ranking/recent wins/RTP/misiones/VIP por juego): **~30–40**.

Total: **~150–225 créditos**. Si solo quieres RTP alto sin determinismo por jugada, baja a ~120.

## 7. Resumen ejecutivo

- **Rol** `showcase` en `user_roles`, no un modo del cliente.
- **Esquema `showcase`** espejo para balances/transacciones/rounds; cero impacto en `public`.
- **Routing en `adjustBalance()`** y en las lecturas de "yo": un único punto decide real vs showcase. Los componentes no cambian.
- **Control de resultados** vía `showcase.next_outcome` + `showcase.user_rtp_overrides`, leídos en `*.server.ts` antes del RNG.
- **Exclusión** de ranking, recent wins, RTP, misiones, VIP, eventos por aislamiento físico + filtros defensivos.
- **Admin panel** para asignar rol, mover saldo y forzar resultados.

Si te encaja, el siguiente paso es pasar a build y arrancar por la migración + el routing en `adjustBalance()`, que desbloquea todo lo demás.