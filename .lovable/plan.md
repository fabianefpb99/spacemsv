# Auditoría de Rendimiento — BETSPACE

Análisis read-only. Ningún archivo modificado. Cada hallazgo está numerado para que puedas aprobar/rechazar individualmente.

---

## 1. Imágenes pesadas (PNG sin optimizar)

**Hallazgo:** Hay **26,9 MB en assets**, mayoría PNG sin compresión moderna.
- `home-hero-arena.png` 2,3 MB, `blackjack-bg.png` 2,3 MB, `blackjack-promo.png` 2,3 MB, `blackjack-vip-bg.png` 2,2 MB, `roulette-scene-v2.png` 1,8 MB, `arena-lobby-v4.png` 1,4 MB.
- 5 íconos `mission-*.png` pesan **>1 MB cada uno** (deberían ser 20–80 KB).
- `combo-starter.png` 2,1 MB, `nequi-astronaut-wide.png` 1,3 MB, `space-bg*.png` ~1 MB c/u.
- 8 avatares PNG ~280 KB cada uno = ~2,3 MB solo en avatares.

**Propuesta:** Reconvertir a **WebP/AVIF** con `quality 75–82`, redimensionar al tamaño real de uso, generar `srcset` responsive. Para íconos de misiones bastará ~40 KB. Existe ya `src/lib/admin/image-compress.ts` + tool de "Bulk Compress" — ejecutarlo sobre los assets bundle y reemplazar los importados.
**Riesgo:** Bajo. **Mejora esperada:** **40–60% en LCP / peso inicial** (de ~27 MB a ~6–8 MB).
**Cambios visuales:** No (calidad imperceptible si q≥78).

---

## 2. `SmoothImageLoader` global con `MutationObserver` permanente

**Hallazgo:** `src/components/SmoothImageLoader.tsx` instala un `MutationObserver` global que escanea **todo el DOM** observando `attributes/childList/subtree` y registra listeners por cada `<img>`. En vistas con muchas imágenes (home, ranking, perfil) reprocesa cada mutación.
**Propuesta:** Limitar `attributeFilter: ["src","srcset"]`, debounce 50 ms, y/o reemplazar por una clase CSS `.img-fade` aplicada por componente con `onLoad`. Mantener para imágenes remotas, desactivar para SVG/data URL (ya lo hace, pero el observer corre igual).
**Riesgo:** Medio (afecta fade global).
**Mejora:** **5–10% main-thread** en home. **Cambios visuales:** No.

---

## 3. Intervalos múltiples concurrentes

**Hallazgo:** 22 `setInterval` activos detectados. En `/home`: filler-feed cada **8 s** (`tick`), slider cada **5 s**. En juegos: timers de 1 s para `now`, 70 ms en slot, etc. En `eventos.tsx` hay 3 intervalos (1 s, 30 s, 30 s). Algunos siguen corriendo si la pestaña está en background.
**Propuesta:** (a) Pausar con `document.visibilitychange` cuando pestaña oculta; (b) consolidar timers de 1 s en un único "clock" compartido vía contexto; (c) subir filler-feed de 8 s a 12–15 s.
**Riesgo:** Bajo. **Mejora:** **10–15% CPU idle**, batería móvil. **Visual:** No.

---

## 4. CSS: filtros, blur y drop-shadow costosos

**Hallazgo:** `src/styles.css` tiene **151 reglas con animation/transition**, **40 `@keyframes`**, múltiples `backdrop-filter: blur(10px) saturate(120%)`, y animaciones que animan `filter: drop-shadow(...)` (caras de neón, pulse-glow, slider-neon-sweep). Animar `filter` fuerza repaint en cada frame y es de las operaciones más caras en móvil.
**Propuesta:**
- Reemplazar `drop-shadow` animado por `box-shadow` sobre un pseudoelemento + `opacity` (compositable).
- Bajar `backdrop-blur` a 6 px y quitar `saturate`.
- Limitar animaciones infinitas a elementos visibles (`content-visibility: auto` o pausar fuera de viewport con IntersectionObserver).
- Añadir `@media (prefers-reduced-motion)` para desactivar todo.

