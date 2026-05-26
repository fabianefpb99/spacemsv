## Ajustar distribución de crash points

Aplicar en `src/components/SpacemanGame.tsx` la función `generateCrashPoint()` con las probabilidades exactas solicitadas:

- 15% instantáneos (1.00x – 1.03x)
- 62% bajos (1.03x – 2.50x)
- 15% medios (2.50x – 7.50x)
- 5% altos (7.5x – 27x)
- 3% jackpot (27x – 107x)

Solo cambia la lógica de los `if (r < ...)` para reflejar los nuevos umbrales acumulativos.