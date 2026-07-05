## Samurai Legend — clon 5×3 de Slot Mafia

### Estrategia
Clonar Slot Mafia manteniendo intacta toda la lógica (RNG, RTP, seguridad, apuestas, animaciones, balance). Solo cambiar: matriz (5×3), paylines adaptadas, símbolos más grandes, banner superior nuevo (reemplazo de HUD superior), tema visual samurái. Ruta nueva `/slotsamurai`. Slot Mafia queda intacto.

### Backend (migración Supabase)

Crear un juego **separado** (`slot_samurai`) para no contaminar métricas/RTP/boost/misiones del slot original:

1. **Nueva función SQL** `public.spin_slot_samurai_v1(uuid, numeric, uuid)` — copia byte-a-byte de `spin_slot_v1` pero con:
   - `v_rows := 3` (antes 4)
   - Nuevo set de 20 paylines válidas en 5×3 (filas 0–2), Pay Both Ways igual
   - `v_line_count := 20`
   - Mismos símbolos, pesos, tablas de pago, min/max/step
   - Registra en `transactions.game = 'slot_samurai'`
   - Boost target por `'slot_samurai'`
2. Grants: `REVOKE ... FROM anon, public`, `GRANT EXECUTE TO authenticated, service_role` (idéntico a `spin_slot_v1`).
3. Seed en `rtp_config`: fila `('slot_samurai', 94.50, 94.50)`.
4. **Sin cambios** en `spin_slot_v1`, tablas, RLS, ni columnas — cero superficie extra.

### Server function

- `src/lib/games/slot-samurai.functions.ts` — copia de `slot.functions.ts` llamando `spin_slot_samurai_v1`. Mantiene `requireSupabaseAuth`, Zod, mismos errores.
- `src/lib/games/slot-samurai.shared.ts` — copia de `slot.shared.ts` con `SLOT_ROWS = 3`, `SLOT_PAYLINES` de 20 líneas para 5×3, mismos símbolos/pagos.

### Frontend

- `src/routes/slotsamurai.tsx` — copia de `slot.tsx`, head con SEO propio ("Samurai Legend"), renderiza `<SlotSamuraiGame />`.
- `src/components/SlotSamuraiGame.tsx` — clon de `SlotGame.tsx` con:
  - Grid 5×3, símbolos escalados proporcionalmente (más grandes)
  - **Eliminado** el módulo superior (Líneas / Premio Total / Tiradas Gratis / Multiplicador / contenedor "MAFIA ROYALE")
  - En su lugar: contenedor `<SamuraiBanner />` de mayor altura, listo para recibir el fondo definitivo (siguiente prompt) y para renderizar overlays de eventos (Win / Big Win / Mega Win / Super Win / Jackpot / Free Spins). El sistema de eventos ya se cablea (mismo estado del `total` actual → decide overlay por umbral × apuesta), pero visualmente vive dentro del banner en vez del HUD superior antiguo.
  - Header BETSPACE y HUD inferior de apuestas: intactos (mismos componentes)
- **Logo SVG**: intento profesional en `src/assets/samurai-legend-logo.svg` (tipografía tipo brush + katana estilizada, paleta BETSPACE morado/rosa/rojo). Si el resultado no se ve premium tras revisión visual, se deja como placeholder con nota `TODO_REPLACE_SVG` para reemplazo posterior.
- **Fondo del banner**: la imagen adjunta `backgroud-samurai-betspace-2.png` se sube vía `lovable-assets` (comprimida a WebP ≤1024px, quality ~72, siguiendo la regla de memoria) y se usa como fondo del `<SamuraiBanner />`.

### Integraciones (home, menús, admin)

- `src/routes/-home-page.tsx`: nuevo tile "SAMURAI LEGEND" apuntando a `/slotsamurai` (asset propio, se generará imagen tile pequeña o se reutiliza recorte del fondo comprimido). Se añade a la tabla `HOT_GAMES_LINKS` y al mapping de nombres.
- `LoadingScreen.tsx`: nueva variante `slot_samurai` (o reutiliza `slot` si el fondo es igual — se decide en implementación).
- Admin:
  - `MissionsSection.tsx`: añadir `{ value: "slot_samurai", label: "Samurai Legend" }`.
  - `RtpSection.tsx`: aparecerá automáticamente al leer `rtp_config` (fila seed nueva). Verificar y ajustar label si hardcodea nombres.
  - `BoostSection.tsx`: añadir opción `slot_samurai` si lista juegos hardcoded.
  - `DashboardSection.tsx` / earnings: revisar mapeos por `game` para incluir el nuevo key en labels.
- Sidebar / drawers si listan juegos: añadir entrada.

### Seguridad

- Función `SECURITY DEFINER` con `search_path` fijo, grants sólo a `authenticated`/`service_role` (idéntico patrón que `spin_slot_v1`). No se abre RLS nueva, no se exponen claves, no se altera esquema `auth`/`storage`. Reutiliza `_debit_bet` / `_credit_win` / `is_boost_target`.

### Detalles técnicos (paylines 5×3)

20 líneas válidas para filas 0–2 (subset directo de las 25 originales quitando referencias a fila 3, más V/W adaptadas). Definidas idénticas en SQL y en `SLOT_PAYLINES` compartido para que el cliente pinte las mismas cells que devuelve el servidor.

### Orden de ejecución

1. Migración SQL (spin_slot_samurai_v1 + rtp_config seed) — approve → ejecuta → regenera types.
2. Subir fondo con `lovable-assets` (WebP comprimido).
3. Archivos frontend + server function + admin edits.
4. Verificar build TS y smoke test visual en `/slotsamurai`.