**Riesgo:** Medio (cambio visual menor en glow). **Mejora:** **15–25% FPS móvil**. **Visual:** Ligero.

---

## 5. `home.tsx` excesivamente grande (1.105 líneas)

**Hallazgo:** Una sola ruta concentra: slider, juegos destacados, banners, últimas ganancias, misiones, módulos VIP, fillers, prefetch de avatares, intervalos. 21 hooks (`useEffect/useState/...`). Cada update local re-renderiza toda la página.
**Propuesta:** Dividir en sub-componentes memoizados (`<HeroSlider/>`, `<FeaturedGames/>`, `<RecentWins/>`, `<MissionsStrip/>`) con su propio estado. Cada uno con `React.memo`.
**Riesgo:** Medio (refactor amplio, sin lógica nueva). **Mejora:** **20–30% en re-renders** de home. **Visual:** No.

---

## 6. Juegos con archivos monolíticos (>1.000 líneas)

**Hallazgo:** `SlotGame.tsx` 1.566 ln, `SpacemanGame.tsx` 1.329 ln, `BlackjackGame.tsx` 1.016 ln. Muchos `useState` independientes que provocan cascadas. `SlotGame` tiene además un `setInterval(70ms)` corriendo cuando el juego está montado.
**Propuesta:** Extraer sub-componentes (`<Reels/>`, `<PaytablePanel/>`, `<BetControls/>`), pasar de múltiples `useState` a `useReducer`, y detener el timer 70 ms cuando no haya spin activo.
**Riesgo:** Medio-Alto (alta superficie). **Mejora:** **10–20% durante juego activo**. **Visual:** No.

---

## 7. Realtime subscriptions múltiples

**Hallazgo:** 10 canales `supabase.channel(...).subscribe()` activos simultáneamente (eventos, avatares desbloqueados, misiones, VIP level-up, admin x5, spaceman). Cada canal abre WebSocket persistente.
**Propuesta:** Consolidar canales globales (uno por tabla con filter), desuscribir admin channels al salir de `/adminpanel`. Verificar cleanup en cada `useEffect`.
**Riesgo:** Bajo. **Mejora:** **memoria + tráfico WS ~20%**. **Visual:** No.

---

## 8. Posibles fugas de memoria

**Hallazgo:** `useUnlockedAvatars` admite que en StrictMode los canales se duplican. `SlotGame`/`MinesGame` instalan timers en `useEffect` — revisar que todos limpien (`return () => clearInterval`). `BrandLoader` y `LoadingScreen` usan timers que podrían persistir si el componente se desmonta durante transición.
**Propuesta:** Auditoría puntual de `useEffect` sin `return cleanup`. Añadir lint rule `react-hooks/exhaustive-deps`.
**Riesgo:** Bajo. **Mejora:** estabilidad sesiones largas. **Visual:** No.

---

## 9. Imágenes sin `loading="lazy"` ni `width/height`

**Hallazgo:** En `home.tsx` ningún `<img>` declara `loading`/`decoding`/dimensiones. El navegador no puede priorizar ni reservar espacio → CLS y descargas en paralelo.
**Propuesta:** Añadir `loading="lazy"` excepto el LCP, `decoding="async"`, `width`/`height` reales. Para el slider hero usar `fetchpriority="high"` y `<link rel="preload">` en el `head()` de la ruta.
**Riesgo:** Bajo. **Mejora:** **15–25% LCP** y CLS≈0. **Visual:** No.

---

## 10. Falta de code-splitting en juegos

