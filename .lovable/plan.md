# Plan: Nueva ruta `/games`

## Objetivo
Crear una vista dedicada `/games` con el catálogo completo de juegos del casino, reutilizando datos reales del proyecto y agregando 3 tarjetas "PRÓXIMAMENTE" para llenar el grid, sin tocar rutas ni lógica existente.

## Alcance (qué se toca / qué NO)

**Se crea nuevo:**
- `src/routes/games.tsx` — ruta con head SEO propio.
- `src/routes/-games-page.tsx` — componente de la vista.
- `src/components/games/GameCard.tsx` — tarjeta reutilizable (imagen, título, badge, estrella favorito).
- `src/components/games/CategoryPill.tsx` — chip de categoría.
- `src/components/games/FiltersSheet.tsx` — panel de filtros (drawer).
- `src/lib/games/catalog.ts` — fuente única del catálogo (juegos reales + próximamente).

**NO se toca:** home, rutas de juegos, lógica de spins, favoritos server-side, header/hamburguesa (excepto agregar link a "Juegos").

## Catálogo (juegos reales del proyecto)
Tomados directamente de las rutas existentes con sus assets ya importados en el home:

| Slug | Nombre | Categoría | Badge | Ruta |
|---|---|---|---|---|
| spaceman | SPACEMAN | Crash | POPULAR | /spaceman |
| slot_mafia | MAFIA ROYALE | Tragamonedas | POPULAR | /slot |
| slot_samurai | SAMURAI LEGEND | Tragamonedas | NUEVO | /slotsamurai |
| ruleta | RULETA | Mesa | POPULAR | /ruleta |
| blackjack | BLACKJACK | Mesa | POPULAR | /blackjack |
| blackjack_vip | BLACKJACK VIP | Mesa | VIP | /blackjackvip |
| dados | DADOS | Mesa | — | /dados |
| mines | MINAS | Casino | POPULAR | /mines |
| chicken | CHICKEN ROAD | Crash | NUEVO | /chicken |
| arena | ARENA | Casino | — | /arena |
| deportes | DEPORTES | Deportes | — | /deportes |

**Próximamente (3 fillers, no navegan):**
- AVIATOR (Crash)
- SWEET BONANZA (Tragamonedas)
- FIRE PORTALS (Tragamonedas)

Se renderizan atenuados (opacity 60, sin link, badge PRÓXIMAMENTE morado suave).

## Estructura de la vista

```text
[Header global BETSPACE]  ← reutilizado, sin cambios
[Buscador "Buscar juegos..."]
[Categorías scroll horizontal: Todos | Crash | Casino | Tragamonedas | Mesa | Deportes]
[Barra: Filtros | Selector orden (Populares/Nuevos/A-Z) | Grid ↔ Lista]
[Grid 3 columnas móvil / 4-6 desktop]
```

## Filtros (drawer lateral con badge de conteo)
- **Solo favoritos** (checkbox) — consume `getMyFavoriteGames` existente si hay sesión.
- **Solo nuevos** (checkbox)
- **Ocultar próximamente** (checkbox, ON por defecto = false para mostrarlos)

Contador de badge = filtros activos.

## Ordenamiento
- Más populares (orden manual del catálogo)
- Más nuevos (badge NUEVO primero)
- A–Z (alfabético)

## Estilo visual
- Fondo negro / gradiente sutil morado.
- Tarjetas con `rounded-2xl`, borde `border-white/5`, sombra suave.
- Badges: POPULAR (morado), NUEVO (verde esmeralda), VIP (dorado), MESA (gris-morado), PRÓXIMAMENTE (morado translúcido).
- Estrella de favorito arriba a la derecha (visual only por ahora, guarda en `localStorage`).
- Responsive: `grid-cols-3 sm:grid-cols-4 lg:grid-cols-5`.
- Tokens semánticos existentes (nada de `bg-black`/`text-white` crudo).

## Acceso a la vista
- Agregar link "Juegos" en `HamburgerDrawer.tsx` apuntando a `/games` (no altera diseño, solo un item más).
- No se toca el bottom nav (no existe uno global aún; el mockup lo sugiere pero queda fuera de scope para no romper nada).

## Reglas de calidad
- Componentes pequeños y aislados.
- Sin duplicar lógica: assets y nombres importados una sola vez desde `catalog.ts`.
- SEO: `head()` con título y descripción propias, `robots: noindex, follow` (coherente con `/home`).
- Sin hardcodear colores.
- Tipado estricto.

## Detalles técnicos
- Ruta con `createFileRoute('/games')`, sin loader (data estática + hook de favoritos client-side).
- `useMemo` para filtrado/orden.
- `useLocalStorage` pattern inline para favoritos visuales.
- Búsqueda: `includes` case-insensitive contra `name` y `slug`.
