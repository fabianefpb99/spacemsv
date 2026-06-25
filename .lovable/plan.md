# Rediseño de cards en "Juegos Destacados"

Solo cambio visual. No se toca: scroll horizontal, drag, queries, datos, tags ni routing.

## Cambios en `src/routes/home.tsx` (cards dentro del scroll, líneas ~742-772)

1. **Card como contenedor de imagen full-bleed**
   - Cambiar `aspect-square` (cuadrado) → relación más alta tipo póster (`aspect-[3/4]`) para mantener proporción del ejemplo (imagen vertical).
   - Eliminar el wrapper de texto inferior (`<div className="flex min-h-[42px]...">`) y el sub-bloque de imagen separado.
   - La `<Link>` pasa a ser `relative` con `overflow-hidden`, y dentro:
     - `SkeletonImage` ocupa `absolute inset-0 h-full w-full object-cover`.
     - Capa de degradado inferior `absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/55 to-transparent` para que el texto sea legible sin tapar la ilustración.
     - Contenedor de texto `absolute inset-x-0 bottom-0 px-2 pb-2 pt-6 text-center` con sangrado (padding) para que el título y tag nunca toquen los bordes.

2. **Título sobre la imagen, ligeramente debajo de la mitad**
   - Mismo texto (`gameName`), tipografía display, blanco, `font-black uppercase`, tamaño responsivo (`text-[10px] sm:text-xs`), `drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]` para contraste.
   - Posicionado dentro del bloque inferior (queda ~55-60% bajando desde arriba gracias al `pt-6` + gradiente).

3. **Tag (NUEVO/POPULAR/VIP/etc.)**
   - Se mantiene debajo del título, con las mismas clases de color por variante (`g.tagCls`), pero `px-2 py-0.5 text-[8px]`, sangrado garantizado por el padding del contenedor.

4. **Bordes y sombra de la card**
   - Conservar `rounded-xl` y el borde fucsia ya existente (regla actual en modo oscuro). Sin cambios funcionales en clases globales.

5. **Modo claro**
   - El degradado oscuro y texto blanco son fijos dentro de la card (independiente del tema), lo que asegura legibilidad en ambos modos sin tocar reglas de `theme-dark-fixed` ni styles.css.

## Lo que NO se toca

- `featuredScrollRef`, drag handlers, `home-featured-scroll`, ancho de cada card (`w-[22%] min-w-[22%]`).
- Queries, caching, `gamesList`, `formatGameTag`, mapeo de tag colors.
- Banners de BlackJack/Ruleta y resto del home.
- Imágenes/SVGs/lógica de juegos.

## Verificación

- Build/typecheck automático.
- Vista en preview móvil (390px) confirmando: imagen full-bleed, título sobre imagen ligeramente debajo del centro, tag debajo, padding visible en los 4 lados del texto, scroll horizontal funciona igual.
