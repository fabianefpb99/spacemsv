## Sistema de jugadores "filler" para Ranking y Arena

Generamos jugadores ficticios deterministas por día que rellenan el podio y la lista de Arena cuando no hay jugadores reales suficientes. **No se marcan visualmente** — se ven idénticos a usuarios reales. Los jugadores reales siempre tienen prioridad: si un usuario real supera a un filler, el filler baja o sale del top automáticamente.

### Comportamiento

- **Determinismo diario**: semilla = fecha en zona Colombia (UTC-5, `YYYY-MM-DD`). Mismos nombres, avatares y montos máximos durante todo el día → refrescar no cambia nada.
- **Crecimiento progresivo**: el monto mostrado escala con la hora del día (06:00 ≈ 25% del máximo, 23:00 ≈ 100%). A las 2-3 horas notarás que las cifras subieron, simulando actividad real.
- **Reset a medianoche Colombia**: nuevos nombres, avatares y montos al día siguiente.
- **Fusión con reales**: lista final = reales ∪ fillers, ordenada por monto desc, cortada a 10. Reales nunca son desplazados por un filler de igual monto.
- **Tu posición ("#1 fabianefpb")**: se calcula contra reales únicamente — los fillers no afectan tu rank propio.

### Cantidades y rangos

- **Ranking general**: 5 fillers, máximos entre **80.000 y 650.000** COP, escalonados (no todos iguales).
- **Top ganadores de Arena hoy**: **10 fillers**, máximos entre **30.000 y 220.000** COP, escalonados.

### Pool de datos

- **Usernames**: pool de ~30 nombres tipo casino (`luna_84`, `kr1tyk`, `andrxs07`, `mariana.r`, `betkingco`, `daniela.m`, etc.). La semilla escoge sin repetir.
- **Avatares**: las 8 keys predeterminadas del sitio (`avatar-1` … `avatar-8`, ya importadas en `src/lib/avatars.ts`). Cada filler recibe una key real → `UserAvatar` la resuelve igual que para un usuario real, mismo cache, misma carga rápida.

### Cambios técnicos (un solo archivo)

`src/lib/ranking.functions.ts`:

1. Añadir helper `getColombiaDateKey()` → `YYYY-MM-DD` en UTC-5 y `getColombiaHour()` → 0-23.
2. Añadir `hashString(s)` + `mulberry32(seed)` (RNG determinista, sin dependencias).
3. Añadir constantes `FILLER_USERNAMES: string[]` (≈30 entradas) y `FILLER_AVATAR_KEYS = ["avatar-1", … "avatar-8"]`.
4. Añadir `generateFillers({ dateKey, kind: 'general' | 'arena', count, hour })`:
   - RNG sembrado con `hash(dateKey + ":" + kind)`.
   - Escoge `count` usernames y avatares del pool (sin repetir dentro de la lista).
   - Asigna `maxAmount` decreciente dentro del rango de ese `kind`.
   - `currentAmount = round(maxAmount * progressFactor(hour))` con `progressFactor` lineal/suave entre 0.25 y 1.0.
   - Devuelve `RankingEntry[]` con `user_id = "filler:<kind>:<idx>:<dateKey>"` (estable, sirve de key React).
5. En `getRankingPublic.handler`, tras leer reales:
   - `winners = mergeAndTop([...realesWinners, ...fillersGeneral(5)], 10)`
   - `arena   = mergeAndTop([...realesArena,   ...fillersArena(10)], 10)`
   - `mergeAndTop` ordena por `net_amount` desc, conserva orden estable para empates (reales primero).
6. `getMyRankingPosition` **no se modifica** (sigue solo contra reales).

Frontend (`src/routes/ranking.tsx`, `PodiumSlot`, `ArenaRow`): **sin cambios**. Las keys ya usan `e.user_id` que acepta strings arbitrarios; los avatares ya pasan por `UserAvatar` con `avatar_key`.

### Riesgos / consideraciones

- Cero migraciones, cero estado en DB: todo se computa en el handler. Si el reloj del servidor difiere ±1h, el monto puede variar levemente; tolerable.
- El `refetchInterval: 20_000` del front hará que los montos suban suavemente cuando cruza una hora.
- Si en el futuro quieres marcar bots visualmente o ajustar rangos, basta tocar las constantes.