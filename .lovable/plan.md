## Ruleta BetSpace — Plan de implementación

Juego de ruleta europea (37 segmentos: 18 rojos, 18 negros, 1 verde/0) con apuesta única por giro a Rojo, Negro o Verde. Verde paga 14x, Rojo/Negro 1.95x. Arquitectura backend idéntica a Spaceman/Slot.

---

### 1. Backend (Supabase migration)

**Nueva config RTP** en `game_rtp_config`:
- Fila `game = 'ruleta'`, `rtp_target = 97.3` (estándar europeo, configurable).

**Nueva RPC `spin_roulette_v1(p_user_id, p_bet_amount, p_choice, p_client_action_id)`** — security definer, mismo patrón que `spin_slot_v1`:
- Valida: `choice IN ('red','black','green')`, bet 500–500000 step 500, idempotencia por `client_action_id`.
- Genera `server_seed` (32 bytes) + `server_seed_hash`.
- Sortea segmento ganador `0..36` con `gen_random_bytes` (uniforme, rechazo de bytes ≥ 247 para evitar sesgo).
- Mapeo segmento → color: `0 = green`, números rojos = `[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]`, resto negros (distribución europea real).
- Débito vía `_debit_bet` (bonus-first + award_xp automático).
- Si gana: payout = `bet * 1.95` (R/N) o `bet * 14` (V), crédito vía `_credit_win` (100% real).
- Transaction `meta` cachea: `{ winning_segment, winning_color, choice, multiplier, payout, server_seed, server_seed_hash }`.
- Retorna `jsonb`: `{ was_duplicate, new_balance, cached: { winning_segment, winning_color, won, payout, ... } }`.

**No requiere `game_rounds`** (juego instantáneo, no multiplayer como Spaceman).

---

### 2. Assets visuales

- **`src/assets/roulette-frame.png`** — generado por IA: anillo dorado exterior con luces moradas, eje central metálico dorado con reflejos, fondo púrpura cósmico. Capa decorativa **fija** (no rota). Estilo idéntico al boceto.
- **`src/assets/roulette-promo.png`** (opcional) — tarjeta para `/home` siguiendo el patrón Blackjack/Jackpot.

---

### 3. Frontend

**Ruta nueva:** `src/routes/ruleta.tsx` — clona estructura de `spaceman.tsx` (RequireAuth + LoadingScreen + componente). `head()` con SEO completo.

**Componente nuevo:** `src/components/RouletteGame.tsx`

Estructura visual (mobile-first, mismo layout que Spaceman):

```
Header (BETSPACE logo + balance + settings) — reutilizado
─────────────────────────────────────────────
ONLINE counter | RULETA (título gradient rojo) | audio toggle
ROJO / NEGRO / 0  (subtítulo)
─────────────────────────────────────────────
[ Rueda 360x360 ]
  ├─ <img> roulette-frame.png (z-0, fija)
  ├─ <svg> disco con 37 segmentos (z-10, rota)
  │    └─ 37 <path> calculados con trigonometría
  │    └─ 37 <text> con números (rotan con su segmento)
  ├─ <svg> puntero/flecha arriba (z-20, fija)
─────────────────────────────────────────────
ÚLTIMOS RESULTADOS (9 bolitas de colores) — localStorage
─────────────────────────────────────────────
Panel APUESTA (clonado de Spaceman):
  ├─ Stepper +/− con FitText
  ├─ Chips +1k / +2k / +5k / +10k
  ├─ BetAmount con bonus hint
─────────────────────────────────────────────
3 botones de selección:
  [🔴 ROJO 1.95x]  [⚫ NEGRO 1.95x]
  [🟢 VERDE (0) 14.00x]
─────────────────────────────────────────────
[ GIRAR RULETA ] (verde, full-width)
─────────────────────────────────────────────
HISTORIAL COMPLETO | CÓMO JUGAR
```

**Estados:** `idle | spinning | revealing`. Botón GIRAR deshabilitado durante `spinning`.

**Animación del spin:**
- Al click: llamada a RPC con `client_action_id` (uuid). Mientras se espera, ya inicia el spin "ficticio" (la rueda empieza a girar visualmente).
- Cuando llega la respuesta: calcula `rotación_final = (8 vueltas × 360°) + (segmento_ganador × 360/37) + jitter(±3°)`.
- Aplica `transform: rotate(Xdeg)` con `transition: transform 6.5s cubic-bezier(0.15, 0.85, 0.25, 1)` al `<g>` interno del SVG.
- `will-change: transform` durante el giro, removido al terminar.
- **Tick del puntero:** `setTimeout` calculado a partir de la velocidad angular instantánea (derivada de la curva de easing) — cada vez que toca un borde de segmento, micro-flash CSS del puntero + sonido `tick.mp3` via `gameAudio.ts`.
- **Micro-rebote final:** después del `transitionend`, `transform: rotate((X-8)deg)` con `transition: 0.4s ease-out`, luego vuelve.
- Al terminar reveal: muestra resultado (toast/overlay), actualiza historial localStorage, refresca balance.

**Audio:** reutilizar `gameAudio.ts`. Sonidos: `roulette-spin.mp3` (loop suave durante giro), `roulette-tick.mp3` (cada borde), `win.mp3` / `lose.mp3` (ya existen).

---

### 4. Integración en navegación

- Agregar tarjeta de Ruleta en `/home` (siguiendo patrón Spaceman/Blackjack).
- Link de ruleta en menú lateral (si existe).

---

### 5. Detalles técnicos

- **Color tokens nuevos** en `src/styles.css`: `--roulette-red`, `--roulette-black`, `--roulette-green`, `--roulette-gold` (oklch).
- **Probabilidades reales** (con verde 14x): house edge ≈ 62% en verde, ~2.7% en R/N. RTP global ≈ 95% (el verde "regalado" lo compensa la baja frecuencia de apuesta a verde).
- **Sin SSR para canvas/svg pesado**: el componente entra dentro de `RequireAuth` que ya es client-only.
- **Tests visuales:** verificar en iPhone SE (375px) que rueda 360x360 entra cómoda con padding.

---

### Fuera de alcance (futuro)

- Apuestas múltiples simultáneas (R + V a la vez).
- Apuestas a número específico (paga 36x).
- Modo multiplayer / ronda compartida.
- Estadísticas avanzadas (% rojo vs negro últimas 100 rondas).

### Orden de implementación

1. Migración Supabase (`game_rtp_config` row + `spin_roulette_v1` RPC).
2. Generar `roulette-frame.png` con IA.
3. Color tokens + `RouletteGame.tsx` (estructura + SVG estático).
4. Lógica de spin + animación + tick sonoro.
5. Ruta `/ruleta` + integración en `/home`.
6. QA visual en mobile.
