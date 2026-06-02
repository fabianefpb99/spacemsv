## Objetivo de esta fase

Introducir por primera vez un sistema de usuarios real con Lovable Cloud (Supabase) — registro, login, logout, sesión persistente, perfil y balance — **sin rediseñar el sitio**. Toda la entrada al sistema se hace desde controles que ya existen (la **tuerca ⚙️** del header y el **menú hamburguesa ☰**). No se crean botones flotantes nuevos, no se cambia la navegación, no se tocan los juegos.

---

## 1. Backend — Lovable Cloud

Activar Lovable Cloud (Supabase) y crear estas tablas con RLS desde el día 1. Diseño pensado para crecer sin reestructurar.

### `profiles` (1:1 con `auth.users`)
Campos activos ahora:
- `id uuid PK` (= `auth.users.id`, FK ON DELETE CASCADE)
- `email text`
- `username text unique`
- `created_at timestamptz default now()`
- `updated_at timestamptz`

Campos **preparados** (nullable) para futuras fases KYC:
- `first_name`, `last_name`, `document_type`, `document_number`, `document_issue_date`, `birth_date`, `phone`, `verification_status` (enum: `unverified | pending | verified | rejected`, default `unverified`).

Trigger `on_auth_user_created` que inserta fila en `profiles` automáticamente al registrarse (toma `email` y `username` desde `raw_user_meta_data`).

### `user_balances` (separado de profiles)
- `user_id uuid PK FK → auth.users(id)`
- `balance numeric(14,2) default 0`
- `bonus_balance numeric(14,2) default 0`
- `updated_at timestamptz`

Se mantiene **separado** de `profiles` porque a futuro tendrá triggers, locks y políticas distintas (depósitos, apuestas, premios). Trigger lo crea junto con el perfil.

### `transactions` (esqueleto, no se usa todavía)
- `id uuid PK`, `user_id uuid FK`, `type` enum (`deposit | withdrawal | bet | win | bonus | adjustment`), `amount numeric(14,2)`, `balance_after numeric(14,2)`, `game text null`, `meta jsonb`, `created_at`.

Queda creada con RLS para que cuando se implementen juegos/depósitos solo sea cuestión de insertar.

### `user_roles` + enum `app_role` (`admin | user`)
Tabla aparte + función `has_role(uuid, app_role) security definer` siguiendo el patrón estándar (evita recursión RLS y prepara panel admin a futuro).

### RLS
- `profiles`: el usuario lee/actualiza solo su fila. Admin lee todas.
- `user_balances`: el usuario **solo lee** la suya. Escrituras solo vía server functions con `service_role` (el cliente nunca modifica su propio balance).
- `transactions`: el usuario lee solo las suyas. Inserciones solo server-side.
- `user_roles`: lectura propia + admin.

Todas las tablas llevan los `GRANT` explícitos a `authenticated` / `service_role` que exige PostgREST.

---

## 2. Frontend — mínima intrusión

### Archivos nuevos
- `src/hooks/useAuth.tsx` — contexto de auth (user, session, loading) usando `onAuthStateChange` + `getSession`. Una sola suscripción a nivel app.
- `src/hooks/useProfile.tsx` — devuelve perfil + balance del usuario actual (React Query, `staleTime` razonable; se invalida en `onAuthStateChange`).
- `src/components/auth/AuthDialog.tsx` — **modal** con tabs *Iniciar sesión / Registrarse*, reutilizando los componentes UI existentes (`Dialog`, `Input`, `Button`, `Tabs`). Estética morada coherente con el casino.
- `src/components/auth/UserMenu.tsx` — popover que aparece al pulsar la tuerca cuando el usuario **sí está logueado**: muestra email, username, balance oficial y botón *Cerrar sesión*.

