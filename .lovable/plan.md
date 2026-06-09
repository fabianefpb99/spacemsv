
Voy a entregarlo en 4 bloques bien separados, todo dentro del panel admin actual y sin tocar la experiencia de jugadores no-admin.

## 1. Campanita 🔔 en el header (solo admin)

- Aparece **solo si el usuario tiene rol admin**, justo a la izquierda de la tuerca (Settings).
- Badge rojo con número de no-leídas; al hacer clic abre un panel desplegable limpio con tabs:
  - **Todas** · **Recargas** · **Usuarios** · **Juegos en rojo**
- Cada item: icono + título + descripción corta + tiempo relativo ("hace 2 min") + link directo al detalle dentro de `/adminpanel`.
- Acciones: "Marcar como leída" (click) y "Marcar todas".
- **Realtime** vía Supabase Realtime → llegan al instante sin recargar.
- Sonido sutil opcional (silenciable) cuando entra una nueva, solo si la pestaña está visible.
- Mismo componente sirve en móvil y desktop (popover bien posicionado, max-width responsive).

## 2. Generación de notificaciones

Tres fuentes, todas server-side, sin cargar al cliente:

| Tipo | Cuándo se crea |
|---|---|
| `new_user` | Trigger en `profiles` al insertar (o en `auth.users` vía función) |
| `recharge_request` | Trigger en `deposit_requests` al insertar con estado pendiente |
| `game_red_alert` | Job que revisa cada juego: si después de ≥ 2 apuestas en una ventana corta, el balance neto del casino es negativo, dispara una alerta (con cooldown para no spamear) |

Todo va a una tabla nueva `admin_notifications` con RLS estricta (solo admins pueden leer).

## 3. Detección de "juego en rojo"

- Función SQL `detect_games_in_red()` que mira `game_bets` / `arena_rounds` de los últimos N minutos (configurable, default 30 min).
- Por cada juego con ≥ 2 apuestas, calcula `payout_total - bet_total`. Si es positivo (jugadores ganando), se considera "en rojo para el casino".
- Si supera un umbral configurable (default: pérdida > $5.000 COP o > 3 apuestas perdedoras seguidas para el casino), inserta una notificación tipo `game_red_alert` con cooldown de 15 min por juego para no duplicar.
- Se ejecuta vía pg_cron cada 2 minutos.
- En el panel además mostraremos una **insignia roja** sobre la tarjeta del juego en la sección RTP cuando esté en rojo, para que veas el contexto inmediato.

## 4. Editor de Slider del Home (panel admin)

Nueva sección "Contenido Home" en el sidebar admin, con dos pestañas:

### Pestaña "Slider Hero"
- Lista de slides reorderable (drag o flechas ↑↓).
- Cada slide: imagen (subida a Storage), eyebrow, título, descripción, texto del botón, link destino (selector con las rutas del sitio + opción custom).
- Activar/Desactivar cada slide sin borrarlo.
- Vista previa en vivo del slide tal como se verá en mobile.
- Botón "Restaurar slides por defecto" como red de seguridad.

### Pestaña "Juegos Destacados"
- Los 4 juegos del grid `Juegos destacados`.
- Cada uno: imagen, nombre, tag ("POPULAR", "NUEVO", "CLÁSICO"…), color del tag, ruta destino.
- Reordenar y activar/desactivar.
- Soporta más de 4 si en el futuro queremos ampliar la grilla.

El `Home` lee los slides y juegos desde la BD vía server function pública (con caché). Si la BD está vacía o falla, **fallback a los actuales hardcoded** para que nunca se quede en blanco.

## Detalles técnicos

- **Tablas nuevas**: `admin_notifications`, `home_slides`, `home_featured_games`, `game_red_state` (para el cooldown).
- **Server functions**: `listAdminNotifications`, `markNotificationRead`, `markAllRead`, `adminListHomeSlides`, `adminUpsertHomeSlide`, `adminDeleteHomeSlide`, `adminReorderHomeSlides` (y equivalentes para featured games), `getHomeSlidesPublic`, `getFeaturedGamesPublic`.
- **Storage**: bucket público `home-content` para imágenes del slider/juegos.
- **Realtime**: subscripción a `admin_notifications` solo cuando el usuario es admin.
- **Seguridad**: RLS estricta — solo `has_role(auth.uid(), 'admin')` puede leer/escribir `admin_notifications`, `home_slides`, `home_featured_games`. Lectura pública de slides y featured games por server fn admin-elevada (no policy `anon`).
- **No tocaré** la UI de jugadores excepto: agregar la campanita oculta para no-admin, y leer slider/featured desde la BD con fallback.

¿Confirmas y arranco? Si quieres ajustar algo (por ejemplo el umbral de "juego en rojo" o el sonido), dímelo antes y lo dejo cocinado en el primer pase.
