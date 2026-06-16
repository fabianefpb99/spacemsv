## Cambios en `src/styles.css` (modo claro)

### 1. Banner promocional — Opción B: gradiente con muchas paradas
Reemplazar el `.promo-banner__scrim` actual por un degradado de 9–10 stops con caída muy gradual, empezando con menos opacidad para no apagar la imagen y terminando suavemente sin "corte blanco":

```text
linear-gradient(90deg,
  #ffffff 0%,
  rgba(255,255,255,0.88) 14%,
  rgba(255,255,255,0.74) 24%,
  rgba(255,255,255,0.58) 34%,
  rgba(255,255,255,0.42) 44%,
  rgba(255,255,255,0.28) 54%,
  rgba(255,255,255,0.16) 64%,
  rgba(255,255,255,0.07) 72%,
  rgba(255,255,255,0.02) 80%,
  rgba(255,255,255,0) 88%
)
```
Resultado: texto legible a la izquierda, imagen conserva color/brillo, transición imperceptible (sin línea blanca visible).

### 2. Sombra flotante en todos los módulos del Home
Añadir/ajustar token y aplicarlo a las tarjetas principales del home (banners promo, secciones de juegos, tarjetas de torneos, etc.) solo en modo claro:

```text
--shadow-float: 0 1px 2px rgba(16,24,40,0.04),
                0 8px 24px -8px rgba(16,24,40,0.10);
```
Aplicado a: `.promo-banner`, contenedores de módulos del home (cards de secciones). Sin borde duro, sensación premium y minimalista. En modo oscuro se mantiene la sombra actual.

### 3. Botón flecha (chevron) sólido blanco
`.promo-banner__chev` en modo claro:
- `background: #FFFFFF` (sólido, sin transparencia)
- `border: 1px solid rgba(16,24,40,0.08)` (en vez de borde morado fuerte)
- `box-shadow: 0 2px 6px rgba(16,24,40,0.12), 0 1px 2px rgba(16,24,40,0.06)`
- Icono flecha mantiene color morado `#7C3AED`
- `z-index: 2` para asegurar que queda sobre la imagen

Resultado: la flecha se ve siempre, incluso sobre las zonas más brillantes de la imagen del juego.

## Archivos a modificar
- `src/styles.css` (único archivo)

## Fuera de alcance
- No se tocan imágenes, layout, ni `home.tsx`.
- Modo oscuro intacto.