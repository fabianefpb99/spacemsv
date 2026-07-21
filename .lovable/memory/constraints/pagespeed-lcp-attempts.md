---
name: PageSpeed LCP - intentos fallidos
description: Cambios que empeoraron el score de PageSpeed y NO deben repetirse al optimizar LCP en el home
type: constraint
---
Contexto: se intentó subir el score de PageSpeed del home (partía en ~62) y varios cambios lo bajaron a ~52-53 con LCP de 12-14s.

**No repetir estos cambios (empeoraron el LCP):**
- No retrasar `PromoPopup` con `setTimeout` (probamos 1500ms y 3000ms → peor).
- No añadir `loading="lazy"` / `fetchPriority="low"` a la imagen del popup como "truco" para que no sea LCP → no funcionó.
- No condicionar `PromoPopup` a interacción real del usuario (`pointerdown`/`scroll`/`keydown` + idle fallback) → no mejoró y complicó UX.
- No aplicar el mismo patrón "solo tras interacción + botón 44x44" a `MascotFloater` con la intención de arreglar LCP/accesibilidad — no fue la causa real.
- No añadir `<link rel="preload">` para `combo-starter.webp` (compite con el hero).

**Lo que SÍ ayudó y se debe mantener:**
- Preload del hero LCP (imagen de Arena) en `src/routes/index.tsx`.
- Self-host de fuentes vía `@fontsource`.
- Compresión de imágenes legacy a WebP (12.5 MB → 685 KB).

**Why:** múltiples iteraciones (>1h) confirmaron que tocar PromoPopup/MascotFloater para "esconder" el LCP no mejora el score real; el usuario decidió revertir. Antes de volver a optimizar rendimiento, medir primero cuál es el elemento LCP real en producción y no asumir que es el popup o la mascota.