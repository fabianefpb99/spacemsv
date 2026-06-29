# Chicken Road — Sincronización, peso y sombra de patas

## 1. Diagnóstico del delay

Hoy, tras un salto seguro, hacemos en orden:

```
prepare (240ms) → jump (240ms) → land-bounce (140ms) → slide (320ms) → setRightVisible(false) → 40ms → setRightVisible(true) → setPhase("playing")
```

Aunque `setStep / setNextMult` ya se actualizan apenas responde el servidor, los **renders condicionados a `phase === "playing"`** se atrasan ~700ms:

- **Texto motivador** (`{phase === "playing" && step >= 1 ? ... }`): no aparece hasta que termina el slide.
- **Chip del multiplicador en el asteroide derecho** (`nextMult > 0 && phase === "playing"`): desaparece durante todo el salto/slide y vuelve cuando ya cargó el nuevo asteroide (con su propio fade-in).
- **Asteroide derecho nuevo**: se desmonta tras el slide y se vuelve a montar 40ms después + fade-in, lo que añade otro pequeño "pop" tardío.

## 2. Cambios en `src/components/ChickenGame.tsx`

- **Texto motivador** — cambiar la condición a:
  `(phase === "playing" || phase === "jumping") && step >= 1 && chickenFx !== "prepare" && chickenFx !== "jump-left-to-right"`.
  Así el banner aparece **en el instante del `land-bounce`**, junto con el sonido de patas, no después del slide.

- **Chip de "Siguiente X" sobre el asteroide derecho** — permitir que se muestre también durante `jumping` cuando `chickenFx` ya está en `land-bounce` o `slide-to-left` (no en `prepare` ni `jump`). Evita el "se va y vuelve".

- **Aparición del próximo asteroide** — eliminar el ciclo `setRightVisible(false) → delay(40) → setRightVisible(true)`. En su lugar, al terminar el slide:
  - Resetear la animación CSS forzando un `key` numérico (`rightAsteroidKey` que incremente). El `key` cambia el nodo y dispara el fade-in sin un frame en blanco.
  - Esto elimina ~40ms muertos + reduce el "pop" tardío de la plataforma siguiente.

- **Compactar el slide** — bajar `SLIDE_MS` de 320 → 240 (la plataforma siguiente llega antes al centro; sigue legible, ya tenemos `land-bounce` cubriendo el aterrizaje).

- **Sombra de patas** — añadir un `<span className="chicken-foot-shadow" />` dentro del wrapper `chicken-sprite`, posicionado justo bajo el sprite. Se oculta en `fall` y `fail-still`.

## 3. CSS — `src/styles.css`

- `.chicken-foot-shadow`: óvalo radial gris-negro semitransparente (`radial-gradient(ellipse, rgba(0,0,0,0.45), transparent 70%)`), `~52% × 10px`, anclado en `bottom: -2px`, `left: 50%`, `translateX(-50%)`, `z-index: -1` respecto al sprite, con `filter: blur(2px)`.
- Variantes:
  - Durante `prepare`: sombra ligeramente más oscura/contraída (simula que la gallina presiona la roca).
  - Durante `land-bounce`: pulso rápido (scale 0.9→1) acompañando el rebote.
  - Durante `fall` / `fail-still`: `opacity: 0`.
- Mantener `pointer-events: none`.

## 4. Optimización de imágenes (peso)

Convertir a **WebP** los assets pesados de Chicken Road, igual que hicimos con el resto de juegos. Objetivo: ≥80% de reducción manteniendo calidad visual.

| Asset                      | Tamaño actual | Acción                                  |
| -------------------------- | ------------- | --------------------------------------- |
| `background-space.png`     | 2.10 MB       | → WebP q82, max 1600px (≈ 200–300 KB)   |
| `asteroid.png`             | 162 KB        | → WebP q85 (≈ 25–40 KB)                 |
| `asteroid-broken.png`      | 162 KB        | → WebP q85 (≈ 25–40 KB)                 |
| `chicken-idle / prepare / jump / fail` | (revisar)   | → WebP q88 si reduce peso real          |

Pasos:
1. Descargar el PNG original desde la URL del `.asset.json`.
2. Comprimir con `ffmpeg` / `cwebp` (ya disponible).
3. Subir el WebP como nuevo asset (crea nuevo `.asset.json`).
4. Reemplazar los imports en `ChickenGame.tsx` por los nuevos `.webp.asset.json`.
5. Borrar los `.png.asset.json` antiguos.

Verificación: cargar `/chicken`, confirmar visualmente que los sprites se ven igual, medir Network.

## 5. Verificación

- Reproducir el juego en preview con Playwright headless:
  - Capturar screenshot durante `land-bounce` → el texto motivador y el chip de multiplicador del próximo asteroide ya deben estar visibles.
  - Confirmar que ya no hay un "pop" tardío del asteroide siguiente.
- Revisar el Network: el fondo debe pesar < 400 KB (vs 2.1 MB actuales).
- Confirmar que en `prepare` se sigue viendo el glow azul + "CARGANDO IMPULSO" sin cambios.

## Fuera de alcance

- No tocamos lógica de servidor (`chicken.functions.ts`, `chicken.server.ts`, `chicken.shared.ts`).
- No tocamos el flujo de audio ni los timings de `prepare` (el delay percibido del servidor ya está enmascarado allí).
