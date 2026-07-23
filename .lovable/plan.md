## Rediseño del bloque superior de `/perfil`

Reestructuro el bloque de identidad + progreso + balances para que coincida con el boceto. Nada por debajo de "Colección" cambia.

### 1. Desvincular el nombre del perfil

Actualmente el bloque de identidad muestra:
- Username grande (ej. "KRAUZER")
- Nombre completo real (`first_name + last_name`)
- `Usuario #16290 · Bronce IV`

Cambio: **eliminar tanto el username como el nombre completo** de la vista. Solo queda `Usuario #16290` como identificador. El campo `username` sigue existiendo en la BD (lo usan ranking, chat, comentarios, etc.), solo desaparece de la UI del perfil propio.

### 2. Layout vertical centrado (nuevo bloque de identidad)

Reemplazo la "identity card" horizontal (avatar-izquierda, texto-medio, escudo-derecha) por un stack vertical centrado:

```text
        ← ┃  MI PERFIL  ┃ ⚙
        ╭───────────────────╮
        │ ╭╮  avatar  ╭╮   │   ← arcos morados orbitales decorativos
        │     [📷]          │   ← botón cámara debajo del avatar
        │                   │
        │   Usuario #16290  │   ← único identificador
        │                   │
        │      ⬢ escudo ⬢   │   ← insignia grande centrada
        │   ·  BRONCE IV  · │   ← label del rango en dorado
        ╰───────────────────╯
```

- Fondo: mismo `vip-frame` actual, pero altura mayor y padding vertical más generoso.
- Arcos morados detrás del avatar (dos elipses SVG absolutas, uno por lado, con `stroke` degradado morado — puramente decorativos).
- Avatar: mismo `UserAvatar` pero centrado, tamaño `88×88`, borde tematizado por rango.
- Botón cámara: pasa a estar centrado justo debajo del avatar (no en la esquina).
- Escudo: `RANK_ART[rank]` grande (`96×96`) centrado, con dos puntos morados a los lados (`· BRONCE IV ·`) en el color acento del rango.

### 3. Card de nivel/XP (redistribución)

Reemplazo la card horizontal actual `profile-vip-progress` por la del boceto:

```text
┌──────────────────────────────────────┐
│ ⬢ IV │  NIVEL 5           104/125 XP │
│      │  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────┘
```

- Hexágono a la izquierda con la sub-división romana (I/II/III/IV) en el color del rango.
- "NIVEL 5" en tipografía display, XP a la derecha.
- Barra degradada `purple → amber` (ya existe en `VIP_CARD_THEME[rank].barGradient`).
- Sigue siendo `<Link to="/vip">`.

### 4. Cards de balance (retoque)

Las dos cards ya existen; solo ajusto proporciones para que respiren igual que el boceto:
- Iconos más grandes (`wallet` morado, `gift` dorado) en un chip circular a la izquierda del label.
- Monto en tipografía display más grande (`text-xl`) y verde neón.
- Botones inferiores ocupan ancho completo con más padding vertical.

### 5. Notas técnicas

- Solo modifico `src/routes/perfil.tsx` (bloque de identidad + card de progreso + balances) y añado unas reglas locales en `src/styles.css` para los arcos orbitales y el hexágono de sub-rango.
- No toco: header, `Colección`, historial de transacciones, formularios de datos personales, `VipLevelUpToast`.
- El `username` y `full_name` siguen existiendo en `profiles`; solo dejan de renderizarse en `/perfil`. Otras rutas que los usan (ranking, comentarios, chat) no se afectan.
- Se mantiene el tema oscuro fijo del subárbol (`theme-dark-fixed`).

¿Aplico?
