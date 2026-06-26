## Objetivo

Que el panel "Últimas ganancias" muestre SIEMPRE el multiplicador (ej. `1.08x`, `3.57x`) tanto para fillers como para jugadores reales. Eliminar el texto `¡GANÓ!`.

## Cambios

### 1) Backend — `get_recent_public_wins` (nueva migración)
Recalcular la RPC para devolver también el multiplicador real de la apuesta:

- Añadir columna `multiplier numeric` al RETURNS.
- Hacer `LEFT JOIN public.game_bets b ON b.round_id = t.game_round_id AND b.user_id = t.user_id`.
- `multiplier = ROUND(b.payout / NULLIF(b.amount,0), 2)`.
- Fallback: si no hay bet asociado (algún `win` sin round), `multiplier = ROUND(t.amount / NULLIF((SELECT ...),0), 2)` no es viable → usar `COALESCE(..., 1.00)` para no romper UI.
- Mantener filtros (`type='win'`, `amount>0`, últimas 24h) y el `GRANT EXECUTE` existente.

### 2) Frontend — `src/lib/recent-wins.functions.ts`
- Añadir `multiplier: number` al tipo `RecentWin` y al `map` del handler.

### 3) Frontend — `src/routes/home.tsx`
- En el mapeo de `recentWinsQ.data` a `FillerWin`, asignar `mult: w.multiplier` (eliminar el `0` sentinel y el comentario).
- En el render (línea ~1002), reemplazar el bloque condicional `¡GANÓ!` por siempre mostrar `{mult.toFixed(2)}x` con el mismo estilo morado/violeta que ya usan los fillers.
- Eliminar cualquier referencia a la rama `mult === 0`.

## Resultado visual
Todas las filas (reales y fillers) muestran `$ monto COP` + `N.NNx` debajo, con el mismo formato. Sin `¡GANÓ!` en ningún caso.