**Hallazgo:** Todos los juegos se compilan/cargan según rutas, pero los componentes pesados (Slot, Spaceman) podrían ser `lazy()`. Si entran al bundle de cualquier ruta común se descarga JS innecesario.
**Propuesta:** Verificar con `bun run build --analyze` y aplicar `React.lazy` + `Suspense` en sub-paneles internos (paytable, history modal).
**Riesgo:** Bajo. **Mejora:** **10–20% bundle inicial**. **Visual:** No.

---

## 11. Audio: preload masivo en Arena

**Hallazgo:** `ArenaGame` precarga **8 audios + ~20 sprites** al montar. Si el usuario solo abre Arena para mirar, descarga ~3–4 MB.
**Propuesta:** Precargar solo sonidos de lobby; los de pelea cargar al primer `handlePlay`. Sprites idle al montar, attack/damage al confirmar apuesta.
**Riesgo:** Bajo. **Mejora:** **40% menos descarga inicial Arena**. **Visual:** No (puede haber 100 ms extra antes de la primera pelea).

---

## 12. Re-renderizaciones por `Date.now()` cada segundo

**Hallazgo:** `MinesGame`, `SlotGame`, `DiceGame`, `eventos.tsx` hacen `setNow(Date.now())` cada 1.000 ms — re-render completo del componente solo para refrescar un cronómetro.
**Propuesta:** Aislar el contador en un sub-componente `<Clock/>` que sea el único que se re-renderice, o usar refs + animationFrame para texto puro vía DOM.
**Riesgo:** Bajo. **Mejora:** **5–10% CPU durante partida**. **Visual:** No.

---

## 13. `styles.css` monolítico (3.225 líneas)

**Hallazgo:** Una sola hoja de 3.225 líneas se descarga y parsea siempre. Mezcla reglas de juegos específicos (arena, slot) con globales.
**Propuesta:** Extraer `arena.css`, `slot.css`, `vip.css` y cargarlos solo en las rutas que los usan (via import dentro del componente).
**Riesgo:** Medio (riesgo de regresión visual si hay reglas compartidas). **Mejora:** **20–30% CSS inicial**. **Visual:** No.

---

## 14. Hooks sin `useMemo`/`useCallback` en listas largas

**Hallazgo:** En `home.tsx`, los arrays de fillers, juegos destacados, banners se recalculan en cada render. Los `map(...)` devuelven JSX sin `key` estables ni memoización del item.
**Propuesta:** Envolver en `useMemo`, extraer item como `React.memo(Item)`. **Riesgo:** Bajo. **Mejora:** **5–10%** re-render home. **Visual:** No.

---

## 15. Animaciones siempre activas fuera de viewport

**Hallazgo:** `animate-pulse-glow`, `animate-promo-blop`, neón sweep del slider, estrellas centelleantes corren aunque el elemento esté fuera de pantalla.
**Propuesta:** `content-visibility: auto` en módulos largos + `IntersectionObserver` para pausar `animationPlayState`.
**Riesgo:** Bajo. **Mejora:** **10–15% FPS en scroll**. **Visual:** No.

---

## Resumen por riesgo

| Riesgo | Hallazgos | % del backlog |
|--------|-----------|---------------|
| **Sin riesgo** (config / atributos HTML) | #9, parcial de #1 | **~10%** |
| **Riesgo bajo** | #1, #3, #7, #8, #10, #11, #12, #14, #15 | **~60%** |
| **Riesgo medio** | #2, #4, #5, #13 | **~25%** |
| **Riesgo alto** | #6 (parte refactor juegos) | **~5%** |

**Mejora potencial agregada estimada:** **35–50% en TTI/LCP**, **15–25% en FPS móvil**, **30–40% en peso de descarga inicial**.

---

## Cómo proceder

Indícame **qué hallazgos apruebas** (por número, ej. "implementa 1, 3, 9 y 11"). Aplicaré uno por uno y validaré antes de pasar al siguiente. Ningún cambio hasta tu aprobación explícita.
