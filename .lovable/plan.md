## Ajustar probabilidades de crash points en SpacemanGame.tsx

En `src/components/SpacemanGame.tsx`, función `generateCrashPoint()` (líneas 44-56), actualizar los umbrales acumulativos a los valores exactos que confirmó el usuario:

- Instantáneo 1.00–1.03x: **17%** → `r < 0.17`
- Bajo 1.03–2.50x: **62%** → `r < 0.79`
- Medio 2.50–7.50x: **15%** → `r < 0.94`
- Alto 7.5–27x: **4%** → `r < 0.98`
- Jackpot 27–107x: **2%** → `r >= 0.98`

Solo cambian los 5 números de umbral en los `if (r < ...)`.