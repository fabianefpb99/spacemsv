## Rediseñar la tabla de premios

Actualmente en `src/components/SlotGame.tsx` (líneas 708–731) la sección de "premios" muestra los 5 símbolos top con **3 iconos pequeños repetidos** + el multiplicador. Al ser 3 iconos pegados, cada uno se ve muy chico y poco legible.

### Cambios

1. **Cada tarjeta de premio mostrará:**
   - 1 solo icono del símbolo, más grande (~h-9 w-9 en vez de h-5 w-5)
   - Una etiqueta **"x3"** discreta al lado del icono (chip pequeño con borde, estilo neón sutil) indicando que el premio corresponde a 3 en línea
   - El multiplicador de pago (ej. `750.00x`) debajo, igual que ahora pero un poco más grande para aprovechar el espacio

2. **Mostrar más ejemplos de premios:**
   - Pasar de 5 a **los 8 símbolos** (todos los de `SYMBOLS`)
   - Cambiar el grid de `grid-cols-5` a `grid-cols-4` con 2 filas (4×2 = 8 tarjetas) para que cada tarjeta tenga más ancho y respire mejor en mobile (390px)

3. **Estilo visual:**
   - Mantener el `glass-panel` / borde púrpura existente
   - Conservar el glow por símbolo (usa `s.glow`)
   - El chip "x3" usará color verde neón suave para mantener coherencia con el resto de la UI

### Archivo afectado

- `src/components/SlotGame.tsx` — solo la `<section>` de pay table preview (líneas 708–731). Sin cambios a lógica de juego, sonidos ni datos.

### Nota

Detecté también un error de runtime (`playSpinPress is not defined`) que quedó como referencia huérfana tras quitar el sonido del botón. Lo limpio en el mismo cambio.
