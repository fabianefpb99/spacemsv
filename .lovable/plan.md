Plan de implementación para el banner de Samurai Legend

Objetivo
Antes del primer giro, el logo "SAMURAI LEGEND" debe ocupar todo el espacio del banner superior, eliminando los logos de WIN/BIG WIN/SUPER WIN/MEGA WIN. Cuando el usuario realiza el primer giro, el logo vuelve a su tamaño/posición actual y el espacio inferior queda disponible para mostrar los logos de victoria cuando corresponda.

Ámbito
Cambio exclusivo en el componente de presentación del juego. No se toca lógica de apuestas, saldo ni servidor.

Archivo a modificar
- src/components/SlotSamuraiGame.tsx — componente SamuraiHero (líneas aprox. 1592–1734).

Cambios concretos

1. Estado de transición
   - El componente ya usa showPreview para detectar si no se ha girado ni ganado. Se aprovecha esa misma variable para decidir el modo del banner.

2. Modo "pre-spin" (showPreview === true)
   - Logo SAMURAI LEGEND aumentado de altura (por ejemplo 200–220 px) para ocupar el área completa del banner superior.
   - No se renderiza la fila de preview de WIN/BIG WIN/SUPER WIN/MEGA WIN.
   - El contenedor del banner se ajusta para centrar el logo verticalmente sin espacio reservado inferior.

3. Modo "post-spin" (showPreview === false)
   - Logo vuelve a su altura actual (124 px) y posición superior.
   - Se conserva el área inferior de 104 px para mostrar el logo de WIN correspondiente cuando haya una victoria.
   - Se mantiene el comportamiento actual de mostrar el logo de la tier ganadora (win/big/mega/super/jackpot) y el monto.

4. Transición
   - Se agrega una transición suave de transform/height/opacity (~0.35–0.45 s) para que el cambio de logo grande a logo normal no sea brusco cuando el usuario dispara el primer giro.

5. Responsivo móvil
   - Se verifica que en viewport 390 px de ancho el logo grande no se corte ni se superponga con elementos del HUD superior.
   - Si es necesario, se ajusta max-width y padding en modo pre-spin.

Verificación
- Revisar en preview local que antes de girar solo se vea el logo grande.
- Girar y confirmar que el logo se reduce y el área de WIN funciona con una victoria.
- No se espera cambios en SEO, rutas ni meta tags.