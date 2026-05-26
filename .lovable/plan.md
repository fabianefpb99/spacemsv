## Objetivo
Tener 3 estados visuales claros del astronauta+cohete sin pedir más assets, reusando el SVG que enviaste.

## Plan

1. **Importar tu SVG nuevo** (`ASTRONAUTA_Mesa_de_trabajo_1-2.svg`) al proyecto como asset principal y reemplazar el SVG genérico actual.

2. **Estado IDLE (fase `betting` — antes de despegar)**
   - Astronauta+cohete tal cual lo enviaste, sin llama.
   - Flotación suave vertical (sube/baja 6–8px en loop de ~3s) + ligero balanceo de rotación (±2°) para que se sienta vivo pero quieto.
   - Sin partículas, sin halo rojo agresivo.

3. **Estado VUELO (fase `running` — multiplicador subiendo)**
   - Mismo SVG, pero "agarrado al cohete y volando":
     - Inclinación constante (~ -8° a -12°) para sensación de avance.
     - Vibración sutil continua (1–2px de jitter en x/y).
     - Llama CSS bajo el cohete (degradado amarillo→naranja→rojo, blur, parpadeo rápido).
     - Líneas/partículas de velocidad cayendo hacia atrás detrás del cohete (efecto "speed lines").
     - Halo rojo/naranja debajo más intenso conforme sube el multiplicador (opcional: intensidad ligada a `multiplier`).

4. **Estado CRASH (fase `crashed` — motor falla y cae)**
   - Llama se apaga de golpe (animación 150ms a opacity 0).
   - Sacudida corta del astronauta (200ms).
   - Cae hacia abajo con rotación lenta (~25°) y se desvanece al salir del stage, dentro de la capa aislada que ya tenemos (no genera scroll).
   - Las líneas de velocidad desaparecen instantáneamente al iniciar el crash.

5. **Implementación técnica**
   - Reemplazar el `<img src={astronautSvg}>` por la nueva ruta del SVG.
   - Mover las animaciones a `src/styles.css` con 3 keyframes nuevos: `idle-float`, `flying`, `crash-fall` (la actual `fly-away` se elimina o se renombra a `crash-fall`).
   - Aplicar la animación correcta vía clase condicional según `phase`.
   - La llama y las speed-lines se renderizan como divs CSS hijos del wrapper, con `opacity`/`display` controlados por `phase` (solo visibles en `running`).
   - Todo dentro del contenedor `pointer-events-none absolute` actual, para no reintroducir scroll.

## Resultado esperado
- Idle: astronauta flotando relajado, sin fuego.
- Vuelo: misma figura inclinada con llama y líneas de velocidad, sensación clara de movimiento.
- Crash: motor se apaga, vibra y cae fuera de pantalla.
- Cero scroll extra, cero cambios en la lógica de apuestas.
