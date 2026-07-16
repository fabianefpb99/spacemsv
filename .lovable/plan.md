## Objetivo
Reemplazar los logos preliminares (WIN / BIG / MEGA / SUPER) del banner superior de Samurai Legend por un mensaje decorativo persistente **"EL DRAGÓN TRAE SUERTE"** flanqueado por dos dragones SVG premium, sin tocar lógica de juego, RTP ni animaciones existentes.

Alcance: exclusivamente `src/components/SlotSamuraiGame.tsx`, dentro del bloque reservado de `h-[98px]` que ya existe entre el logo de Samurai Legend y el marco del tragamonedas. **No se modifica esa altura ni ningún otro layout.**

## Cambios

### 1. Eliminar los 4 logos preliminares
En el bloque `{!showEvent && (...)}` (líneas ~1648-1703), borrar los 4 `<img>` de `WIN_LOGOS.win/big/super/mega`. No se elimina el `import` porque el bloque `showEvent` sigue usándolos para el evento real de premio.

### 2. Nuevo contenido decorativo "EL DRAGÓN TRAE SUERTE"
Renderizar dentro del mismo contenedor reservado (`h-[98px]`), **siempre visible** desde la carga:
- Un `<div>` posicionado en `absolute inset-0`, con `flex items-center justify-center` para centrado vertical y horizontal perfecto dentro del espacio reservado.
- Contenido: `[Dragón SVG] EL DRAGÓN TRAE SUERTE [Dragón SVG]` en fila.
- Tipografía: `font-display`, tracking amplio, color dorado/rojo que armoniza con el logo Samurai (tonos `#fbbf24` con text-shadow rojo-carmesí + glow suave), tamaño ~13-14px para caber cómodo sin empujar.
- Dragones SVG: dos componentes inline (`<DragonOrnament side="left" />` y `side="right"` con `transform: scaleX(-1)`). Diseño premium: silueta de dragón oriental estilizado (cabeza con cuernos, melena flotante, cuerpo serpentino con escamas insinuadas), trazo con gradiente rojo→dorado, glow sutil. Nada de emojis ni PNG. Se define una única función SVG reutilizable.
- Tamaño de cada dragón: ~34-40px de alto, proporcional al texto.

### 3. Cross-fade con el evento de premio
Dentro del mismo contenedor `h-[98px]`:
- El nuevo bloque decorativo aplica `opacity: showEvent ? 0.15 : 1` con `transition: opacity 0.35s ease`. Así, cuando llega WIN/BIG/MEGA/SUPER/JACKPOT, baja considerablemente pero **permanece visible detrás**.
- El bloque `{showEvent && (...)}` existente se envuelve en `absolute inset-0 flex items-center justify-center` para que se pinte **encima**, centrado sobre los dragones. Su animación `scale-in` y layout interno se mantienen intactos.
- Al terminar el evento (`showEvent` vuelve a `false`), el decorativo vuelve suavemente a `opacity: 1` por la misma transición.

### 4. No tocar
- Ni la altura `h-[98px]`, ni el logo Samurai (`h-[130px]`), ni el hero, ni HUD, ni reels, ni audio, ni backend, ni cualquier animación existente del evento de premio.
- `WIN_LOGOS`, `tier`, `displayedWin`, `showEvent`, `EVENT_LABEL` se preservan tal cual.

## Detalles técnicos
- Un componente local `DragonOrnament({ flip }: { flip?: boolean })` retorna un `<svg viewBox="0 0 64 40">` con `<defs>` para un `linearGradient` id único (`samurai-dragon-grad-l/r` para evitar colisiones), `filter drop-shadow` para el glow, y `transform={flip ? "scaleX(-1)" : undefined}`.
- El path del dragón: cabeza redondeada, cuerno recto hacia atrás, melena en 3 mechones, cuerpo curvado tipo "S" con 2-3 curvas Bézier, cola con punta bifurcada, insinuación de bigotes. Todo en un único path complejo + un par de detalles (ojo pequeño, cuerno).
- No se agregan dependencias ni assets nuevos.

## Verificación
Playwright en viewport 390x844: cargar `/slotsamurai`, confirmar (a) que los 4 logos preliminares ya no aparecen, (b) que "EL DRAGÓN TRAE SUERTE" con dragones se ve centrado desde el primer frame, (c) que el bloque reservado sigue midiendo 98px (sin empuje). Screenshot para inspección visual.
