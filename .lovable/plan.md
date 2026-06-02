## Modelo de saldo promocional (bonus-first, ganancias a real)

### Reglas de negocio

1. **Apostar:** débito automático bonus-first. Primero consume `bonus_balance`, completa con `balance` (real) si la apuesta es mayor.
2. **Ganar:** 100% del premio se acredita a `balance` (real). El bono no "regenera" bono.
3. **Retirar:** solo se permite hasta el monto de `balance`. `bonus_balance` nunca se retira.
4. **Sin caps ni locks:** la apuesta es libre (respeta min/max del juego). No se bloquea al usuario aunque el bono sea menor que la apuesta mínima.
5. **Bono de bienvenida (beta):** se queda en `balance` real por ahora. Al cerrar la beta, cambias `handle_new_user` para dar 0 o mover el welcome a `bonus_balance`.
6. **Trazabilidad:** cada transacción de apuesta guarda en `meta` cuánto salió del bono y cuánto del real.

---

### Cambios técnicos

#### 1. Backend SQL (migración)

Helper `_debit_bet(user_id, amount)` que:
- bloquea la fila de `user_balances`
- valida `balance + bonus_balance >= amount`
- calcula `from_bonus = min(bonus_balance, amount)` y `from_real = amount - from_bonus`
- actualiza ambas columnas en una sola operación atómica
- devuelve `(new_balance, new_bonus, from_bonus, from_real)`

Helper `_credit_win(user_id, amount)` que suma todo a `balance`.

Modificar las funciones existentes para usar estos helpers:
- `spin_slot_v1`
- `spaceman_place_bet` (débito) y `spaceman_cashout` (crédito)
- `bj_apply_action` (débito al abrir mano, crédito al cerrar)
- Mines (si tiene RPC equivalente)

Cada `INSERT INTO transactions` de tipo `bet` incluye en `meta` el desglose `{from_bonus, from_real}`.

#### 2. Hook `useMe`

Mantiene `balance` y `bonus_balance` por separado. Agregar campos derivados:
- `totalBalance = balance + bonus_balance` (lo que muestra el HUD principal)
- `withdrawable = balance`

#### 3. HUD de los juegos (cambio visual mínimo)

En cada juego (Slot, Spaceman, Blackjack, Mines, Dice), en el control donde el usuario fija la apuesta:

- **Si `bonus_balance > 0` y la apuesta toca al menos $1 de bono:**
  - El monto apostado se renderiza en **amarillo** (token `text-warning` o equivalente del design system).
  - Debajo del monto, en tipografía muy pequeña: `+550 BONUS` (también en amarillo), donde `550 = min(bonus_balance, bet_amount)`.
- **Si `bonus_balance = 0`:**
  - El monto vuelve al color blanco normal (sin texto debajo). Cero cambio respecto a hoy.

Esto se hace creando **un único componente compartido** `BetAmountDisplay` que recibe `betAmount` y `bonusBalance` y aplica la lógica de color + micro-texto. Cada juego lo importa en lugar de su `<span>` actual. No se toca el layout, solo el contenido del span del monto.

#### 4. `/perfil`

Mostrar dos cifras en la sección de saldo:
- **Real:** `$X` (etiqueta "Disponible para retirar")
- **Bono:** `$Y` (etiqueta "Saldo promocional · no retirable")

Usar `formatCompactCOP` ya implementado.

#### 5. Validación de retiros

Cuando se implemente el flujo de retiro, validar `monto <= balance` (real), nunca contra `total`.

---

### Lo que NO se toca

- Layout/dimensiones de los HUDs.
- `/home` (sigue mostrando total combinado).
- Tabla `user_balances` (ya tiene las dos columnas).
- `handle_new_user` (welcome bonus sigue como real en beta).

---

### Orden de implementación

1. Migración SQL con helpers + actualización de las 4 funciones de juego.
2. `useMe`: agregar `totalBalance` y `withdrawable`.
3. Componente `BetAmountDisplay` (amarillo + `+X BONUS`).
4. Reemplazar los spans de monto apostado en Slot, Spaceman, Blackjack, Mines, Dice.
5. Actualizar `/perfil` con desglose real/bono.
6. Probar con un usuario que tenga saldo mixto: apostar > bono, verificar débito atómico, ganar, verificar crédito 100% a real.