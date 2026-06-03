## Resumen
Sistema VIP visual (sin recompensas monetarias por ahora) con 100 niveles distribuidos en 7 rangos, subdivisiones V→I, curva de XP configurable desde Supabase, tarjeta en /perfil, ruta /vip dedicada, e insignia animada al subir de nivel que solo aparece en /perfil.

## Decisiones tomadas
- **XP**: premia número de apuestas más que monto. Fórmula: `xp = 1 + floor(log10(bet/1000 + 1))`. Una apuesta de $1.000 = 1 XP, $10.000 = 2 XP, $100.000 = 3 XP. Configurable en `vip_config`.
- **Curva**: accesible. Tabla `vip_levels` con `xp_required` por nivel; curva por defecto suave (~50k-200k apuestas para llegar a 100, ajustable).
- **Recompensas**: solo visual. Arquitectura lista para añadir `reward_amount` por nivel después.
- **Animación**: popup flotante de level-up solo se dispara al abrir `/perfil` (no en juegos), comparando nivel actual vs último visto (guardado en `profiles.vip_last_seen_level`).

## Rangos (100 niveles)
| Rango | Niveles |
|---|---|
| Bronce | 1–15 |
| Plata | 16–30 |
| Oro | 31–45 |
| Platino | 46–60 |
| Diamante | 61–75 |
| Maestro | 76–90 |
| Leyenda | 91–100 |

Dentro de cada rango: 5 sub-divisiones romanas V→I (los niveles se dividen en 5 grupos por rango: ej. Bronce V = niveles 1-3, IV = 4-6, III = 7-9, II = 10-12, I = 13-15). Para rangos de 15: 3 niveles por sub. Para Leyenda (10): 2 niveles por sub. Al llegar a 100 se muestra **"LEYENDA I — Nivel Máximo Alcanzado"** y la barra de XP queda llena.

## Cambios en Supabase
**Migración nueva:**
1. `vip_config` (singleton) — fórmula XP configurable: `xp_per_bet_base`, `xp_log_factor`, `min_bet_for_xp`, `cap_level` (=100), `is_active`.
2. `vip_levels` — filas 1..100 con: `level`, `rank` (enum), `sub_division` (V/IV/III/II/I), `xp_required` (acumulado), `reward_amount` (0 por ahora, configurable a futuro). Seed inicial calcula curva exponencial suave.
3. `user_vip` — `user_id`, `total_xp`, `current_level`, `updated_at`.
4. `profiles.vip_last_seen_level` (col nueva, default 0) — para detectar subidas no vistas y disparar animación.
5. RPC `award_xp(p_user_id, p_bet_amount)` — security definer, llamada desde los RPC de apuesta existentes (`spin_slot_v1`, `_debit_bet` callers). Suma XP, actualiza `current_level` consultando `vip_levels`, idempotencia natural por monto.
6. RPC `mark_vip_level_seen(p_user_id)` — actualiza `vip_last_seen_level = current_level`.

**Integración XP en juegos:** dentro de cada RPC de apuesta (slot, spaceman bet, blackjack deal, mines, dice) llamar `perform award_xp(...)` justo después del débito exitoso. No revierte si falla — XP es side-effect.

## Cambios en frontend
- **`src/lib/vip/vip.shared.ts`** — utilidades: `getRankInfo(level)` → `{rank, subDivision, color, icon}`, `getProgress(totalXp, levels)` → `{currentLevel, currentLevelXp, nextLevelXp, pct, isMax}`.
- **`src/hooks/useVip.ts`** — query que retorna `{ user_vip, levels, lastSeenLevel }` y mutation `markSeen()`.
- **`src/components/vip/VipCard.tsx`** — tarjeta para /perfil con: insignia de rango, "RANGO SubDiv" grande, barra de XP con `<Progress>`, XP actual/siguiente, link a /vip.
- **`src/components/vip/VipLevelUpToast.tsx`** — overlay animado (motion) que se monta solo en /perfil cuando `current_level > last_seen_level`. Muestra "¡Subiste a {Rango Sub}!" con confeti/glow. Al cerrarse llama `markSeen()`.
- **`src/routes/vip.tsx`** — ruta dedicada con header, progreso del usuario, y lista de los 7 rangos expandibles mostrando los 5 sub-niveles y rango de niveles. Resalta el rango/sub actual del usuario. SEO completo en `head()`.
- **`src/routes/perfil.tsx`** — agregar `<VipCard />` debajo de balances y `<VipLevelUpToast />` arriba; agregar link "VIP" en navegación.

## Visual / tokens
- Colores por rango definidos en `src/styles.css` como tokens semánticos (`--vip-bronze`, `--vip-silver`, etc.) en oklch. Insignias con gradiente + glow estilo premium.
- Sub-divisiones V→I van de menos a más brillantes dentro de un rango.

## Detalles técnicos
- `vip_levels` se siembra en la migración con un loop que calcula `xp_required[n] = round(base * pow(growth, n-1))` con `base=100`, `growth≈1.045` (≈100 niveles ≈ 700k XP total — accesible).
- RLS: `user_vip` y `vip_config` SELECT propio + admin; `vip_levels` SELECT público autenticado.
- GRANTs explícitos en cada tabla nueva.
- `award_xp` retorna `{ leveled_up: bool, new_level: int }` (lo ignoramos en frontend porque la animación se basa en `last_seen_level`, no en respuesta del juego — así evitamos errores en los HUDs de juego).

## Orden de implementación
1. Migración Supabase (tablas, seed, RPCs, integración en RPCs de apuesta existentes).
2. Tokens de color en `src/styles.css`.
3. `vip.shared.ts` + `useVip.ts`.
4. `VipCard`, `VipLevelUpToast`.
5. Ruta `/vip`.
6. Actualizar `/perfil`.

## Fuera de alcance
- Recompensas monetarias por nivel (arquitectura lista, valores en 0).
- Niveles > 100 (XP se sigue acumulando pero no se muestra).
- XP retroactivo por apuestas pasadas.
