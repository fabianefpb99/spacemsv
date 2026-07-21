# Project Memory

## Core
No usar `:not(.theme-dark-fixed) .X` en overrides `html.light` — usa `.X:not(.theme-dark-fixed):not(.theme-dark-fixed *)`. Ver [theme-dark-fixed](mem://design/theme-dark-fixed-selectors).
Subárboles siempre oscuros: HamburgerDrawer, `.vip-frame`, `/mis-recargas`, `/transacciones`, todos los juegos, popups starter. AuthDialog sigue el tema global (claro y oscuro) — estilos scoped bajo `.auth-scope` en styles.css.
Comprimir imágenes nuevas a WebP (quality ~72, máx 1024px) antes de importarlas.

## Memories
- [theme-dark-fixed selectors](mem://design/theme-dark-fixed-selectors) — patrón CSS correcto para overrides de modo claro que deben respetar subárboles oscuros
- [PageSpeed LCP intentos fallidos](mem://constraints/pagespeed-lcp-attempts) — cambios en PromoPopup/MascotFloater que empeoraron LCP y no deben repetirse