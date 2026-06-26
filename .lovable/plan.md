## Diagnóstico

El RPC actual `get_recent_public_wins` calcula el multiplicador haciendo JOIN con `game_bets` por `game_round_id`. Pero al revisar la base de datos:

| Juego | ¿Tiene `game_round_id`? | ¿Dónde está el multiplicador? |
|---|---|---|
| spaceman | ✅ | `game_bets.payout / amount` |
| arena | ✅ | `game_bets.payout / amount` |
| mines | ❌ | `meta.multiplier` (ej. `1.64`) y `meta.bet` |
| ruleta | ❌ | `meta.multiplier` (ej. `1.95`) |
| slot | ❌ | hay que dividir `win.amount / abs(bet.amount)` usando `meta.bet_tx_id` |
| blackjack / blackjack_vip | ❌ | `meta.bet` (mult = `amount / meta.bet`) |
| dice | ❌ | igual al patrón anterior (meta.bet o meta.multiplier) |

Por eso la mayoría de los reales caen al fallback `1.00x`. El dato siempre está en `transactions.meta` (JSONB) — solo falta leerlo con la cascada correcta.

## Solución

Recrear el RPC `get_recent_public_wins(p_limit)` con una cascada `COALESCE` que cubre todos los casos:

```text
multiplier =
  1) meta->>'multiplier'                          (mines, ruleta, etc.)
  2) amount / (meta->>'bet')::numeric             (blackjack, blackjack_vip, mines viejos)
  3) amount / ABS(bet_tx.amount)                  (slot — join a transactions por meta.bet_tx_id)
  4) game_bets.payout / game_bets.amount          (spaceman, arena — join por round_id+user)
  5) 1.00                                         (fallback final)
```

LEFT JOINs necesarios:
- `game_bets gb ON gb.round_id = t.game_round_id AND gb.user_id = t.user_id`
- `transactions bet_tx ON bet_tx.id = (t.meta->>'bet_tx_id')::uuid AND bet_tx.type = 'bet'`

Se redondea a 2 decimales y se garantiza que no salga `<= 0` (sino se muestra `1.00x`).

## Pasos

1. **Migración**: `DROP FUNCTION get_recent_public_wins(integer)` + recrear con la cascada anterior.
2. **Frontend** (`src/routes/home.tsx`): ya muestra `w.mult.toFixed(2)x`; no requiere más cambios — solo asegurar que el cliente trate `multiplier` ≤ 0 como `1`.
3. **Verificar** ejecutando el RPC manualmente y comparando contra los últimos `mines`/`slot`/`ruleta`/`blackjack` reales.

## Nota aparte

Hay un warning de "Hydration failed" en el feed de ganancias (orden distinto entre SSR y cliente). No bloquea esta funcionalidad, pero conviene marcar esa sección como `client-only` en un turno siguiente si quieres que lo arregle.
