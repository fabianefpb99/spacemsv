Plan de corrección para `/slotsamurai`

Objetivo: corregir únicamente layout/distribución visual de Samurai Legend para que en móvil 390×844 todo quede en una sola vista, sin scroll vertical, siguiendo el boceto `BOCETO-3.png`. No tocaré lógica, RTP, pagos, seguridad, balance, validaciones, backend, admin ni el header BETSPACE.

Cambios concretos:

1. Eliminar la causa real del scroll
- Cambiar el contenedor del juego de altura mínima a altura fija de viewport: `h-[100dvh] overflow-hidden`.
- Quitar el crecimiento vertical innecesario del wrapper interno (`min-h-[100dvh]`) y convertirlo en layout compacto con altura controlada.
- Reducir padding vertical global del juego; el header queda visualmente igual, pero el resto no seguirá empujando el documento.

2. Compactar el módulo de reels verticalmente
- Reducir `TILE_H` de `108` a un valor móvil más compacto, aprox. `82–88px`, para que las 3 filas no ocupen 324px.
- Mantener 5×3 y la misma lógica de reels; solo cambia la caja visual.
- Aumentar el tamaño visual de los íconos dentro de cada celda para que no se vean “perdidos” en filas altas.
- Quitar padding superior interno del frame (`pt-3`) y reducir padding del marco de reels para cerrar el espacio entre borde e íconos.
- Resultado esperado: las filas quedan mucho más juntas, sin el espacio vacío que se ve en tus imágenes de error.

3. Rebalancear alturas como el boceto
- Logo/hero Samurai más bajo y más integrado: mantener presencia del logo, pero sin consumir 104px fijos si no hay evento.
- Reels inmediatamente debajo del logo, con margen mínimo.
- Paytable más baja: cards más compactas, menos padding y símbolos más pequeños si hace falta.
- Panel de apuesta más bajo: reducir alturas de botones `- / +`, quick bets, `AUTO` y padding, manteniendo el HUD funcional.
- Últimas ganancias más compacto: altura reducida, sin esconderse bajo el viewport.

4. Validación obligatoria antes de terminar
- Medir en preview móvil 390×844:
  - `document.documentElement.scrollHeight <= window.innerHeight`
  - ningún bloque queda escondido abajo
  - reels, paytable, apuestas y últimas ganancias visibles en una sola pantalla
- Comparar visualmente contra `BOCETO-3.png`: composición vertical completa, sin scroll, sin grandes huecos entre filas.

Archivos a tocar:
- `src/components/SlotSamuraiGame.tsx` solamente.

Archivos/partes que NO tocaré:
- Header BETSPACE como estructura/función.
- HUD de balance y autenticación.
- Funciones server, shared RTP, validaciones, pagos, balance, seguridad.
- Admin y rutas.