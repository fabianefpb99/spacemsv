## Plan

1. **Hacer que el HOME arranque con el loader activo desde el primer render**
   - Cambiar el estado inicial de `showBrandLoader` para que sea `true`, no `false`.
   - Así el `BrandLoader` se monta en el HTML inicial del Home y no espera al `useEffect`, que hoy corre después de que ya se vio el Home por un instante.

2. **Eliminar las reglas que hacen que el loader se salte al volver o por cuota**
   - Quitar/ignorar la lógica de “máximo 2 veces por hora” y “home listo en sessionStorage” para el Home.
   - Mantener el alcance únicamente en el HOME; no tocar loaders de juegos, perfil, HUD, módulos ni navegación.

3. **Mantener la duración y comportamiento visual actual del loader**
   - Conservar `BrandLoader active={showBrandLoader} minMs={1900}` y su fade-out.
   - Solo ajustar cuándo aparece: debe aparecer primero, siempre, antes de que se vea el contenido del Home.

4. **Validar en móvil**
   - Verificar con navegador en viewport móvil que al entrar a `/` no se alcanza a ver el Home antes del loader.
   - Confirmar que después del fade-out el Home queda igual visualmente, sin mover estructura ni romper contenido.