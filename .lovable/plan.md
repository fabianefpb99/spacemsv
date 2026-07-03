1. Reorganizar el ticket flotante en `src/routes/deportes_.$matchId.tsx` para reducir altura:
   - Fila 1: Tu selección + cuota (sin cambios).
   - Fila 2: Campo de Apuesta a ancho completo (sin cambios).
   - Fila 3: Pago posible a la izquierda en caja compacta (~40 % del ancho) y botón “Apostar” a la derecha ancho (~60 % del ancho), ambos en la misma línea.
2. Reducir el padding inferior del cuerpo (`pb-96`) a un valor acorde a la nueva altura del ticket (por ejemplo `pb-72`), evitando que quede excesivo.
3. Verificar con `tsgo --noEmit` que no haya errores de tipos.
4. Capturar screenshots en modo oscuro y claro con Playwright para confirmar que el ticket queda más compacto, legible y sin solapamientos.
5. Investigar y corregir el hydration mismatch que aparece en la preview de `/deportes/arg-fra`: revisar si proviene de la página de detalle o de un componente compartido (uso de `Date.now()`, `Math.random()`, `typeof window`, etc.) y resolverlo para que la hidratación de React sea estable.