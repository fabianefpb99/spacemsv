
## Ajustes visuales Samurai Legend (`/slotsamurai`)

Solo se toca `src/components/SlotSamuraiGame.tsx` y assets del logo. Cero cambios en lógica, RTP, seguridad, header BETSPACE ni HUD de apuestas.

### 1. Fondo Samurai como fondo global (como el planeta en Slot Mafia)
- Eliminar el `<SamuraiBanner>` como tarjeta con fondo propio.
- Aplicar `samurai-bg.webp` como `background-image` del contenedor raíz del juego (mismo patrón que Slot Mafia con el planeta): `background-size: cover`, `background-position: top center`, con overlay oscuro sutil para legibilidad. El fondo cubre header + zona del logo + grid + HUD como un solo lienzo continuo, sin borde ni contenedor visible.

### 2. Logo Samurai PNG comprimido
- Tomar `user-uploads://SAMURAI-LEGEND-BETSPACE.png`, comprimir a WebP (~1024px máx, quality ~72) y subir con `lovable-assets create` → `src/assets/samurai/samurai-legend-logo.webp.asset.json`.
- Reemplazar el import del SVG actual por el nuevo pointer WebP.
- Borrar el SVG anterior (`samurai-legend-logo.svg`) al terminar.

### 3. Logo integrado sobre el paisaje (sin contenedor)
- Renderizar el `<img>` del logo centrado directamente sobre el fondo, sin card, sin borde, sin `background`, solo `drop-shadow` sutil.
- Debajo del logo (mismo bloque, sin panel): overlay de eventos (MEGA WIN / BIG WIN / +monto) como texto flotante sobre el fondo. Mantiene el sistema de tiers ya cableado.

### 4. Layout compacto 5×3 sin scroll (390×844 ref.)
- **Zona superior (logo + eventos)**: altura reducida (~26–30% del alto útil), sin `min-height` grandes.
- **Grid 5×3**: subir `TILE_H` de `88` a ~`104–112` para símbolos más grandes aprovechando la fila menos.
- **Gaps verticales** entre zona superior ↔ marco slot ↔ HUD inferior: reducir a `8–12px` para sentir un único bloque.
- **Eliminar** el módulo inferior "¡GANASTE! $700". La ganancia se comunica solo arriba.
- Contenedor raíz `h-[100dvh] overflow-hidden flex-col`; las zonas reparten alto con `flex-1`/`flex-none` — sin scroll.

### 5. Lo que NO se toca
- `src/routes/slotsamurai.tsx`, server function, `slot-samurai.shared.ts`
- Header BETSPACE, HUD inferior (BetAmount, GIRAR, AUTO, quick bets, últimas ganancias)
- Admin, integraciones, home tile, RTP, seguridad

### Verificación
- Typecheck automático.
- Smoke visual en `/slotsamurai` 390×844: fondo continuo, logo PNG sin caja, grid más grande, sin scroll, sin panel "¡GANASTE!".
