## Home de Deportes — /deportes

Nueva ruta `src/routes/deportes.tsx` con el mismo Header (logo, balance, settings, campana, hamburguesa) y menú inferior de BETSPACE que ya usan `home.tsx` / `eventos.tsx`. Solo se diseña el contenido central; header y bottom nav se reutilizan sin modificarlos.

### Estructura visual (mobile-first, identidad BETSPACE)

```text
[ Header BETSPACE existente ]

[ Selector blanco redondeado ]
  ⚽ FÚTBOL   |   🏆 MUNDIAL 2026
  (dos chips/tabs, ambos activos visualmente, sin lógica real todavía)

[ Banner Mundial 2026 ]
  - Imagen hero (estadio + trofeo) generada con el mismo lenguaje que eventos-hero
  - Badge morado "ZONA DEPORTIVA"
  - H1: "MUNDIAL 2026"
  - Línea acento morada
  - Subtítulo: "Los mejores partidos del mundo, en un solo lugar."

[ Sección "PARTIDOS DESTACADOS" ]
  - Título en la tipografía display de BETSPACE
  - SIN "Ver todos" (siguiendo la regla ya aplicada en Juegos Destacados)

[ 2 tarjetas de partido, clickeables completas ]
  Cada tarjeta:
    - Chip "MUNDIAL 2026"
    - Fecha (📅 Hoy, 20 Jun) + hora (🕒 15:00) + chip "EN VIVO" cuando aplique
    - Estrella favorito (solo visual, sin lógica)
    - Fila equipos:  [Bandera] Nombre   VS   Nombre [Bandera]
    - Bloque "1X2 - RESULTADO FINAL" con tres botones de cuota (1 / X / 2)
  Partidos hardcodeados por ahora:
    1) Argentina vs Francia — 15:00 — 2.10 / 3.25 / 3.40
    2) Brasil vs Alemania   — 19:00 — 1.85 / 3.60 / 4.20

[ Aviso inferior ]
  Icono trofeo + "Las cuotas pueden cambiar en cualquier momento. Apuesta responsablemente."

[ Bottom nav BETSPACE existente ] (Inicio activo, no se cambia)
```

### Navegación

- Cada tarjeta es un `<Link>` a `/deportes/$matchId` (aún no se crea la ruta de detalle — se hará en un siguiente turno). Por ahora el link puede apuntar a `/deportes` con `#` o dejar el href listo pero deshabilitado visualmente hasta que se construya la vista de detalle. Confirmar preferencia si aplica.
- Añadir entrada "Deportes" donde corresponda (drawer hamburguesa) solo si ya existen otras secciones ahí; no tocar el bottom nav.

### SEO / head

- `title`: "Apuestas Deportivas Mundial 2026 — BETSPACE"
- `description`: "Apuesta en los partidos del Mundial 2026 desde BETSPACE. Cuotas claras, experiencia simple."
- `og:title`, `og:description` equivalentes. Sin `og:image` (no leaf con hero cover propio verificado).
- H1 único: "Apuestas Deportivas — Mundial 2026" (visualmente el banner cumple; se puede usar `sr-only` si el banner ya muestra "MUNDIAL 2026" como H1 visible, evitando dos H1).

### Assets

- Generar 1 imagen hero del Mundial 2026 (estadio + trofeo, paleta morada/negra BETSPACE) vía imagegen y guardarla como asset CDN.
- Banderas: usar emojis 🇦🇷 🇫🇷 🇧🇷 🇩🇪 o SVGs simples ya presentes; sin dependencias nuevas.

### Estilos

- Reutilizar tokens semánticos existentes (`--primary`, gradientes morados, sombras "elegant") y clases de `src/styles.css`.
- Respetar reglas de tema: no romper subárboles fijos oscuros; esta pantalla sigue el tema global (claro/oscuro) igual que `/home`.

### Seguridad (prevención proactiva)

Este primer paso es 100% frontend/presentacional con datos hardcodeados: no se crean tablas, RLS, edge functions ni server functions, así que no hay superficie nueva que proteger. Reglas que dejamos ya listas para cuando lleguen datos reales de apuestas en pasos siguientes:

- Cualquier tabla futura (`sports_events`, `sports_markets`, `sports_bets`, etc.) se creará con `GRANT` explícitos + `ENABLE ROW LEVEL SECURITY` + políticas por `auth.uid()` en la misma migración.
- Lecturas públicas (catálogo de partidos/cuotas) sólo con policy `TO anon` de `SELECT`; escrituras (apostar) sólo desde server functions con `requireSupabaseAuth` que además validen saldo del lado servidor — nunca confiar en el cliente.
- Cuotas y validación de resultado se resolverán server-side; el cliente sólo mostrará precios y no calculará pagos.
- Roles (admin de deportes, si aplica) siempre en tabla `user_roles` + `has_role()` (regla ya establecida en el proyecto), nunca en `profiles`.
- Rutas de administración de partidos irían bajo `_authenticated/` + gate de rol, y no expuestas en el menú público.

### Archivos a crear/editar

- Crear `src/routes/deportes.tsx` (ruta + componente, head, layout completo).
- Crear asset hero del Mundial 2026 en `src/assets/` (+ `.asset.json`).
- Actualizar `src/routes/sitemap[.]xml.ts` para incluir `/deportes`.
- No se toca `home.tsx`, header, bottom nav ni estilos globales existentes (solo se añaden clases scoped si son necesarias).

### Fuera de alcance (siguiente turno)

- Vista de detalle del partido (`/deportes/$matchId`) con mercados completos, boleta y confirmación de apuesta.
- Backend de deportes (tablas, cuotas dinámicas, liquidación, saldo).
