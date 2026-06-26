## Objetivo

1. Resetear **tu cuenta admin** ahora mismo: XP=0, nivel=0, borrar todos los registros en `user_vip_rewards` (reclamados y no reclamados) y los avatares VIP desbloqueados. **No** se toca el saldo bonus ya acreditado.
2. Crear un módulo **"Beneficios"** en el panel admin que permita seleccionar cualquier usuario y hacer ese mismo reset completo desde la UI.

---

## 1. Reset inmediato del admin (migración puntual)

SQL one-shot que se ejecuta una sola vez:

- `UPDATE user_vip SET total_xp=0, current_level=0` donde `user_id` = admin.
- `DELETE FROM user_vip_rewards` donde `user_id` = admin (borra avatares VIP y bonos VIP, reclamados o no — el saldo bonus que ya cayó en `user_balances` permanece intacto).

Después de esto podrás re-subir y volver a reclamar los premios de prueba normalmente.

---

## 2. Nuevo RPC `admin_reset_vip_progress(p_target_user_id uuid)`

Security-definer, gated por `has_role(_, 'admin')`. Hace para el usuario seleccionado:

- `user_vip`: `total_xp=0, current_level=0`.
- `user_vip_rewards`: `DELETE` total (incluye avatares VIP y premios canjeados/no canjeados).
- **No** modifica `user_balances` → el saldo bonus ya entregado se queda.
- **No** toca `user_avatar_unlocks` (esa tabla es de avatares por misión, no VIP).
- Registra una entrada en `admin_audit_log` con acción `reset_vip_progress`.

Retorna `{ ok: true }`.

---

## 3. Server function

`src/lib/vip/rewards.functions.ts` → añadir `adminResetUserVip({ userId })` que llama al RPC. Reutiliza `requireSupabaseAuth` + `assertAdmin`.

---

## 4. Nueva sección admin: "Beneficios"

**Archivos:**

- `src/components/admin/BenefitsSection.tsx` (nuevo).
- `src/routes/adminpanel.tsx`: agregar entrada `{ id: "beneficios", label: "Beneficios", icon: Gift, ready: true }` en `SECTIONS` y caso en `renderSection()`.
- Tipo `AdminSection` en `src/components/admin/shared.tsx`: agregar `"beneficios"`.

**UI del módulo (reutilizo patrón de `UsersSection`):**

```text
┌─ Beneficios ──────────────────────────────────────┐
│ Buscador de usuario (mismo input que Usuarios)    │
│ ─ lista de resultados (avatar, username, email)   │
│                                                   │
│ Panel seleccionado:                               │
│   Usuario: USMthomas                              │
│   XP actual: 12.430  ·  Nivel: 7 (Bronce II)      │
│   Premios desbloqueados: 6  (3 reclamados)        │
│                                                   │
│   [ Reset completo de VIP ]  (botón rojo)         │
│   Texto: "Borra XP, nivel y todos los premios     │
│   VIP (incl. avatares). El saldo bonus ya         │
│   acreditado NO se devuelve."                     │
│                                                   │
│   Confirmación con AlertDialog antes de ejecutar. │
└───────────────────────────────────────────────────┘
```

Tras el reset: toast de éxito + invalidar queries de `adminGetUserVipSnapshot` y refrescar la vista.

---

## Detalle técnico

- El RPC es la única fuente de verdad del reset; el botón del módulo solo lo invoca. Esto garantiza que mañana podamos también disparar el reset desde Usuarios si quisieras.
- Comprobación previa en el RPC: si `p_target_user_id` tiene rol admin, **igual lo permite** (lo necesitas para ti mismo). Solo bloquea si el caller no es admin.
- No se modifica nada del flujo de claim, ni de `_check_vip_rewards`. Al borrar las filas de `user_vip_rewards`, la próxima vez que subas de nivel se vuelven a insertar como "desbloqueado pendiente de reclamar".

---

## Resumen de archivos

- **Migración** (SQL): reset admin + nuevo RPC `admin_reset_vip_progress`.
- **Nuevo:** `src/components/admin/BenefitsSection.tsx`.
- **Editar:** `src/lib/vip/rewards.functions.ts`, `src/routes/adminpanel.tsx`, `src/components/admin/shared.tsx`.