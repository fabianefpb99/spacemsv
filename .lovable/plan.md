# Cambiar fucsia → morado oscuro de marca en el panel de apuesta

Solo `src/routes/deportes_.$matchId.tsx`, únicamente en los 3 elementos que mencionaste (cuota, "pago posible" y botón APOSTAR). El resto de la vista (badges, chips EMPATE, borde seleccionado, cabeceras, etc.) no se toca.

## Color de marca a usar

El morado oscuro que ya vive en el sitio (sidebar, drawer, gradientes de botones "Depositar/Registro") es la escala **purple** de Tailwind, tono 600/700. En `src/styles.css` el token de texto morado en modo claro es `rgb(107 70 193)` = `purple-700`. Ese es el que aplicaremos.

## Cambios exactos

```text
src/routes/deportes_.$matchId.tsx
```

1. **Cuota grande (la "3.12")** — línea ~365
   - Antes: `text-fuchsia-300 drop-shadow-[0_0_14px_rgba(217,70,239,0.6)]`
   - Después: `text-purple-300 drop-shadow-[0_0_14px_rgba(139,92,246,0.55)]`

2. **Bloque "Pago posible" (mobile, ya apostado)** — líneas ~478-483
   - Contenedor: `border-fuchsia-200 bg-fuchsia-50` → `border-purple-200 bg-purple-50`
   - Etiqueta "Pago posible": `text-fuchsia-500` → `text-purple-600`
   - Monto: `text-fuchsia-700` → `text-purple-700`
   - Sufijo "COP": `text-fuchsia-500` → `text-purple-500`

3. **Bloque "Pago posible" (desktop)** — líneas ~570-576
   - Mismo mapeo que el punto 2 (`fuchsia-*` → `purple-*` en las mismas intensidades).

4. **Botón APOSTAR** — líneas ~492, ~521 y ~583 (las 3 variantes: mobile placed, mobile CTA fija y desktop)
   - Antes: `bg-gradient-to-b from-fuchsia-500 to-purple-700 … shadow-[0_6px_18px_-6px_rgba(168,85,247,0.75)] … hover:from-fuchsia-400 hover:to-purple-600`
   - Después: `bg-gradient-to-b from-purple-600 to-purple-800 … shadow-[0_6px_18px_-6px_rgba(109,40,217,0.7)] … hover:from-purple-500 hover:to-purple-700`
   - Texto blanco y demás clases quedan igual.

## Lineamientos que respeta

- **No se tocan** los otros usos de fucsia en la vista (badge EMPATE en vivo, borde de selección de opción, iconos, header, avatar de equipos). Esos siguen como referencia visual del partido.
- **Modo claro**: `text-purple-700`, `bg-purple-50` y `border-purple-200` ya renderizan correctamente sin overrides adicionales en `styles.css` — no se dispara ninguna de las reglas `html.light` que ocultan morados claros porque no usamos tonos `purple-200/70` ni `text-purple-100`.
- **Subárbol oscuro**: la vista está bajo `theme-dark-fixed`, así que la cuota `text-purple-300` mantiene su glow morado sin ser sobreescrita.
- Sin nuevos tokens en `styles.css`, sin cambios de layout ni de lógica.

## Verificación después de implementar

- Vista `/deportes/:matchId` en mobile (390px) y desktop: la cuota, el recuadro "Pago posible" y el botón APOSTAR deben verse en morado marca; los demás fucsias del partido intactos.
- Alternar tema claro/oscuro: el botón y el pago posible deben mantener contraste en ambos.
