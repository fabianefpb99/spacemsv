Cambios sólo visuales en `src/components/SlotSamuraiGame.tsx`. No toco lógica, RTP, backend, header BETSPACE ni HUD.

## 1. Subir el fondo Samurai (un pelín más visible)
En el contenedor raíz cambio el gradiente overlay para bajar su opacidad:
- Antes: `rgba(10,4,22,0.35) → 0.55 → 0.9`
- Nuevo: `rgba(10,4,22,0.15) → 0.35 → 0.75`

Así el fondo se nota una milésima más sin comprometer legibilidad de reels/HUD (que ya tienen sus propios fondos oscuros).

## 2. Hueco bajo el logo para los eventos WIN
El logo Samurai queda igual pero reservo espacio fijo debajo para el evento:
- `SamuraiHero`: añado un `<div>` reservado de altura fija (~44px) siempre presente (renderiza el evento cuando existe, vacío en idle). Así los reels bajan un poco y el bloque WIN queda pegado bajo el logo sin empujar el layout entre giros.
- Para compensar y no reintroducir scroll: reduzco `TILE_H` de 86 → 78 (300 → ~234px de reels, gana 24px), y bajo `mt` del hero de `0.5` a `0`. Neto: cabe todo dentro de 100dvh.

## 3. Nuevos logos WIN / BIG WIN / MEGA WIN / SUPER WIN
Registro los 4 PNG subidos como Lovable Assets:
- `src/assets/samurai/win-win.png.asset.json`
- `src/assets/samurai/win-big.png.asset.json`
- `src/assets/samurai/win-mega.png.asset.json`
- `src/assets/samurai/win-super.png.asset.json`

En `SamuraiHero`, reemplazo el texto gradient `WIN/BIG WIN/…` por `<img>` del logo correspondiente al tier:
- `win` → WIN.png
- `big` → BIG WIN.png
- `mega` → MEGA WIN.png
- `super` → SUPER WIN.png
- `jackpot` → reutiliza SUPER WIN (no hay logo dedicado)

Debajo del logo, pegado (`mt-0` / muy pequeño margen), va el monto ganado en amarillo tal como está hoy: `+{formatCOP(displayedWin)} COP`, un poco más grande y con text-shadow reforzado para que se lea sobre el fondo.

## 4. Validación
Preview 390×844: `scrollHeight <= innerHeight`, logo + evento WIN + monto visibles bajo el logo, reels + paytable + HUD apuesta + últimas ganancias todo en una sola vista.

Archivos:
- editar: `src/components/SlotSamuraiGame.tsx`
- crear: 4 `.asset.json` de los logos WIN

NO toco: lógica de spin, RTP, seguridad, HUD balance/auth, header BETSPACE, otros juegos.
