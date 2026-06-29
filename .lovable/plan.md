
## Objetivo

Que la gallina nunca se "congele" en el aire. El delay del servidor debe absorberse durante la preparación del salto (con un efecto visible de impulso azul), no durante el salto ni la caída. Y quitar el cuadro/borde que encierra el escenario del juego.

## Cambios

### 1. Reordenar el flujo del salto

Hoy el flujo es:
```text
prepare (160ms fijos) → jump (280ms en paralelo con request) → land/break
```
Si el servidor tarda 600ms, la gallina queda 300+ms quieta en el aire con la sprite "jump".

Nuevo flujo:
```text
prepare (mínimo 220ms, espera al servidor con glow azul) → jump (≈220ms) → land/break (rápido)
```
- Disparar `jumpFn(...)` **al entrar en `prepare`**, no al entrar en `jump`.
- La fase `prepare` dura `max(PREPARE_MIN_MS, tiempo_real_del_request)`. Mientras espera, el sprite "prepare" se queda visible con un glow azul pulsante (charging).
- En cuanto llega la respuesta y se cumple el mínimo, arranca la animación `jump` ya con el resultado conocido. Sin esperas en el aire.
- Acelerar la caída/aterrizaje: bajada más corta (~160–200ms) con easing más agresivo, para que el "plop" sobre el asteroide sea inmediato.

### 2. Efecto visual de carga ("impulso azul")

- Añadir un anillo/glow azul cyan alrededor de la gallina mientras está en `prepare-waiting`.
- Implementación CSS: pseudo-elemento `::after` en `.chicken-sprite` con `box-shadow` / `radial-gradient` azul que pulsa (~600ms loop) hasta que sale de la fase.
- Pequeño "shake" o vibración sutil del sprite para reforzar la sensación de impulso.
- Cuando llega la respuesta del servidor, un flash blanco-azul rápido (~120ms) marca el "release" y arranca el salto. Si la respuesta llega antes del mínimo, el flash se dispara justo al final del mínimo.

### 3. Quitar el marco del escenario

- En `src/components/ChickenGame.tsx`, la sección `.chicken-stage` tiene `rounded-2xl border border-purple-500/30` y un fondo radial propio. Eso es lo que se ve como "cuadro".
- Quitar el `border`, el `rounded-2xl` y el `overflow-hidden`.
- Quitar también el `background` radial de `.chicken-stage` en `src/styles.css` para que el escenario se mezcle con el fondo espacial de la página. El stage seguirá teniendo `aspect-ratio` para preservar proporciones, pero sin contorno visible.
- Verificar que ninguna animación dependa de `overflow-hidden` (la caída de la gallina ya sale por abajo; con overflow visible podría asomar fuera del stage — si molesta, recortar solo verticalmente con `clip-path` en lugar de un borde redondeado).

## Detalles técnicos

Archivos afectados:
- `src/components/ChickenGame.tsx`
  - Renombrar/añadir estado: `prepare`, `prepare-waiting`, `jump`, `land-bounce`, etc. (o reutilizar `prepare` extendiendo su duración hasta que llegue la respuesta).
  - Mover el `jumpFn(...)` al inicio de `prepare`. Hacer `Promise.all([reqP, delay(PREPARE_MIN_MS)])`.
  - Una vez resuelto, reproducir un breve `release flash` (clase CSS de ~120ms) y luego setear `chickenFx = "jump-left-to-right"`.
  - Bajar `JUMP_MS` a ~220ms y `LAND_BOUNCE_MS` a ~140ms.
  - Quitar `rounded-2xl border border-purple-500/30 overflow-hidden` del `<section className="chicken-stage ...">`.
- `src/styles.css`
  - `.chicken-stage`: quitar `background` y `border-radius`/borde; mantener `aspect-ratio`.
  - Añadir `.chicken-fx-prepare-waiting` con glow azul pulsante (keyframes `chickenChargeGlow`).
  - Añadir `.chicken-fx-release-flash` (~120ms) para el destello al soltar.
  - Reescribir keyframes de `chickenHopInPlace` para que la caída sea más corta y rápida que la subida.

## Resultado esperado

- La gallina prepara el salto con un glow azul claro pulsando. Mientras dure el delay del servidor, este glow se ve más intenso.
- En cuanto el servidor responde, un destello breve y la gallina salta hacia arriba y cae rápido sobre el nuevo asteroide (o cae al vacío si se rompe). Ya no hay sensación de "congelada en el aire".
- El escenario ya no está dentro de un cuadrado: la gallina y los asteroides parecen flotar directamente sobre el fondo espacial de la página.
