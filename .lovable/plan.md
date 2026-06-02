## Panel de Administración `/adminpanel`

Construcción del panel admin completo siguiendo la identidad visual del casino (oscuro, morados, neón, bordes iluminados). Mobile-first 9:16 con versión desktop adaptada.

### Acceso y seguridad

- Promover `fabianefpb99@gmail.com` a `role = 'admin'` en `user_roles` (migración idempotente por email).
- En `/perfil`: mostrar un ícono de tuerca (Settings) **solo si** `has_role(admin)` es true. Click → navega a `/adminpanel`.
- Ruta `/adminpanel` (top-level con guard cliente + verificación server). Si no es admin → redirect a `/home`.
- Todas las acciones admin se ejecutan vía `createServerFn` con middleware `requireSupabaseAuth` + check `has_role(uid, 'admin')`. Cliente nunca toca tablas directamente con privilegios elevados.

### Base de datos (migración)

Nuevas tablas:

1. **`game_rtp_config`** — RTP central por juego.
   - `game text PK` (spaceman, slot, mines, dice, blackjack)
   - `rtp_target numeric(5,2)` (ej. 96.20)
   - `rtp_actual numeric(5,2)` (calculado desde transacciones, refrescable)
   - `is_active boolean default true`
   - `updated_at timestamptz`
   - `updated_by uuid` (admin que cambió)
   - Seed inicial con los 5 juegos a valores actuales (96.20 / 94.50 / 97.00 / 98.10 / 99.00).

2. **`admin_audit_log`** — auditoría de toda acción admin.
   - `admin_id uuid`, `action text`, `target_user_id uuid?`, `meta jsonb`, `created_at`.

3. **`user_status`** (o columna `is_blocked` en `profiles`) — bloqueo de usuarios.
   - Añadir `is_blocked boolean default false` a `profiles`.

RLS: las tablas admin solo lectura/escritura para `has_role(admin)`. Tabla `game_rtp_config` lectura pública autenticada (los juegos la leen al jugar).

### Server functions (`src/lib/admin/*.functions.ts`)

Todas usan middleware `requireAdmin` (chequea has_role + supabaseAdmin):

- `listUsers({ search, status, dateFrom, dateTo, page })` → paginado, busca por email/username/id corto, devuelve avatar/datos/balances.
- `getUserDetail({ userId })` → perfil + balances + stats (total apostado/ganado/depositado/retirado/neta/favorito/último acceso).
- `adjustUserBalance({ userId, amount, target: 'real'|'bonus' })` → usa `adjust_balance` con tipo `adjustment` + audit log.
- `blockUser` / `unblockUser` → actualiza `is_blocked` + audit.
- `resetUserPassword({ userId })` → `supabaseAdmin.auth.admin.generateLink` reset + audit.
- `getUserTransactions({ userId, page })`.
- `listRtpConfig()` / `updateRtpConfig({ game, rtp_target })` → actualiza tabla + audit, recalcula `rtp_actual`.
- `getCasinoStats({ range: 'today'|'week'|'month'|'custom', from?, to? })` → agrega transactions por tipo y por juego, calcula ventaja de casa.

### Integración RTP en juegos (importante)

Hoy los multiplicadores/weights son hardcoded en SQL functions (`spin_slot_v1`, `_spaceman_gen_crash`, etc.). **No vamos a reescribir los algoritmos** en esta fase para no romper la jugabilidad. En su lugar:

- `game_rtp_config` se almacena en Supabase como **fuente de verdad declarativa**.
- Los algoritmos leen `rtp_target` para aplicar un **factor de modulación post-cálculo** (escalar payouts del win al ratio `rtp_target / rtp_baseline`). Implementado en helper `apply_rtp_modulation(game, raw_payout)`.
- El campo `rtp_actual` se calcula on-demand desde `transactions` (sum wins / sum bets últimas N rondas) y se cachea.

Esto deja la infra lista; los algoritmos consultan Supabase y los cambios se reflejan en futuras partidas sin redeploy.

### UI — Estructura `/adminpanel`

**Mobile (prioridad):** Layout con header sticky + bottom-sheet style nav o drawer lateral con las 10 secciones. Cada sección es ruta hija `_adminpanel.{seccion}.tsx` bajo `src/routes/`.

Secciones desarrolladas completas:
- **Dashboard**: KPIs top (usuarios totales, apuestas hoy, ganancias hoy), accesos rápidos.
- **Usuarios**: lista paginada con búsqueda/filtros + detalle modal/route con acciones admin.
- **RTP de Juegos**: tabla editable de los 5 juegos con input numérico, badge estado, fecha última actualización + admin.
- **Ganancias del Casino**: KPIs financieros, ventaja de casa real, desglose por juego, filtros de rango.

Secciones placeholder (módulos visuales preparados, sin lógica):
- Transacciones, Depósitos, Retiros, Bonos, Reportes, Logs del Sistema, Configuración.

**Desktop**: el mismo layout reflows con sidebar fijo izquierdo (como la imagen de referencia), contenido a la derecha en grid responsive.

### Realtime

- Suscripción Postgres Changes a `transactions` para refrescar Dashboard y Ganancias del Casino (debounced, no re-query por cada evento).
- `user_balances` realtime en pantalla de detalle de usuario.
- RTP config realtime para reflejar cambios sin recargar.

### Componentes nuevos

- `src/components/admin/AdminGuard.tsx` — verifica role y renderiza fallback.
- `src/components/admin/AdminLayout.tsx` — shell con sidebar (desktop) / drawer (mobile).
- `src/components/admin/UserList.tsx`, `UserDetailDrawer.tsx`, `RtpTable.tsx`, `CasinoStatsPanel.tsx`, `KpiCard.tsx`, `AdminPlaceholder.tsx`.
- Helpers en `src/lib/admin/admin.shared.ts` (tipos, formatters).

### Orden de implementación

1. Migración SQL (roles, `game_rtp_config` con seed, `admin_audit_log`, `is_blocked`, RLS) — **se enviará primero para aprobación**.
2. Promover usuario admin (insert).
3. Server functions admin con middleware.
4. Shell `/adminpanel` + guard + entrada desde `/perfil` (tuerca solo para admin).
5. Sección Usuarios (lista + detalle + acciones).
6. Sección RTP de Juegos + helper de modulación en SQL.
7. Sección Ganancias del Casino + realtime.
8. Placeholders del resto + Dashboard con KPIs.
