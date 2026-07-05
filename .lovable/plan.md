## Cambios en `src/routes/deportes.tsx` — `MatchCard`

Solo tarjetas de partido del listado `/deportes`. No toco otros bloques.

### 1) Reducir un pelín la altura vertical

Sin tocar la fila de banderas ni sus tamaños (`h-9 w-[52px]`, nombres, VS). Recorto solo padding/margen del bloque de cuotas 1X2:

- Wrapper de cuotas: `mt-3 … p-2` → `mt-2 … p-1.5`
- Label "1X2 · Resultado final": `mb-1.5` → `mb-1`
- `OddChip`: `py-1.5` → `py-1`, `gap-0.5` (queda igual)
- Separador superior: `mt-2` → `mt-1.5`

Ahorro estimado ~8-10px por card, sin afectar banderas/nombres.

### 2) Fondo con imagen de estadio + morado con opacidad

Mismo patrón que la vista de detalle (`stadiumBg` + gradiente morado-negro), pero mucho más sutil dentro de cada card:

- Importar `stadiumBg from "@/assets/stadium-bg.jpg"` en `deportes.tsx` (import ya existe en el detalle, aquí falta).
- En `MatchCard`, cambiar el fondo actual `bg-[#0c0620]/90` a `bg-[#0c0620]/70` y agregar, como primer hijo dentro del `<Link>` (con `aria-hidden`, absolute, detrás del contenido):

```tsx
<div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden rounded-2xl">
  <img src={stadiumBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.18]" />
  <div className="absolute inset-0 bg-gradient-to-br from-[#0c0620]/85 via-[#150830]/80 to-[#0c0620]/90" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.22),transparent_70%)]" />
</div>
```

- Envolver el contenido existente en un `<div className="relative z-10">…</div>` para que quede por encima del fondo.
- El borde morado (`border-purple-500/30`), el hover fucsia y el shadow se mantienen igual.

Opacidad `0.18` es intencionalmente baja: se nota la textura del estadio detrás del morado sin quitarle protagonismo a banderas y cuotas.

### Qué NO se toca

- Colores/tamaños de banderas, nombres, VS, badges (competencia, hora, En vivo).
- Cuotas `text-fuchsia-200` y su glow.
- Layout general de `/deportes` (grid, filtros, header).
- Otras rutas.

### Verificación

- Mobile 390px y desktop: tarjetas ~10px más bajas, banderas idénticas.
- Se ve el estadio suavemente detrás del tinte morado, contraste de texto intacto en modo claro y oscuro (`theme-dark-fixed` sigue aplicando).
