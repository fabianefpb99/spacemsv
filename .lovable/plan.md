## Cambiar el grid del slot de 5×3 a 5×4

### Respuesta corta a tu pregunta
**Sí, afecta el algoritmo**, pero de forma controlada. Te explico abajo y propongo cómo manejarlo.

### Cambios visuales (sin alterar altura)

En `src/components/SlotGame.tsx`:
- `ROWS = 3` → `ROWS = 4`
- `TILE_H = 88` → `TILE_H = 66` (66 × 4 = 264 px, exactamente la misma altura que hoy: 88 × 3 = 264 px). **Cero cambio en alto del slot, cero scroll nuevo.**
- Los iconos dentro de cada tile se reescalan proporcionalmente para verse bien en el nuevo tamaño (ajuste de `h-*` / `w-*` en el componente Tile).

Resultado: mismo bloque vertical, pero con 4 filas en vez de 3 → desaparece el "aire" horizontal entre filas y se ve más denso y profesional, como un slot real.

### Impacto en el algoritmo (lo importante)

El motor de cálculo de premios recorre **PAYLINES** (líneas de pago). Hoy hay 10 líneas, todas definidas sobre filas 0–2. Hay dos caminos:

**Opción A — Solo visual, mismas 10 líneas (recomendado)**
- La fila 4 se muestra pero **no participa** en líneas de pago.
- Cero cambio matemático: misma probabilidad de ganar, mismo RTP, mismos premios. El algoritmo queda intacto.
- Contra: la fila extra es "decorativa", aunque visualmente queda igual de buena.

**Opción B — Extender a ~15 líneas usando las 4 filas**
- Se añaden 5 líneas nuevas que usan la fila 3 (ej.: línea inferior nueva, zig-zags entre filas 1–3, etc.).
- Más líneas = más probabilidad de combinaciones ganadoras → el RTP sube si no compensamos.
- Para mantener el RTP actual habría que: o bajar pagos por símbolo, o subir pesos de los símbolos "blanco" (menos premios), o aumentar la apuesta mínima por línea. Es un re-balanceo que toma su tiempo.

### Mi recomendación

Ir con **Opción A**: cambiar a 5×4 visualmente, mantener las 10 líneas actuales sobre las filas 0–2. Algoritmo intacto, look más profesional, sin riesgo de romper el balance económico del juego. Si más adelante quieres una versión con más líneas, lo hacemos como cambio separado y re-balanceamos con cuidado.

### Archivo afectado
- `src/components/SlotGame.tsx` (constantes ROWS, TILE_H y tamaño de iconos en el componente Tile).
