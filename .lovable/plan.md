# Modo Boost — RTP elevado para una cuenta objetivo

Switch en el panel admin que aplica RTP 99.1% a una sola cuenta (la "cuenta de grabación") sin afectar a nadie más. Al apagarlo, borra automáticamente todo el rastro que esa cuenta dejó durante la ventana del boost. Spaceman queda completamente fuera.

## Cómo se usa (flujo del usuario)

1. Creas una cuenta desechable normal (ej. `grabacion@test.com`).
2. En `/adminpanel` → nueva sección "Boost Mode": seleccionas esa cuenta del dropdown y das ON.
3. Cierras admin, entras con la cuenta desechable, grabas el video — ganas la mayoría del tiempo.
4. Vuelves al admin, das OFF. Sale un diálogo de confirmación con el resumen ("Se borrarán N transacciones, N rondas, etc. del usuario X entre HH:MM y HH:MM"). Confirmas.
5. Las estadísticas del admin vuelven exactas al estado previo. Tu admin nunca se ve afectado.

## Garantías de aislamiento

- Solo la cuenta objetivo recibe RTP boosted. Todos los demás (admin incluido) juegan con RTP normal.
- Solo se borran datos de esa cuenta objetivo dentro de la ventana exacta del boost. Es imposible borrar datos de otro usuario por error.
- Spaceman intocado: ni se le aplica boost ni se incluye en el cleanup.
- Auto-off automático a las 6 horas + badge rojo persistente en admin para evitar olvidos.

## Detalles técnicos

### Base de datos
Migración nueva con dos elementos:

**Tabla `boost_sessions`**:
- `target_user_id` (uuid, FK a `auth.users`): la cuenta objetivo
- `started_at`, `ended_at` (timestamptz): ventana del boost
- `rtp_value` (numeric, default 99.1): RTP que se aplicó
- `started_by` (uuid): admin que lo activó (audit)
- `ended_by` (uuid nullable): admin que lo apagó
- `cleanup_summary` (jsonb nullable): resumen de filas borradas
- RLS: solo `service_role` lee/escribe. Usuarios normales no la ven ni con `SELECT *`.

**Función `cleanup_boost_session(session_id)`** (SECURITY DEFINER, solo callable por admins):
- Valida la sesión existe y tiene `ended_at`.
- Borra de `transactions`, `game_rounds`, `game_bets`, `arena_rounds`, `user_missions` donde `user_id = target_user_id AND created_at BETWEEN started_at AND ended_at`.
- Resetea `user_balances` y `user_vip` del target a cero/inicial.
- Devuelve conteos en jsonb para mostrar al admin.

**Función helper `get_user_rtp_override(user_id, game)`** (SECURITY DEFINER):
- Devuelve el RTP boosted si existe sesión activa con ese `target_user_id` y `game != 'spaceman'`.
- Devuelve null en cualquier otro caso.

### Server functions
Cada `*.server.ts` de los juegos individuales (Chicken, Slot, Ruleta, Dice, Mines, Blackjack, Arena) agrega una línea antes de leer el RTP de `game_rtp_config`:

```text
const override = await getUserRtpOverride(userId, game)
const rtp = override ?? normalRtp
```

`spaceman.server.ts` no se toca.

### Server functions admin nuevas
- `adminListUsers()` para el dropdown (ya puede existir, reutilizar)
- `adminStartBoost({ target_user_id })`: crea fila en `boost_sessions`, audit log
- `adminStopBoost()`: setea `ended_at`, llama `cleanup_boost_session`, devuelve resumen
- `adminGetActiveBoost()`: para mostrar badge y datos en el panel

Todas con `requireSupabaseAuth` + verificación `has_role(admin)`.

### UI
Nueva sección `BoostModeSection.tsx` en `/adminpanel`:
- Cuando no hay sesión activa: dropdown de usuarios + botón "Activar Boost".
- Cuando hay activa: badge rojo "BOOST ACTIVO — usuario X — desde HH:MM" + botón "Apagar y limpiar".
- Diálogo de confirmación al apagar con preview de lo que se borrará.
- Badge global en header del admin si boost activo (visible en todas las secciones).

### Auto-off
- En `adminGetActiveBoost()`, si la sesión activa lleva >6h, se cierra y limpia automáticamente.
- Llamado al cargar `/adminpanel`, así que basta con que abras el admin para disparar el auto-off.

## Lo que NO incluye

- Forzar resultados específicos (asteroide N en Chicken, número X en Ruleta). Si lo necesitas después, se agrega aparte.
- Lógica de "compensación tras pérdida". A 99.1% no hace falta.
- Modificación a Spaceman.
- Reset de la cuenta admin.
- Borrar la cuenta desechable automáticamente (eso lo haces tú desde el panel de usuarios cuando quieras).

## Riesgos y mitigaciones

- **Olvidar el switch encendido**: badge rojo persistente + auto-off 6h.
- **Apagar y perder datos por error**: confirmación con resumen antes de borrar.
- **Otro admin futuro lo activa indebidamente**: audit log con `started_by` / `ended_by`.
- **Vulnerabilidad de RTP**: `boost_sessions` con RLS estricta + override evaluado server-side + `userId` desde JWT.

## Estimación

~35–40 créditos.
