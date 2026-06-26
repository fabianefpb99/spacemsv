
# Sistema de premios VIP por sub-rango

Se entregan premios **solo al cruzar sub-rangos** (Bronce V→IV, Bronce IV→III, …, hasta Leyenda I), no por cada nivel. Hay **35 sub-rangos** y el primero (Bronce V) no otorga premio de entrada → quedan **34 premios** configurables. Cada uno puede ser **Saldo Bonus (COP)** o **Avatar**. La entrega es **reclamable** desde `/vip`.

## 1. Base de datos

Nueva tabla `public.vip_rank_rewards` con una fila por sub-rango destino:
- `rank` (vip_rank), `sub_division` (vip_sub) — PK compuesta.
- `min_level` (int) — primer nivel del sub-rango; usado como "trigger" cuando el usuario alcanza ese nivel.
- `reward_kind` — `'none' | 'bonus' | 'avatar'`.
- `reward_amount` (numeric) — para bonus.
- `reward_avatar_key` (text) — para avatar (clave de `AVATARS` existente).
- `reward_label`, `reward_image_url` — display opcional.
- `is_active` (bool).
- RLS: lectura `anon + authenticated` (catálogo público), escritura solo admin. GRANT SELECT/INSERT/UPDATE/DELETE acordes.
- Seed: insertar las 34 filas (todas `reward_kind='none'` por defecto, el admin las edita).

Nueva tabla `public.user_vip_rewards`:
- `id uuid pk`, `user_id`, `rank`, `sub_division`, `unlocked_at`, `claimed_at`, `reward_kind`, `reward_amount`, `reward_avatar_key`.
- UNIQUE (`user_id`, `rank`, `sub_division`).
- RLS: el usuario lee/actualiza solo lo suyo; admin lee todo.

Funciones nuevas (SECURITY DEFINER):
- `_check_vip_rewards(user_id, new_level)` — al subir de nivel, inserta filas en `user_vip_rewards` por cada sub-rango recién alcanzado cuyo premio esté activo (sin acreditar todavía).
- `claim_vip_reward(reward_id)` — valida dueño + `claimed_at IS NULL`, acredita: bonus → `_credit_bonus` + transacción `bonus`; avatar → `user_avatar_unlocks`. Marca `claimed_at = now()`.
- `admin_upsert_vip_reward(...)` — solo admin, actualiza catálogo.
- Modificar `award_xp` para llamar a `_check_vip_rewards` cuando `current_level` cambia.

Backfill: para cada usuario existente, ejecutar `_check_vip_rewards` con su `current_level` para que vean los premios ya desbloqueados pero pendientes de reclamar.

## 2. UI usuario `/vip`

Reemplazar el `<Star/>` a la derecha de cada sub-rango por un chip de premio:
- Sub-rango bloqueado → chip atenuado mostrando el premio configurado (ej. `+$10.000` o miniatura del avatar). Si `kind='none'` → sin chip.
- Sub-rango alcanzado y aún no reclamado → chip dorado pulsante con botón **"Reclamar"** que llama `claim_vip_reward`.
- Sub-rango ya reclamado → chip apagado con check ✓.

Toast de éxito al reclamar (saldo bonus actualizado / avatar desbloqueado). Mantener `Bronce V` sin chip (es el sub-rango inicial).

## 3. Panel admin — nueva sección "Premios VIP"

Nueva entrada en sidebar entre "RTP" y "Ganancias": `id: "vip_rewards"`, label "Premios VIP", icon Gift.

Componente `VipRewardsSection.tsx`:
- Lista agrupada por rango (Bronce → Leyenda) con las 5 sub-divisiones cada una.
- Cada fila: badge del sub-rango, nivel-rango (ej. "Niveles 4–6"), selector de tipo (`Ninguno / Bonus / Avatar`), input de monto o picker de avatar (reusa `AvatarPickerDialog`), toggle activo, botón "Guardar".
- Bronce V aparece deshabilitado con leyenda "Sub-rango inicial — no otorga premio".
- Llama `admin_upsert_vip_reward` por fila.

## 4. Panel admin — rango/nivel en usuarios (solo detalle)

En `UsersSection.tsx`, al expandir el detalle de un usuario agregar bloque "VIP":
- Badge del rango actual + sub-división (usa `VipBadge`).
- Texto: "Nivel X / 100 · {totalXp} XP".
- Mini-tabla de últimos premios desbloqueados/reclamados (último 5 de `user_vip_rewards`).

Server fn `getUserVipSnapshot(userId)` con `requireSupabaseAuth` + check admin que devuelve `{total_xp, current_level, rank, sub, rewards[]}` haciendo join `user_vip` + `user_vip_rewards`.

## 5. Detalles técnicos

- Reutilizar `rankForLevel` / `subForLevel` de `vip.shared.ts` para mapear `min_level → (rank, sub)`.
- Lista de avatares disponibles desde `src/lib/avatars.ts` (ya existente).
- Acreditar bonus suma a `user_balances.bonus_balance` y registra `transactions{type:'bonus', meta:{source:'vip_rank_reward', rank, sub}}`.
- Refrescar `useVip` y query de balance tras `claim_vip_reward` (invalidate).
- No tocar dark/light fuera de lo necesario; las celdas de `/vip` siguen estilo dark actual.

## Resumen de archivos

Nuevos:
- migración SQL (tablas + RPCs + seed + backfill)
- `src/components/admin/VipRewardsSection.tsx`
- `src/components/vip/VipRewardChip.tsx`
- `src/lib/vip/rewards.functions.ts`

Modificados:
- `src/routes/vip.tsx` — reemplazar estrella por chip
- `src/routes/adminpanel.tsx` — registrar sección
- `src/components/admin/UsersSection.tsx` — bloque VIP en detalle
- `src/hooks/useVip.ts` — incluir rewards catalog + pendientes
- `src/lib/vip/vip.shared.ts` — helper `subRangeMinLevel(rank, sub)`
