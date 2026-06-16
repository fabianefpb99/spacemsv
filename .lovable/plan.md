# Rediseño Light Mode — Pantalla /perfil

Objetivo: que toda la pantalla `/perfil` se vea en modo claro como la imagen de referencia — tarjetas blancas, sombras suaves, borde sutil `#EAEAEA`, el morado únicamente como color de marca (textos, badge, botón principal, escudo VIP).

## Estrategia

El componente ya está envuelto en `.profile-page`. **No tocamos el JSX** (mantenemos modo oscuro intacto) — todos los cambios se hacen en `src/styles.css` bajo el selector `html.light .profile-page …`, sobrescribiendo los estilos morados/oscuros sólo en modo claro. Esto evita romper el dark mode y mantiene el código de la página limpio.

## Sistema de tarjeta (token reutilizable)

Definimos un "card style" único que aplicaremos a todas las tarjetas para garantizar consistencia visual:

```text
fondo:    #ffffff
borde:    1px solid #EAEAEA
radio:    16px (rounded-2xl)
sombra:   0 1px 2px rgba(16,24,40,.04), 0 4px 12px rgba(16,24,40,.06)
sin gradientes, sin glow morado, sin ring
```

## Cambios por sección (todos en `src/styles.css`)

1. **Wrapper de página** — fondo blanco puro (`#ffffff`), texto base `#1a1033`.
2. **Header "MI PERFIL"** — fondo blanco, título morado marca, borde inferior `#EAEAEA`, iconos morado oscuro.
3. **Tarjeta de identidad** (`.vip-frame` + `.vip-frame-inner`) — eliminar el marco HUD morado y el `clip-path`, convertir en card blanca estándar. Mantener avatar (con un anillo morado fino), nombre en morado marca, escudo VIP tal cual (sigue destacando).
4. **Barra VIP** (`.profile-vip-progress`) — card blanca, sin gradiente de fondo, sin glow; track de progreso `#F1ECFB`, relleno en gradiente morado de marca; "Ver VIP →" en morado.
5. **Balances** (`.profile-balance-card`) — ambas blancas. Principal con tipografía más grande y botón sólido morado `#7C3AED`. Bonus más discreto: icono y label en ámbar suave, botón outline ámbar claro.
6. **Colección** — card blanca, separación más amplia entre el título y la fila de avatares (mb-3), conteo `1/3` en gris medio. Los marcos morados internos de los avatares pasan a `#EAEAEA`; el equipado mantiene anillo morado.
7. **Código de referido** — card blanca, el código se ve como input pill gris claro (`#F4F4F6`, texto monoespaciado oscuro), botón copiar compacto morado, chevron gris.
8. **Seguridad de la cuenta** — las tres filas comparten exactamente el mismo card style. Icono dentro de cuadro lila muy claro (`#F4EEFB`) con icono morado a 70% opacidad. Badges "Verificado" / "Vinculado" en verde suave sin borde grueso (`bg #E8F7EF`, texto `#0F8A4A`). "Cambiar" en morado discreto.
9. **Estadísticas, Acciones (LinkRow), Mis Datos** — mismo card style blanco con sombra suave, sin bordes morados, iconos en lila pastel.
10. **Cerrar Sesión** — botón blanco con borde `#F3D4D4` y texto rojo discreto (no rojo saturado).
11. **Section titles** (`SectionTitle`) — color `#8A8A95`, más espacio superior (`mt-6`).

## Reglas globales

- Quitamos todos los `box-shadow` morados/glow en modo claro.
- Quitamos `bg-gradient-to-*` dentro de `.profile-page` en modo claro (forzar `background-image: none`).
- Reemplazamos cualquier `border-purple-*` por `border-color: #EAEAEA !important` dentro del scope.
- Texto base oscuro `#1a1033`; sublíneas `#6B6B75`.
- Morado de marca para acentos: `#7C3AED` (botón/CTA) y `#5B21B6` (títulos).

## Archivos a editar

- `src/styles.css` — añadir bloque `html.light .profile-page { … }` con todas las reglas anteriores (≈120 líneas CSS, scoped, sin afectar otras páginas ni dark mode).

## Lo que NO se toca

- JSX de `src/routes/perfil.tsx` (estructura, datos, hooks).
- Modo oscuro de la página.
- Componentes compartidos (`UserAvatar`, `VipBadge`, dialogs).
- Otras páginas del sitio.
