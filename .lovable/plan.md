## Problema

El bloque override actual en `src/styles.css` (líneas 2997–3046) sólo re-define un puñado de clases (`text-white`, `text-purple-*`, `bg-[#0c0620]`, etc.). No cubre los gradientes (`from-[#1a0b3a]`, `bg-gradient-to-r`, etc.), ni los colores de los headers de rango (BRONCE/PLATA), ni varias clases que el modo claro global desatura. Resultado: el `/vip` queda en un híbrido — textos pálidos, headers desteñidos y fondos morados claros.

## Solución

Usar el mismo patrón ya probado en `/mis-recargas`, `/transacciones` y los modales de auth: la clase `.theme-dark-fixed`. Ese bloque (líneas 28–62) ya reasigna **todas** las variables de tema, fondos, textos y superficies a su versión oscura para cualquier descendiente. Es la forma garantizada de forzar modo oscuro sin parches clase-por-clase.

### Cambios

1. **`src/routes/vip.tsx`**
   - Añadir la clase `theme-dark-fixed` al `div` raíz junto a `vip-page`:
     ```
     className="vip-page theme-dark-fixed min-h-screen bg-[#060210] text-white"
     ```

2. **`src/styles.css`**
   - Eliminar el bloque override de las líneas 2997–3046 (ya no hace falta).
   - Eliminar las exclusiones `:not(.vip-page):not(.vip-page *)` y `:not(.vip-page *)` añadidas en las reglas de modo claro (líneas 23, 453, 460, 464, 492, 498, 937, 941, 945–946, 950, 954). Con `theme-dark-fixed` aplicado al root del VIP, esas reglas ya no afectan al subtree y las exclusiones se vuelven ruido.

### Resultado esperado

- Header card "TU RANGO ACTUAL / MAESTRO III" con fondo morado oscuro sólido, borde brillante e iconos vivos como en modo oscuro.
- Headers BRONCE / PLATA con su gradiente completo y texto blanco.
- Sub-rangos (Bronce V, IV…) con su color ámbar/morado original, sin desaturar.
- Fondo `#060210` plano en toda la página.

No se toca lógica, ni `/perfil`, ni los componentes compartidos (`VipBadge`, `VipCard`, `VipRewardChip`) en otras rutas: siguen respetando modo claro fuera del VIP.
