## Parpadeo de estrés en la gallina inactiva

Cuando la gallina lleva tiempo quieta en el asteroide (fase `idle` / esperando que el jugador pulse "Saltar"), superponer una versión con el ojo parpadeando para dar sensación de nerviosismo.

### Pasos

1. **Subir el asset**
   - Tomar `user-uploads://chicken-stress.png` y subirla con `lovable-assets` como `src/assets/chicken/chicken-stress.png.asset.json`.

2. **Insertar el sprite superpuesto en `src/components/ChickenGame.tsx`**
   - Importar el nuevo asset junto a los demás sprites de gallina.
   - Dentro del contenedor que ya renderiza `chicken-idle.png`, añadir un segundo `<img>` con la imagen de estrés:
     - Posición `absolute inset-0`, mismas dimensiones / object-fit que el sprite base → queda perfectamente alineado encima.
     - `pointer-events-none`.
     - Solo se renderiza cuando `phase === "idle"` (y `chickenFx` no esté en una animación activa de salto/caída), para no interferir con jump/land/loss.
     - Aplica `className="chicken-blink"` que controla el parpadeo.

3. **Animación CSS en `src/styles.css`**
   - Nueva keyframe `chicken-stress-blink`:
     - 0% → 92% `opacity: 0` (gallina normal visible).
     - 93% → 97% `opacity: 1` (parpadeo rápido, ~120 ms).
     - 98% → 100% `opacity: 0`.
   - Clase `.chicken-blink { animation: chicken-stress-blink 1s steps(1, end) infinite; }` para que sea un parpadeo seco (aparece/desaparece, sin fade) cada segundo, tal como pediste.

### Notas técnicas

- El sprite de estrés se monta solo durante `idle`, así no compite con `prepare`, `jump-*`, `land-bounce`, `slide-to-left`, ni con el sprite `fail` de la caída.
- Al usar `steps(1, end)` el ojo aparece de golpe y se va de golpe (sin transición), igual que un blink natural de estrés.
- Cero cambios en la lógica de juego ni en server functions — es puramente presentacional.
