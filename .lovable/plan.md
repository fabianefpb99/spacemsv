# Chicken Road — Plan de implementación

Juego nativo de BETSPACE construido con la misma arquitectura, HUD, header, tipografía y tokens visuales de Mines/Dados/Arena. Sin Canvas/WebGL/físicas — solo React + CSS (transform/opacity).

## 1. Assets

Subir los 7 archivos como Lovable Assets (los muestras como referencia hoy, los esperaré en build mode):

```
src/assets/chicken/background-space.png.asset.json
src/assets/chicken/chicken-idle.png.asset.json
src/assets/chicken/chicken-prepare.png.asset.json
src/assets/chicken/chicken-jump.png.asset.json
src/assets/chicken/chicken-fail.png.asset.json
src/assets/chicken/asteroid.png.asset.json
src/assets/chicken/asteroid-broken.png.asset.json
```

## 2. Backend (Supabase + server fns)

Reutilizamos el patrón de Mines (sesión persistida en `game_sessions`, RPC `bj_apply_action`, `adjustBalance` idempotente).

**`src/lib/games/chicken.shared.ts`** — constantes y matemática pura:
- `CHICKEN_MIN_BET=500`, `MAX=50000`, `STEP=500`
- `CHICKEN_MAX_STEPS = 20` (saltos máximos)
- `chickenMultiplier(step)` — fórmula `RTP * prod (1 / safeProb)` con RTP ~0.97 y `safeProb` que decrece por paso (~0.95 → ~0.55). Genera la curva 1.18, 1.35, 1.72, 2.15, …
- Tipos `ChickenPublicState { bet, step, multiplier, nextMultiplier, phase: "playing"|"result", outcome?, payout?, brokenAt? }`

**`src/lib/games/chicken.server.ts`** — `placeBrokenSequence()`: usando `cryptoRandomInt`, para cada índice 1..MAX decide BROKEN con probabilidad `1 - safeProb(step)`. Devuelve `boolean[]` (toda la secuencia se fija al inicio para que el server no pueda re-rollear y el outcome sea verificable).

**`src/lib/games/chicken.functions.ts`** — server fns con `requireSupabaseAuth`:
- `chickenResume()` → estado de sesión abierta (oculta secuencia futura).
- `chickenDeal({ bet, client_action_id })` → cierra sesión previa, debita, genera secuencia, inserta `game_sessions` con `game:"chicken"`, `state:{ brokenSeq }`, `public_state` inicial (step=0, multiplier=1, nextMultiplier=tabla[1]).
- `chickenJump({ session_id, nonce, client_action_id })` → consulta `brokenSeq[step+1]`. Si SAFE: avanza step, actualiza nextMultiplier. Si BROKEN: cierra sesión, `outcome:"lost"`, `brokenAt:step+1`.
- `chickenCashout({ session_id, nonce, client_action_id })` → paga `bet * multiplier(step)`, exige `step >= 1`.

Patrón idéntico a `minesReveal/minesCashout` (maskPublic oculta `brokenSeq`). No requiere migración: `game_sessions` ya acepta cualquier valor de `game`.

## 3. Frontend

**`src/components/ChickenGame.tsx`** — copia la estructura de `MinesGame.tsx`:
- Header del juego idéntico (logo, balance, menú, sonido).
- HUD inferior idéntico: `BetAmount`, botones −/+, quick adds (+500/+1K/+2K/+5K), botón principal full-width verde.
- Reutiliza `useMe`, `useServerFn`, `clampBetToStep`, `playCashoutSound`/`playCrashSound`, `toFriendlyError`.

**Escena (centro de pantalla, cámara fija):**
- `<div class="chicken-stage">` con `background-space.png` como `background-image` (cover, sin parallax).
- Dos slots absolutos: `.asteroid-left` (donde está la gallina) y `.asteroid-right` (siguiente, visible solo cuando hay partida activa).
- Gallina absoluta sobre `asteroid-left` (25–30% del alto útil), animaciones por `className` swap (`idle`/`prepare`/`jump`/`fail`).
- Multiplicador sobre `asteroid-right`: chip con el mismo estilo del badge de Mines.
- Mensaje central inicial "CLUCK! / ¿Hasta dónde llegarás?" con la misma clase del overlay FIGHT! de Arena (`.arena-fight-banner` o equivalente reusada) — fade-out al pulsar JUGAR.

**Estados del botón principal:**
| Fase | Botón(es) |
|------|-----------|
| `idle` (sin partida) | JUGAR |
| `playing` step=0 | SALTAR |
| `playing` step≥1 | COBRAR · SALTAR |
| `result` | JUGAR DE NUEVO |

**Secuencia visual del salto** (CSS keyframes, ~700ms total):
1. `chicken-prepare` 150ms.
2. `chicken-jump` + translate X+Y arco (transform translate3d, sin librerías) hasta el centro de `asteroid-right` 450ms.
3. Si SAFE: aterriza, micro-rebote (`transform: scale 1→1.05→1`), vuelve a `idle`. La escena "desliza" el asteroide derecho a la posición izquierda (transform translateX 300ms) y aparece el nuevo derecho con el siguiente multiplicador (opacity 0→1).
4. Si BROKEN: aterriza un instante (50ms), el asteroide derecho cambia a `asteroid-broken.png` + sacudida (`@keyframes shake`), la gallina cae (`translateY` + `rotate` + opacity → 0) con `chicken-fail`. Llamamos `playCrashSound`.

Toda la animación se dispara **después** de que el server responda, usando la respuesta para decidir SAFE/BROKEN — el cliente nunca conoce la secuencia futura.

## 4. Ruta y registro

**`src/routes/chicken.tsx`** — clon de `dados.tsx`:
```tsx
useForceDarkTheme();
<RequireAuth><LoadingScreen variant="chicken"><ChickenGame /></LoadingScreen></RequireAuth>
```
Meta tags propios. Añadir `variant: "chicken"` en `LoadingScreen` (mismo loader, fondo de chicken).

**Integración home:** añadir `game-chicken.png` (asset existente o reusar `chicken-idle` recortado) a `src/lib/admin/home-defaults.ts` para que aparezca en "Juegos destacados" y en el panel admin.

## 5. Arquitectura extensible (eventos de derrota futuros)

`public_state` lleva `lossKind?: "broken" | "ufo" | "meteor" | "blackhole"`. El server hoy solo emite `"broken"`. Cuando se añadan OVNIs/meteoritos basta con:
- ampliar `placeBrokenSequence` para devolver `{ kind, step }[]`,
- en el cliente, un `switch(lossKind)` que dispare la animación correspondiente.

La lógica de apuesta, debit/credit, multiplicadores y estados no cambia.

## Detalles técnicos resumidos

- Sin Canvas/WebGL. Solo `transform`, `translate3d`, `opacity`, `@keyframes`.
- `will-change: transform` solo en la gallina durante el salto.
- Imágenes precargadas vía `<link rel="preload">` en `LoadingScreen` para evitar pop-in.
- Sonidos: `playDiceRollSound` (salto), `playCashoutSound` (cobrar), `playCrashSound` (fail).
- Idempotencia con `client_action_id` UUID por acción (deal/jump/cashout), igual que Mines.
- Sin cambios en design system, header, HUD, tipografía ni colores existentes.

¿Confirmas para implementar? Si tienes una curva de multiplicadores específica que prefieras (por ejemplo "quiero llegar a 50x en el salto 20"), dímela y la calibro antes de codificar.
