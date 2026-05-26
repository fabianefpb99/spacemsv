## Mensajes durante el vuelo

Replicar el sistema actual de `IDLE_MESSAGES` (que aparece en fase `betting` al lado del astronauta) pero ahora para la fase `running`, con cuatro tramos de multiplicador y posición un poco más abajo para no tapar al cohete.

### 1. Cuatro pools de frases en `src/components/SpacemanGame.tsx`

Justo debajo de `IDLE_MESSAGES`:

```ts
const FLIGHT_MESSAGES_1_2X = [
  "¡Boff!",
  "¿Ya se bajaron? El viaje apenas comienza.",
  "¡Abran paso!",
  "Próxima parada: ¡El infinito!",
  "Cruzo el cosmos sin frenos.",
];
const FLIGHT_MESSAGES_2_2X = [
  "Dejé la Tierra atrás hace rato.",
  "¡Boff! ¡Qué vista!",
  "Esquivando satélites como si nada.",
];
const FLIGHT_MESSAGES_3_1X = [
  "Aquí es donde los miedosos empiezan a sudar.",
];
const FLIGHT_MESSAGES_6X = [
  "¡Esto va a estallar, pero en la cara de los que se bajaron!",
  "Los cobardes cobran en 2x, ¡los reales seguimos aquí!",
  "Te dije que no te bajaras.",
];
```

### 2. Selección del tramo activo

Función `getFlightMessage(multiplier)` que devuelve el pool correspondiente según el último umbral cruzado:

- `>= 6` → pool 6x
- `>= 3.1` → pool 3.1x
- `>= 2.2` → pool 2.2x
- `>= 1.2` → pool 1.2x
- por debajo de 1.2 → ninguno

Se elige una frase aleatoria al **entrar** a un nuevo tramo (no rotar dentro del mismo tramo). Implementación: nuevo estado `flightTier` (0–4) + `flightMessage`. Un `useEffect` que observa `multiplier` y `phase === "running"`: cuando el tramo calculado cambia, se elige una frase aleatoria del pool de ese tramo y se guarda en estado. Al reiniciar (volver a `betting` o `crashed`), se resetea `flightTier = 0` y `flightMessage = null`.

### 3. Renderizado del mensaje en vuelo

Dentro del bloque del astronauta (líneas ~473–492), añadir un segundo contenedor hermano del que ya existe para `IDLE_MESSAGES`:

- Mismas clases tipográficas y animaciones (`msg-in`, `msg-pulse`, `msg-beat`, `textShadow` violeta) para mantener consistencia visual.
- Posición desplazada hacia abajo respecto al actual: en lugar de `top-1/2 -translate-y-1/2`, usar algo como `bottom-2 sm:bottom-4` y mantener el `left-[55%] right-3` para que aparezca abajo-derecha como en la imagen de referencia (donde "¡No retires, voy lejos!" sale debajo del cohete).
- Visible solo cuando `phase === "running"` y `flightMessage` existe; transición de opacidad igual a la del idle.
- `key={flightTier + "-" + flightMessage}` para reactivar la animación `msg-in` al cambiar de tramo.

### 4. Limpieza

- En `triggerCrash` y al iniciar nueva apuesta, resetear `flightTier` y `flightMessage` a estado inicial.
- No tocar lógica de física, audio, ni umbrales de overlay rojo/oscuro.

### Detalles técnicos

- Solo cambios de presentación en `src/components/SpacemanGame.tsx`.
- Sin nuevos assets, sin nuevas dependencias.
- Las animaciones CSS (`msg-in`, `msg-pulse`, `msg-beat`) ya existen en `src/styles.css` y se reutilizan tal cual.
- El multiplicador usado para el umbral es `multiplier` (el redondeado a 2 decimales que ya se muestra), no `exactMultiplier`, para que el cambio de mensaje coincida con lo que ve el usuario en pantalla.