### Cambios en componentes existentes (quirúrgicos)
- `src/routes/home.tsx`, `src/components/SpacemanGame.tsx`, `SlotGame.tsx`, `MinesGame.tsx`, `DiceGame.tsx`, `BlackjackGame.tsx`: el header ya tiene la **tuerca ⚙️** y el **menú ☰**. Cambio: la tuerca abre `UserMenu` si hay sesión, o `AuthDialog` si no. El menú hamburguesa agrega un item "Iniciar sesión" / "Cerrar sesión" según estado.
- El `balance` mostrado en los headers deja de ser `useState(100000)` y pasa a leerse desde `useProfile()`. Si el usuario **no está logueado**, se muestra `--` (o el placeholder actual) y los juegos siguen funcionando exactamente igual que hoy (no se tocan apuestas todavía).

### Lo que NO cambia
- Ninguna lógica de juego, RNG, animaciones, sonidos, navegación, rutas, layouts.
- Ningún botón flotante nuevo.
- Ninguna ruta `/login` o `/signup` (todo es modal sobre la pantalla actual → cero cambio de navegación).

---

## 3. Balance como fuente de verdad

- El balance vive en `user_balances`. El cliente **solo lo lee**.
- Se expone una server function `getMyBalance` (TanStack `createServerFn` + `requireSupabaseAuth`) que devuelve `{ balance, bonus_balance }`.
- Los juegos hoy **no** descuentan/acreditan en Supabase: siguen con su lógica local, como pediste. La arquitectura queda lista para que en la siguiente fase se añadan `placeBet` / `settleBet` server functions que escriban en `user_balances` + `transactions` dentro de una transacción SQL.

---

## 4. Higiene y rendimiento (revisión solicitada)

Auditoría puntual sin cambiar lógica de juego:
- Confirmar que `onAuthStateChange` se registra **una sola vez** (en el provider raíz) y se desuscribe en cleanup.
- Sin realtime subscriptions en esta fase (no hace falta).
- React Query con `staleTime` adecuado para perfil/balance, sin refetch en cada navegación.
- No se crean tablas de logs/temporales que crezcan sin control. `transactions` es permanente por diseño (auditoría) — **no se purga**.
- Sin `console.log` ruidosos nuevos. Revisaré el código de audio que ya tocamos para asegurar que no haya listeners residuales.
- No se borra automáticamente nada crítico (usuarios, balances, transacciones).

---

## 5. Detalles técnicos

- **Auth**: email/contraseña. `emailRedirectTo: window.location.origin` en `signUp`. Sesión persiste vía `localStorage` (cliente browser de Supabase, ya configurado).
- **Validación**: Zod en formularios (email válido, contraseña ≥ 8, username 3–20 alfanumérico).
- **Email confirmation**: por defecto Supabase pide confirmar email. Para no romper UX en desarrollo, dejaré una nota para que puedas desactivar "Confirm email" en el panel si quieres login inmediato. Yo no lo desactivo por ti.
- **Bearer attacher** + `requireSupabaseAuth` ya están en el template; los reuso.
- **Sin Edge Functions**. Toda la lógica server es `createServerFn`.

---

## 6. Orden de implementación

1. Activar Lovable Cloud.
2. Migración SQL: enum `app_role`, tablas `profiles`, `user_balances`, `transactions`, `user_roles`, trigger `handle_new_user`, función `has_role`, RLS + GRANTs.
3. `useAuth` provider + montaje en `__root.tsx`.
4. `AuthDialog` + `UserMenu`.
5. Cablear tuerca ⚙️ y menú ☰ en home y en cada juego (cambio de 1–3 líneas por archivo).
6. `useProfile` + reemplazar el `balance` hardcodeado por el real (cae a placeholder si no hay sesión).
7. Verificar: registrarse → login → balance 0 visible → logout → sesión persiste tras recargar.

---

## Lo que NO entra en esta fase (explícitamente)

- Login con Google/Apple, recuperación de contraseña, KYC, depósitos, retiros, bonos, referidos, panel admin, historial financiero UI, lógica de apuestas real en juegos. Todo queda con la base preparada para añadirse después sin reestructurar.

¿Lo aplico tal cual?