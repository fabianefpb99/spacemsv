
## Objetivo

Rehacer `/slot` para que coincida visualmente con la referencia (estilo BETSPACE: morado oscuro, negro espacial, verde neón) y se sienta como un slot profesional tipo Pragmatic, con temática **Mafia Royale** (Peaky Blinders).

## Problemas actuales a corregir

1. Carretes planos, sin profundidad ni marcos luminosos.
2. Símbolos emoji genéricos → reemplazar por ilustraciones.
3. Animación "salta": los símbolos desaparecen y reaparecen ordenados en vez de bajar de forma continua.
4. HUD no replica la referencia (líneas, premio total, tiradas gratis, multiplicador, paytable inferior, controles de apuesta, últimas ganancias).

## Plan

### 1. Generar 8 ilustraciones de símbolos (PNG transparentes)

Usar `imagegen` (premium) en estilo cartoon premium tipo Peaky Blinders, paleta morado/verde neón BETSPACE, fondo transparente:

- `boss.png` — Jefe mafioso con sombrero (símbolo top)
- `hat.png` — Sombrero elegante de mafioso
- `briefcase.png` — Maletín con dinero
- `watch.png` — Reloj de oro de bolsillo
- `gold.png` — Lingote de oro
- `car.png` — Auto clásico años 20
- `chip.png` — Ficha premium de casino
- `card.png` — Carta especial (As)

Guardar en `src/assets/slot/`.

### 2. Rediseñar `SlotGame.tsx` con HUD tipo referencia

Estructura mobile-first replicando la imagen:
- Barra superior: **LÍNEAS / PREMIO TOTAL / TIRADAS GRATIS / MULTIPLICADOR** en cápsulas con borde morado y números neón verde.
- Marco del slot con **borde morado glow doble**, esquinas recortadas, label "MAFIA ROYALE" tipo logo neón centrado arriba con destellos.
- Indicadores laterales "10 LÍNEAS" verticales en verde neón.
- Paytable horizontal scrollable bajo el slot (5 entradas con triplete de símbolo y multiplicador).
- Footer: **APUESTA (COP)** con `−` / valor / `+`, fila de quick-bets (`x2 +1.000 +2.000 +5.000 +10.000`), botón **GIRAR** verde neón grande "MANTENER PARA AUTO".
- Banda inferior fija de **ÚLTIMAS GANANCIAS** con cápsulas (multiplicador + monto COP).

### 3. Animación de carretes continua (sin desaparición)

Reemplazar implementación actual por **tira vertical larga** (~30 símbolos) por carrete que se traslada con `transform: translateY()` y `transition` con `cubic-bezier`. Cada reel:
- Tira = `[...buffer aleatorio, ...símbolosFinales]`.
- Al girar: animar `translateY` desde 0 hasta `-(longitud-3)*tileH` con duración escalonada (2.2s, 2.4s, 2.6s, 2.8s, 3.0s) y easing `cubic-bezier(0.15, 0.85, 0.35, 1)` (acelera y desacelera con micro-bounce).
- Sin `display:none`, sin reset visible — el símbolo final ya está pre-rendereado en la tira; al terminar la transición se hace snap silencioso a la posición base con los símbolos finales en las 3 filas visibles.
- Pequeño "kick" hacia arriba al iniciar (overshoot de 1 fila) antes de bajar, para sensación premium.

### 4. Profundidad y efectos premium

- Cada celda con gradiente radial sutil morado, **inset shadow** y **borde con glow** que pulsa en líneas ganadoras.
- Reflejo superior (gradiente blanco 8% opacity) sobre cada símbolo para sensación 3D.
- Sombras de viñeta dentro del marco del slot.
- Partículas flotantes (puntos verde/morado animados con CSS) sobre el marco al iniciar giro y al ganar.
- Líneas ganadoras: trazar SVG overlay sobre las celdas con `stroke` verde neón animado + glow.
- Banner de victoria central con "¡GRAN PREMIO!" y monto, escalando con `scale-in`.

### 5. Lógica del juego (mantener calidad existente)

Conservar:
- 5x3, 10 paylines configurables (LÍNEAS dropdown 1/5/10).
- Sistema de pesos por símbolo (boss más raro, card más común).
- Pagos por 3/4/5 en línea, multiplicador aplicado.
- Historial "Últimas ganancias" (últimos 4-6 spins ganadores).
- Audio: spin start, reel stop escalonado, win, big win.

### Detalles técnicos

```
src/assets/slot/
  boss.png, hat.png, briefcase.png, watch.png,
  gold.png, car.png, chip.png, card.png
src/components/SlotGame.tsx  (rewrite)
src/routes/slot.tsx          (head: title "Mafia Royale | BETSPACE")
```

Reel component (pseudocódigo):
```tsx
const STRIP_LEN = 30;
// strip = [...randomFillers(27), ...finalThree]
<div className="reel-window">  // overflow-hidden, height = 3*tileH
  <div style={{ transform: `translateY(${spinning ? -offset : 0}px)`,
                transition: spinning ? `transform ${dur}ms cubic-bezier(.15,.85,.35,1)` : 'none' }}>
    {strip.map(sym => <SymbolTile />)}
  </div>
</div>
```
Al terminar la transición (onTransitionEnd) → quitar transición + reset a strip con los 3 finales en top sin parpadeo.

### Sobre los iconos

Procedo a **generar yo las ilustraciones** con imagegen premium (estilo Peaky Blinders cartoon). Si no te gustan después, puedes enviarme las tuyas y las reemplazamos 1:1 en `src/assets/slot/`.

### Fuera de alcance

- No tocar Spaceman, Buscaminas, Home, Pay.
- No cambiar balance/wallet ni rutas de pago.
