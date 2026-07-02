## Objetivo
En `/eventos`:
1. Las misiones cuya recompensa es un **avatar** no deben reiniciarse: una vez el usuario la desbloquea, queda marcada como completada para siempre (independiente del período diario/semanal). Las misiones de saldo/spins siguen reiniciándose como hoy.
2. Cuando una misión esté completada, la tarjeta debe mostrarse claramente como "hecha": toda la tarjeta con opacidad reducida y un **check SVG grande superpuesto en el centro**.

## Cambios (solo frontend, `src/routes/eventos.tsx`)

### 1. Persistencia visual de misiones de avatar
- Añadir una query paralela a `user_avatar_unlocks` (columna `mission_id`) filtrada por el usuario. Ya existe la tabla y RLS.
- En el mapeo `dbMissions`, para cada misión con `reward_kind === "avatar"`:
  - Si `unlockedMissionIds.has(mission.id)` → forzar `progress = goal` (100%) y marcar `completed = true`, sin importar el `period_start` actual.
- Para el resto de misiones (`bonus`, `spins`, `xp`) se mantiene el cálculo actual con `progressForMission` (siguen reiniciándose por período).
- Añadir `completed: boolean` al tipo `Mission` (derivado: `progress >= goal`, o el flag persistente para avatares).

### 2. Estado visual "completada" en `MissionCard`
- Cuando `mission.completed`:
  - Envolver el contenido en un contenedor con `opacity-40` y `pointer-events-none` (evita que se pueda pulsar el CTA).
  - Superponer un check en el centro: círculo verde con un `<Check />` de `lucide-react` (o SVG inline) grande (~64px), con glow verde suave (`drop-shadow`), centrado con `absolute inset-0 flex items-center justify-center`.
  - La barra de progreso llena al 100% en verde.
  - Sustituir el botón CTA por una etiqueta "Completada" deshabilitada (o dejarla oculta bajo la opacidad).

### 3. Notas
- No se toca la lógica del backend ni de reseteo por período. Los avatares ya se guardan permanentemente en `user_avatar_unlocks` gracias al trigger existente; solo estamos reflejando ese hecho en la UI de eventos.
- El floater de "misión completada" no cambia.

## Archivos afectados
- `src/routes/eventos.tsx` (query extra, mapeo, y `MissionCard` con overlay de check + opacidad).
