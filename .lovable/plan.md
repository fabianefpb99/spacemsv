# Reorganización dinámica de personajes en la arena

## Problema
Con el `FIXED_SLOT_MAP` actual (Shadow front-left, Nova back-left, Blaze back-right, Titan front-right) hay parejas que nunca pueden atacarse de forma natural:
- Blaze (back-right) no tiene ángulo para golpear a Titan (front-right) — quedan en la misma columna y se traparían.
- Nova (back-left) tampoco tiene ángulo para golpear a Shadow (front-left).

El boceto fijo se rompe en cuanto el log de combate incluye esas combinaciones, porque no hay animación visible.

## Solución
Calcular el `slotMap` por evento en lugar de mantenerlo fijo. Antes de cada golpe, evaluamos si la pareja atacante→objetivo tiene ángulo válido; si no, intercambiamos a dos personajes para abrir la línea de ataque. Las "permutaciones" se hacen sólo cuando son necesarias y respetando estas reglas:

### Reglas de jerarquía
1. Los 4 slots (`backLeft`, `backRight`, `frontLeft`, `frontRight`) siguen existiendo: siempre 2 atrás y 2 al frente.
2. Cada personaje mantiene su lado natural por defecto (Shadow/Nova izquierda, Titan/Blaze derecha) para que sigan mirando al centro sin mirror.
3. Antes de cada evento, si atacante y objetivo están en la misma columna, se hace un swap mínimo:
   - Si ambos están en el mismo lado (ej. Blaze→Titan, derecha): el atacante sube al frente y el objetivo baja atrás (o viceversa, según quién esté arriba).
   - Esto garantiza un lunge diagonal limpio hacia el centro.
4. Después del golpe, el slotMap queda como esté para el siguiente evento (no se "rebobina"). Esto da continuidad visual y evita parpadeos.
5. Si el siguiente evento ya es atacable con la disposición actual, no se hace ningún swap.

### Animación del swap
- El cambio de slot se anima con la misma transición que ya tiene `FighterSlot` (transform suave), así que mover a un personaje de `back` a `front` (o de un lado al otro) se ve como un desplazamiento corto antes del golpe.
- El swap ocurre ~200ms antes de disparar el `lunge`, dando tiempo a que el personaje "se acomode" en su nueva posición y el ataque salga natural.

### Jerarquía Z
Se mantiene la regla actual (atacante back→front sube a z=11, oponente front no involucrado sube a z=12). Como sigue siendo lógica basada en el slot final, funciona igual con la disposición dinámica.

## Detalles técnicos

**Archivo:** `src/components/games/arena/ArenaFight.tsx`

1. Reemplazar `const slotMap = FIXED_SLOT_MAP;` por un estado `const [slotMap, setSlotMap] = useState(FIXED_SLOT_MAP)`.
2. Añadir helper `reorganizeForEvent(currentMap, attacker, target): SlotMap` que:
   - Calcula los slots actuales de atacante y objetivo.
   - Si están en columnas distintas o filas distintas (diagonal o misma fila), devuelve `currentMap` sin cambios.
   - Si están en la misma columna, hace swap entre el objetivo y el otro personaje del lado opuesto en su misma fila (el más cercano), de modo que atacante y objetivo queden en columnas distintas.
3. En el `useEffect` que avanza eventos, antes de `setLungeId(ev.attacker)`:
   - Calcular `newMap = reorganizeForEvent(slotMap, ev.attacker, ev.target)`.
   - Si `newMap !== slotMap`, `setSlotMap(newMap)` y retrasar el lunge ~220ms con un `setTimeout` adicional.
4. `slotOf` ya es derivado de `slotMap`, así que sigue funcionando.

**Sin cambios** en assets, lógica de combate, HP, ni en el banner de eventos.

## Verificación
- Probar con un log que incluya Blaze→Titan, Titan→Blaze, Nova→Shadow, Shadow→Nova: los personajes deben reacomodarse antes del golpe y el ataque debe verse limpio.
- Probar con un log de ataques diagonales: no debe haber reacomodos innecesarios.
