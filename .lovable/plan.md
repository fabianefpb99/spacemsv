## Objetivo

Reemplazar el marco actual del slot por uno **2D neón morado con esquinas recortadas** (estilo del ejemplo "USAR ESTE MARCO") y mover las etiquetas verticales **"10 LÍNEAS"** completamente fuera del área de carretes para que no pisen los íconos.

## Lo que entendí de la imagen

- ✅ Marco neón plano con cortes diagonales en las 4 esquinas + glow morado.
- ✅ Mismo grosor de borde y mismo glow, sin biseles 3D ni profundidad de "caja".
- ✅ Etiquetas "10 LÍNEAS" verticales **al exterior** del marco (no encima de las celdas).
- ❌ Quitar: contenedor 3D voluminoso, esquinas gruesas, sensación de bloque.

## Cambios (solo `src/components/SlotGame.tsx`)

### 1. Marco con esquinas recortadas (neón 2D)

Reemplazar el `<section>` actual de "Reels frame" (líneas 535-542) por un marco basado en **`clip-path` poligonal** (cortes de ~14px en cada esquina) + **borde con `filter: drop-shadow`** morado para el glow neón, sobre fondo oscuro plano.

Estructura:
- Capa externa: `clip-path: polygon(...)` con relleno morado neón (gradiente sutil).
- Capa interna (1.5–2px adentro, mismo clip-path escalado): fondo `#0a041c`.
- Glow: `filter: drop-shadow(0 0 14px rgba(168,85,247,0.55)) drop-shadow(0 0 28px rgba(168,85,247,0.25))`.
- Sin `box-shadow inset`, sin gradiente 3D, sin `border-radius` redondo.

Pequeños acentos en esquinas (4 marcas en L cortas) opcionales para reforzar look futurista, en verde tenue, sin volumen.

### 2. Etiquetas "10 LÍNEAS" fuera del marco

- Cambiar `-left-1` / `-right-1` (líneas 572, 575) a posiciones **fuera** del marco: `-left-6` / `-right-6` (o usar contenedor padre con `padding-x` adicional y posicionar las etiquetas en ese gutter exterior).
- Reservar espacio lateral en el contenedor padre con `px-7 sm:px-8` para que las etiquetas no se corten en pantallas pequeñas (390px viewport del usuario).
- Asegurar `z-index` por encima del fondo pero sin solapar las celdas: ahora estarán literalmente fuera, así que ya no pisan íconos.
- Mantener color verde neón actual, mismo tamaño tipográfico.

### 3. Limpieza menor

- Quitar las dos líneas decorativas top/bottom horizontales (580-581) — redundantes con el nuevo marco recortado.
- Mantener intacto el badge "MAFIA ROYALE" superior y el resto del HUD/lógica.

## Fuera de alcance

- No tocar la lógica del juego, animación de carretes, sonidos, paytable, controles de apuesta, botón GIRAR/AUTO.
- No regenerar los íconos PNG.
- No tocar otras rutas ni componentes.

## Resultado esperado

Marco idéntico en espíritu al ejemplo "USAR ESTE MARCO" de la referencia: plano, con cortes diagonales en las 4 esquinas, glow morado neón coherente con Spaceman/Buscaminas, y las etiquetas "10 LÍNEAS" respirando en el espacio lateral exterior sin tocar las celdas.
