Plan de ajuste de la sombra de las patas en Chicken Road

Objetivo: corregir la sombra ovalada bajo la gallina para que la pata derecha (desde la vista del usuario) deje de "flotar" y también aparezca apoyada sobre la sombra, igual que la pata izquierda.

Análisis actual:
- El sprite de la gallina está en `.chicken-sprite` (posición absoluta, `bottom: 26%`, ancho 44%, centrado).
- Dentro del mismo contenedor se renderiza un único `<span className="chicken-foot-shadow">`.
- La sombra actual tiene `left: 54%`, `bottom: 4px`, `width: 60%`. Esto deja la pata derecha del sprite sin contacto visual porque esa pata está más arriba y más a la derecha.

Cambios a realizar:
1. En `src/styles.css`, modificar `.chicken-foot-shadow`:
   - `left: 54%` → `58%` (desplazar la sombra unos 4 puntos a la derecha para ubicarla bajo la pata derecha).
   - `bottom: 4px` → `2px` (subirla una milésima para que la pata derecha la toque visualmente).
   - `width: 60%` → `68%` (ampliar ligeramente la elipse para que la pata izquierda siga tocando la sombra a pesar del desplazamiento).
2. Verificar que las variantes de animación (`.chicken-fx-prepare`, `.chicken-fx-land-bounce`, etc.) mantengan proporciones similares y no se rompan con la nueva posición.
3. No se modifica el sprite, la lógica de juego, ni el markup del componente.

Archivos afectados:
- `src/styles.css` (único cambio de estilos).

Validación:
- Revisar el render en el preview del juego /chicken para confirmar que ambas patas tocan la sombra.