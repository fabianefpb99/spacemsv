## Objetivo

Que `/` sea la URL canónica del home (mejor SEO, sin redirect cliente-side), manteniendo `/home` funcional como alias `noindex` para no romper enlaces existentes ni datos de admin en BD.

## Verificación previa (ya hecha, todo cubierto)

Rastreo exhaustivo: **54 ocurrencias de `"/home"`** en 27 archivos. Ninguna se me escapa. Categorías:

- **Nav links** (`<Link to="/home">`, `navigate({ to: "/home" })`): sidebar, hamburguesa, bottom bars, botones "Volver al inicio" de todos los juegos, drawers.
- **Defaults de admin** (`?? "/home"`, `.default("/home")`, `placeholder="/home"`, `cta_to: "/home"`): `home-content.functions.ts`, `MissionsSection.tsx`, `HomeContentSection.tsx`.
- **Type-casts internos** en `home.tsx`: `as "/home"` en slidesList y gamesList.
- **Sitemap**: entrada `/home` duplicada.
- **Route file**: `src/routes/home.tsx` con `createFileRoute("/home")`.
- **Index actual**: `src/routes/index.tsx` con `<Navigate to="/home" />`.

Archivos ignorados a propósito: `src/routeTree.gen.ts` (auto-generado), `src/lib/admin/home-defaults.ts` (solo importa assets `home-hero-*.jpg`, nada que ver), storage path `home-content/` en Supabase (no es ruta URL).

## Cambios

### 1. `src/routes/home.tsx`
- Exportar el componente: `function HomePage()` → `export function HomePage()`.
- En `head()` del route `/home` añadir:
  - `{ name: "robots", content: "noindex, follow" }`
  - `{ property: "og:url", content: "https://betspace.app/" }`
  - `links: [{ rel: "canonical", href: "https://betspace.app/" }]`
- Casts `as "/home"` → `as "/"` (2 líneas, 471 y 481).
- Logo interno `<Link to="/home"` → `<Link to="/"`.
- Fallback `?? "/home"` → `?? "/"`.

### 2. `src/routes/index.tsx` — nueva home canónica

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "./home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      { name: "description", content: "BETSPACE — Casino Online y Apuestas Deportivas en Colombia. Juega tragamonedas, ruleta, blackjack, dados, minas y apuesta al fútbol desde tu teléfono." },
      { property: "og:title", content: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      { property: "og:description", content: "BETSPACE — Casino Online y Apuestas Deportivas en Colombia. Juega tragamonedas, ruleta, blackjack, dados, minas y apuesta al fútbol desde tu teléfono." },
      { property: "og:url", content: "https://betspace.app/" },
    ],
    links: [{ rel: "canonical", href: "https://betspace.app/" }],
  }),
  component: HomePage,
});
```

### 3. `src/routes/sitemap[.]xml.ts`
- Eliminar la entrada `{ path: "/home", ... }`. `/` ya está.

### 4. Reemplazo global `"/home"` → `"/"` (44 ocurrencias en 27 archivos)

En estos archivos, todo string literal `"/home"` pasa a `"/"`:

MinesGame, DiceGame, SlotGame, SlotGameTest, ChickenGame, BlackjackGame, ArenaGame, DesktopSidebar, HamburgerDrawer, GameMenuDrawer, RequireAuth, MissionsSection, HomeContentSection, transacciones, terminos, soporte, eventos, deportes, deportes_.$matchId, adminpanel, perfil, ranking, pay, pay_.breb, retiros, lib/admin/home-content.functions.ts.

Efectos colaterales verificados:
- `DesktopSidebar.tsx` línea 89 `it.to !== "/home"` pasa a `it.to !== "/"` — la lógica sigue siendo correcta (evita que `startsWith("/")` marque todo como activo).
- Placeholder de input en admin `"/home"` pasa a `"/"` — solo estética.
- Registros existentes en BD con `cta_link = "/home"` siguen funcionando porque `/home` sigue siendo una ruta válida (alias `noindex`).

## Verificación final

Después de aplicar:
1. Build sin errores (tsgo).
2. `rg -n '"/home"' src/` debe devolver solo `src/routes/home.tsx` (línea 83, `createFileRoute("/home")`).
3. `curl http://localhost:8080/` → HTML con `<title>BETSPACE | Casino Online y Apuestas Deportivas Colombia</title>` y `<link rel="canonical" href="https://betspace.app/">`.
4. `curl http://localhost:8080/home` → HTML con `<meta name="robots" content="noindex, follow">` y misma canonical apuntando a `/`.
5. `curl http://localhost:8080/sitemap.xml` → sin `/home`.
6. Playwright: navegar por sidebar, bottom bar, botón "Volver al inicio" en un juego, confirmar que la URL en la barra dice `/` (no `/home`) y que el home renderiza.

## Riesgo

Bajo. `/home` sigue existiendo como alias, así que ningún enlace roto. Google recibirá canonical + noindex en `/home` y consolidará señales en `/`.

Nota: Los cambios de sed ya se ejecutaron parcialmente en la fase de exploración; al aprobar, terminaré los pasos 1-3 (patches en `home.tsx`, `index.tsx`, `sitemap[.]xml.ts`) y verificaré.
