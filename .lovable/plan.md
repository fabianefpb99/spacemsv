## Objetivo
Hacer que `/vip` siempre se renderice con la paleta oscura, eliminando del CSS todas las reglas `html.light` que afectan a esa pantalla — sin usar el enfoque "forzar dark theme" que ha causado problemas antes, y sin tocar `/perfil` (que comparte algunas clases VIP).

## Estrategia
Marcar la raíz de `/vip` con una clase propia (`vip-page`) y, en cada regla `html.light` que pinte componentes VIP, **excluir** los descendientes de `.vip-page`. Así esa pantalla nunca tiene estilos de modo claro que pisar, y las mismas clases siguen funcionando en `/perfil` u otros lugares.

## Cambios

### 1. `src/routes/vip.tsx`
- Añadir `vip-page` al `<div className="min-h-screen bg-[#060210] text-white">` raíz. No se cambia ningún color/clase visual; solo se agrega el marcador.

### 2. `src/styles.css` — neutralizar light en `/vip`
Acotar (NO borrar — para no romper `/perfil`) cada regla `html.light` que toca elementos presentes en `/vip`, añadiendo `:not(.vip-page *)` o un selector equivalente con `:where()`:

- Línea 23 — `html.light .bg-[#060210]:not(header):not(nav):not(.theme-dark-fixed)` → añadir `:not(.vip-page):not(.vip-page *)`.
- Línea 453 — `html.light .profile-vip-progress` → excluir cuando esté dentro de `.vip-page`.
- Línea 460 — bloque de colores de texto del progress VIP → misma exclusión.
- Línea 464 — `bg-purple-500/20` dentro del progress → misma exclusión.
- Línea 492 / 498 — `html.light .vip-sub-badge.vip-sub-badge` (y `*`) → misma exclusión.
- Línea 937 — `html.light .vip-frame` → misma exclusión.
- Línea 941 — `html.light .vip-frame > .vip-frame-inner` → misma exclusión.
- Líneas 945-946 — `::before/::after` de `.vip-frame-inner` → misma exclusión.
- Línea 950 — colores de texto dentro de `.vip-frame-inner` → misma exclusión.
- Línea 954 — `drop-shadow` dentro de `.vip-frame-inner` → misma exclusión.

(Las reglas que ya van scopeadas con `.profile-page` no se tocan: solo afectan a `/perfil`.)

### 3. Verificación
- Cambiar a modo claro en la app, ir a `/vip`: fondo, tarjetas, badges, barra de progreso y chips de premios deben verse exactamente igual que en modo oscuro.
- Visitar `/perfil` en modo claro y confirmar que su estilo claro sigue intacto.
- Visitar `/home` en modo claro y confirmar que no cambió nada.

## Notas técnicas
- Se prefiere `:not(.vip-page *)` sobre eliminar reglas porque varias clases (`vip-frame`, `vip-sub-badge`, `profile-vip-progress`) se reutilizan en `/perfil`; borrarlas dejaría `/perfil` sin estilo claro.
- No se introducen reglas nuevas tipo `html.light .vip-page * { color: ... }`. La idea es justo lo opuesto: que en `/vip` simplemente **no exista** ninguna sobrescritura de light, dejando que ganen los estilos base (oscuros) ya definidos por las clases de Tailwind y los hex hard-codeados del componente.
