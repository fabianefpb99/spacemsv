## Problema

En Android, al pulsar GIRAR en Slot Mafia y Slot Samurai:
- La animación de los rodillos "se traba" (se ve oscuro / a ~5 fps).
- El resultado aparece tarde y de golpe.
- Los SVG y efectos parecen no rasterizarse a tiempo.

## Causa raíz

Ambos juegos usan MUCHOS efectos GPU costosos que Android (sobre todo Chrome/WebView en gama media) rasteriza mal cuando corren en cada símbolo al mismo tiempo:

- `filter: drop-shadow(...) drop-shadow(...)` en TODAS las fichas (base + highlight) — el rodillo largo puede tener 30–40 símbolos activos durante el giro.
- Fondos con `filter: blur(6–7px)`, radial-gradients con `mix-blend-mode: screen`, y auras animadas (`GreenAuraBackdrop`, `FlameBackdrop`).
- SVG animados adicionales (llamas, ornamentos fire/mega) que se pintan encima.
- Múltiples `animation: ...infinite` con `box-shadow`/`filter` (repintado constante, no compositado).
- Las tiles no tienen `will-change`/`contain` correctos, y el strip se re-renderiza mientras las llamas siguen activas del giro anterior.

En iOS el compositor de WebKit tolera mejor los `drop-shadow`; en Android Chrome cada símbolo se rasteriza en CPU cuadro a cuadro → el "5 fps".

## Solución (solo capa de presentación, sin tocar lógica de juego)

### 1. Detectar Android una sola vez

Nuevo helper `src/lib/platform.ts`:
```ts
export const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
```

### 2. Modo "lite" en `SymbolTile` (aplica a Mafia y Samurai)

Durante el giro, o siempre en Android:
- Reemplazar los dos `drop-shadow` del `<img>` por **un solo** `filter: drop-shadow(0 3px 4px rgba(0,0,0,.5))` fijo, sin glow dinámico.
- Sustituir el aura ganadora animada por un `box-shadow` estático + un pulso muy leve de `opacity` (compositado, no repintado).
- No renderizar `FlameBackdrop` / `GreenAuraBackdrop` / `FireOrnament` / `MegaOrnament` mientras `spinning === true`. Sólo aparecen en el frame final, cuando los rodillos ya se detuvieron.
- En Android, mostrar una versión simplificada de estos overlays: sin `blur()`, sin `mix-blend-mode`, con la mitad de partículas.

### 3. Aislar el rodillo del resto

En el contenedor `.inner` del rodillo (línea ~540):
- Añadir `contain: "layout paint size"`, `will-change: "transform"`, `transform: "translate3d(0,0,0)"`.
- Envolver cada `SymbolTile` en un wrapper con `contain: "paint"` para que un símbolo repintado no invalide sus vecinos.

### 4. Pausar animaciones caras durante el giro

`SymbolTile` recibe la prop `spinning` (ya la tiene el padre). Mientras `spinning`:
- `animation: "none"`
- `highlight = false` forzado (los ganadores del giro anterior no siguen brillando mientras giran).

Esto evita que el navegador esté componiendo llamas + fichas moviéndose al mismo tiempo.

### 5. Reducir la longitud del strip de giro en Android

`SPIN_FILLER_COUNT` (~30 símbolos) se recorta a ~15 en Android. Menos DOM a componer por rodillo × 5 rodillos = menos presión sobre el compositor. La duración total del spin no cambia.

### 6. Pequeños ajustes adicionales

- `img` de los símbolos: añadir `style={{ imageRendering: "auto", transform: "translateZ(0)" }}` para forzar capa GPU.
- Quitar `transition: "box-shadow 200ms ease, background 200ms ease"` de la tile — el box-shadow ya no cambia durante el giro.
- El botón GIRAR: `pointer-events: none` durante el spin ya existe, mantenerlo.

## Archivos a tocar

- `src/lib/platform.ts` — nuevo, `isAndroid`.
- `src/components/SlotSamuraiGame.tsx` — cambios en `Reel`, `SymbolTile`, backdrops y ornamentos (secciones ~398–614 y ~699–880).
- `src/components/SlotGame.tsx` — mismos cambios equivalentes en su `SymbolTile`, backdrops y strip.
- (Opcional) `src/styles.css` — si alguna keyframe usa `filter` se convierte a `opacity`/`transform` para compositar en GPU.

## Fuera de alcance

- No se toca la lógica del servidor, RTP, símbolos, pagos, sonidos, ni el flujo de spin.
- No se cambia el diseño en iOS ni en desktop más allá de mover las animaciones a "solo cuando el rodillo está quieto".
- No se añaden librerías nuevas.

## Verificación

1. Abrir Slot Mafia y Slot Samurai en Android real (Chrome), pulsar GIRAR varias veces seguidas y confirmar que el movimiento del rodillo es fluido y el resultado aparece sin "freeze".
2. Confirmar en iOS/desktop que las llamas, aura verde y ornamentos siguen apareciendo al ganar (sólo se retrasan hasta que el rodillo termina, que es cuando importan).
