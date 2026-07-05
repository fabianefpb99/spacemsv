# Mascota "Chica BETSPACE" flotante en Home (mobile)

Personaje decorativo anclado al borde inferior de la Home, **detrás** del bottom nav, con un globito *"¿Qué jugaremos hoy?"* a la izquierda de su cabeza. Solo mobile, solo Home.

## Comportamiento

- Aparece **después** de cerrar el popup `STARTER APUESTA` (cualquier vía: X, click en imagen, backdrop). Fallback: si el popup no se muestra en esta sesión (límite 2/hora), aparece igual ~1.2s después de entrar a la Home.
- Sale una sola vez por sesión (se recuerda con `sessionStorage`).
- Botón "×" chico para descartarla.
- Solo visible `<lg` (mobile/tablet) y solo en `/` y `/home`.

## Assets

- Imagen ya comprimida a **WebP 540×956, ~120 KB** desde el PNG original de 1.6 MB.
- Se subirá al CDN como `src/assets/mascot-chica.webp.asset.json` con `lovable-assets`.

## Carga limpia (sin flash)

1. `new Image()` → `img.src = mascotAsset.url`.
2. Cuando `img.decode()` resuelve **y** el evento `betspace:promo-starter-closed` ha ocurrido (o el fallback timer), recién montamos el nodo con `opacity:0`.
3. `requestAnimationFrame` → añadimos clase `mascot-enter` que hace: `translateY(24px) scale(.98) opacity:0` → `translateY(0) scale(1) opacity:1` en 600ms `cubic-bezier(.22,.9,.3,1)`.
4. Luego un idle sutil `mascot-float` (translateY ±4px, 5s loop).
5. Globito: aparece 220ms después con `bubble-pop` (scale .8 → 1 + fade).

Sin la imagen decodificada no se renderiza nada → cero flash / cero layout shift.

## Composición

```text
        ┌───────────────┐
        │   contenido    │
        │      ╭──────╮  │
        │      │¿Qué  │  │  ← bubble blanco 90% opac,
        │      │jug…? │  │    borde morado, colita
        │      ╰────╮─╯  │
        │          ╭─╮   │  ← chica, right-2, h ~46vh
        │          │ │   │
        ├──────────┴─┴──┤
        │ ▓▓ Bottom Nav │  ← z-30 (queda encima)
        └───────────────┘
```

- Wrapper: `fixed bottom-0 right-0 z-20 lg:hidden pointer-events-none`.
- Chica: `pointer-events-none`, altura `min(46vh, 420px)`, `right-1`, se recorta con el nav de forma natural (el nav es `z-30`).
- Botón cerrar: `pointer-events-auto`, arriba de la cabeza, discreto.
- Globo: `absolute`, `bg-white/92`, `border-2 border-purple-500`, `text-purple-900`, `rounded-2xl`, colita triangular hacia la chica.

## Cambios técnicos

1. **Nuevo asset** `src/assets/mascot-chica.webp.asset.json` (subido con `lovable-assets`, PNG local no se guarda).
2. **Nuevo componente** `src/components/MascotFloater.tsx`:
   - Solo mobile (`useIsMobile`).
   - Estado: `armed` (popup cerrado o fallback), `decoded`, `dismissed`.
   - Preload+decode al montar.
   - Escucha `window` evento `betspace:promo-starter-closed`.
   - `sessionStorage` key `betspace:mascot-shown`.
   - Portal a `document.body`.
3. **`src/components/PromoPopup.tsx`**: al cerrar (X, backdrop, click imagen antes de navegar) `window.dispatchEvent(new CustomEvent("betspace:promo-starter-closed"))`.
4. **`src/routes/-home-page.tsx`**: renderizar `<MascotFloater />` junto al `<PromoPopup />`.
5. **`src/styles.css`**: keyframes `mascot-enter`, `mascot-float`, `bubble-pop`.

## Fuera de alcance

- Versión desktop.
- CTA que navegue (solo cerrar por ahora).
- Cambios visuales al popup Starter salvo el `dispatchEvent`.
