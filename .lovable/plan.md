## Problema

Actualmente la animación `match-view-enter` / `match-view-leave` se aplica al contenedor raíz de la vista de partido, que también incluye el `<header>`. Esto hace que el header se deslice junto con el resto, dando la sensación de que se monta encima del header de `/deportes` (que es idéntico).

## Solución

Mover la clase de animación del contenedor raíz al bloque de contenido que va DEBAJO del header — el `<div className="theme-dark-fixed relative flex-1 overflow-hidden ...">` (línea ~310 de `src/routes/deportes_.$matchId.tsx`), que ya envuelve el fondo del estadio, el bloque de equipos, cuotas, y el pie de apuesta.

### Cambios concretos en `src/routes/deportes_.$matchId.tsx`

1. Quitar `${leaving ? "match-view-leave" : "match-view-enter"}` del `<div className="min-h-screen bg-[#060210] text-white">` raíz.
2. Añadir esa misma expresión al `<div className="theme-dark-fixed relative flex-1 overflow-hidden bg-[#060210] px-4 pb-36 pt-4 sm:px-5">`.
3. El `handleBack` y el estado `leaving` no cambian: la flecha sigue disparando el slide-out de la sección y navegando tras 240 ms.

### Resultado

- El header queda fijo y visualmente continuo entre `/deportes` y la vista de partido.
- Solo el contenido (fondo del estadio + módulos) se desliza de derecha a izquierda al entrar, y de izquierda a derecha al volver.
- Se mantiene el fade-in de la imagen de fondo, porque forma parte del contenedor animado.

Sin cambios en `src/styles.css` ni en otros componentes.