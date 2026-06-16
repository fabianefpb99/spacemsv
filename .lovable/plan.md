## Objetivo
Reemplazar el tinte lavanda actual del fondo de página en modo claro por un blanco con un matiz crema tan leve que sea casi imperceptible, eliminando la sensación de "morado claro" que el usuario rechaza.

## Cambio propuesto
Reemplazar el color `#f4f1f9` por `#faf9f6` en los 3 puntos donde actúa como fondo de canvas en `src/styles.css`:

1. `html.light body` (línea 18)
2. `html.light .bg-\[\#060210\]:not(header):not(nav):not(.theme-dark-fixed)` (línea 24)
3. `html.light .home-win-row` (línea 95)

`#faf9f6` es un blanco hueso muy sutil (0.6% de saturación, matiz cálido). A simple vista lee como blanco puro, pero evita el frio/clinical de `#ffffff` y elimina completamente el componente lavanda de `#f4f1f9`.

## Verificación
Después del cambio se hará una captura del preview para confirmar que:
- El fondo general ya no tira a morado.
- Los módulos y tarjetas blancas sobre ese fondo mantienen buen contraste.
- No quedan elementos "huérfanos" que sigan usando el color lavanda antiguo.