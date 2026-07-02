
## Objetivo

Corregir únicamente la composición de la parte superior de `/deportes` para que coincida con el boceto: banner del Mundial de ancho completo (como el slider del Home del casino) y selector `FÚTBOL | MUNDIAL 2026` flotando a caballo sobre el borde inferior del banner (≈50% dentro / 50% fuera).

No se toca: Header, bottom nav, tarjetas de partidos, aviso responsable, identidad visual, datos ni cuotas.

## Cambios en `src/routes/deportes.tsx`

1. **Sacar el banner del contenedor con padding**
   - Hoy el banner vive dentro de `<div class="... px-3 ... max-w-md ...">`, por eso queda como tarjeta con márgenes.
   - Reestructurar el layout así:
     ```
     <div bg-[#060210]>
       <div max-w-md mx-auto>            ← contenedor visual
         <Header />                      (con -mx del padding solo del header como hoy)
         <section banner full-width>     (ancho = ancho del contenedor, sin px, sin border, sin rounded, sin margin lateral)
         <div px-3 sm:px-4 pb-28>        ← contenido con padding
           <Selector flotante />          (−mt para superponerse ~50% al banner)
           <Partidos destacados />
           <Aviso />
         </div>
       </div>
       <BottomNav />
     </div>
     ```
   - El banner ya no lleva `rounded-2xl`, `border`, ni `shadow` de tarjeta; ocupa el 100% del ancho del contenedor `max-w-md` (mismo comportamiento visual que el slider del Home).
   - Mantener altura actual (`h-44 sm:h-52`), imagen `mundialHeroAsset`, gradiente, badge "ZONA DEPORTIVA", H1 "MUNDIAL 2026", subrayado y copy — sin cambios de contenido.

2. **Selector flotante superpuesto**
   - Mover el bloque del selector debajo del banner.
   - Aplicar `-mt-10` (aprox) + `relative z-10` para que quede ~50% sobre el banner y ~50% fuera.
   - Conservar estilos actuales (fondo `#0c0620`, borde morado, chip activo con degradado fucsia).
   - Añadir un poco más de sombra (`shadow-[0_10px_30px_-10px_rgba(168,85,247,0.55)]`) para reforzar el efecto de tarjeta flotante.

3. **Icono de Fútbol en SVG (no emoji)**
   - Reemplazar el `⚽` por un componente `SoccerBallIcon` inline (SVG limpio: círculo blanco con pentágonos negros estilizados), tamaño `h-4 w-4`, `currentColor` para heredar el color del chip (blanco cuando activo, morado suave cuando inactivo).
   - El icono de `Mundial 2026` sigue siendo el `Trophy` de lucide.

4. **Orden final del JSX**
   ```
   Header
   Banner full-width (sin márgenes)
   Selector flotante (-mt superpuesto)
   Partidos destacados
   Aviso responsable
   ```

## Fuera de alcance

- No se modifica lógica, datos, cuotas, tarjetas de partidos, ni el bottom nav.
- No se crean rutas nuevas ni se toca backend (la vista detalle sigue pendiente para una fase posterior con `requireSupabaseAuth`, RLS y validación de balance en servidor).

## Verificación

- `tsgo` (typecheck).
- Playwright a 390×844: capturar screenshot para confirmar banner de extremo a extremo del contenedor, selector superpuesto sobre el borde inferior del banner y icono de fútbol SVG.
