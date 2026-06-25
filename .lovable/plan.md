## Blackjack VIP — clon con stats, RTP y tema independientes

Confirmado:
- Imagen de mesa VIP recibida (negro + dorado, marco curvo de cuero acolchado).
- Tema HUD: dorado (`amber-400/500`, `#d4a84c`) sobre negro profundo, reemplazando todos los moradores del original.
- Cartas también temables vía prop (no rompe el original).

---

## Implementación

### 1. Asset
- Subir `BlackJack VIP - Betspace.png` como asset CDN → `src/assets/blackjack-vip-bg.png.asset.json`.

### 2. Motor parametrizado (un solo código, dos juegos)
- `src/lib/games/blackjack.shared.ts`:
  ```ts
  export type BJVariantKey = "blackjack" | "blackjack_vip";
  export const BJ_VARIANTS = {
    blackjack:     { gameKey: "blackjack",     minBet: 500,    maxBet: 50_000,  betStep: 500   },
    blackjack_vip: { gameKey: "blackjack_vip", minBet: 5_000,  maxBet: 200_000, betStep: 1_000 },
  } as const;
  ```
- `src/lib/games/blackjack.functions.ts`: cada server fn (`bjResume`, `bjDeal`, `bjHit`, `bjStand`, `bjDouble`, `bjInsurance`) recibe `variant` en su input. Reemplazo de todos los `.eq("game","blackjack")` y `game:"blackjack"` por `cfg.gameKey`. El schema de bet se construye desde la config de la variante. `loadBjBias(variant)` lee la fila correspondiente en `game_rtp_config`.
- El RPC `bj_apply_action` no filtra por `game` → sirve para ambas variantes sin migración.

### 3. Ruta y componente
- `src/routes/blackjack-vip.tsx`: mismo patrón que `/blackjack`, pasa `variant="blackjack_vip"` y `theme="vip"`.
- `src/components/BlackjackGame.tsx`: nuevas props `variant: BJVariantKey` y `theme: "space" | "vip"`. Manda `variant` en cada llamada server. El `theme` se centraliza en un objeto de clases:
  ```ts
  const T = theme === "vip"
    ? { bg: bgVip.url, accent: "amber-400", panel: "border-amber-500/40 bg-black/60",
        primaryBtn: "bg-gradient-to-b from-amber-400 to-amber-600 text-black border-amber-300",
        card: "border-amber-400/60 bg-zinc-900 shadow-[0_0_18px_rgba(212,168,76,0.35)]",
        cardText: "text-amber-200", ... }
    : { /* tokens actuales morados — sin cambios */ };
  ```
  Todas las clases hardcoded del componente actual se reemplazan por `T.*`. Por defecto `theme="space"` produce el mismo render byte-a-byte que hoy → original intacto.
- `src/components/LoadingScreen.tsx`: agregar `variant: "blackjack_vip"` (reutiliza el promo VIP o el mismo por ahora).

### 4. Admin — juego separado automáticamente
- `src/components/admin/shared.tsx`: agregar `blackjack_vip: "BLACKJACK VIP"` en `GAME_LABELS`. El panel de Ganancias, KPIs, GGR y alertas ya agrupan por columna `game` → aparece como fila aparte sin más cambios.
- `src/components/admin/MissionsSection.tsx`: agregar `{ value: "blackjack_vip", label: "Blackjack VIP" }`.

### 5. Migración SQL
```sql
INSERT INTO public.game_rtp_config (game, rtp_target, is_active)
VALUES ('blackjack_vip', 98.50, true)
ON CONFLICT (game) DO NOTHING;
```

### 6. Acceso desde el home
- Añadir tarjeta "Blackjack VIP" al rotador de juegos destacados (mismo patrón que las otras), apuntando a `/blackjack-vip`.

---

## Garantías de no-regresión

- **`/blackjack` original** = mismo `variant="blackjack"` + `theme="space"` → mismas queries, mismo HUD, mismas cartas, mismo RTP.
- **Estadísticas** separadas por la columna `game` en `game_sessions` y `transactions` (ya existente).
- **Sesiones cruzadas** imposibles: `loadOpenSession` filtra por `game = variant`.
- **RTP independiente**: cada variante lee su fila en `game_rtp_config`; el admin las edita por separado en `RtpSection`.
- **Cartas temables sin romper original**: `theme="space"` mantiene clases actuales; `theme="vip"` aplica las doradas.

---

## Configuración inicial VIP

- Apuesta mín. **$5.000**, máx. **$200.000**, paso **$1.000**.
- RTP target **98.50%** (un poco más bajo que el normal por ser mesa premium; se ajusta luego en admin).
- Insurance / 3:2 / soft-17 idénticos al original.

Procedo.