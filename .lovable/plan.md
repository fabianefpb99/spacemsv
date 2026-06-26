## Objetivo

Reorganizar `/perfil` con una grilla de **Accesos Rápidos** (estilo iconos en cuadrícula como la imagen señalada), agrupando las secciones actuales en 4 módulos. Cada acceso abre su propia subsección/ruta. "Mis Datos" pasa a ser un desplegable colapsado por defecto.

## Lo que se mantiene intacto

- Header de perfil (avatar, nombre, nivel/rango VIP, barra de progreso)
- Balance Principal + Balance Bonus
- Banner VIP ("Disfruta de beneficios exclusivos")
- Avatares coleccionables
- Bottom nav

## Nueva sección: ACCESOS RÁPIDOS (grilla 4 columnas)

Reemplaza los bloques sueltos de "Seguridad de la cuenta" y la lista vertical (Mis Recargas, Retirar saldo, Historial, Eventos, Verificación).

| Icono | Título | Contenido agrupado |
|---|---|---|
| 🛡️ | **Seguridad** | Correo, Contraseña, Teléfono, Verificación de Identidad |
| 💳 | **Movimientos** | Mis Recargas, Retirar saldo, Historial de Transacciones |
| 🎯 | **Actividad** | Eventos (y futuras: misiones, logros) |
| ⚙️ | **Ajustes** | Apariencia (claro/oscuro), Cerrar sesión, datos de cuenta |

Cada tile: ícono morado arriba, label corto debajo, fondo blanco con borde sutil (mismo estilo de las cards actuales del perfil claro). Al tocar abre una vista dedicada.

## Mis Datos → Desplegable

Convertir el bloque "MIS DATOS" en un acordeón colapsado por defecto:
- Header clickeable: "Mis Datos" + chevron
- Al expandir muestra Nombres, Apellidos, Género, Nacimiento, Teléfono, Documento, Expedición + botón "Editar datos"

## Implementación técnica

- `src/routes/perfil.tsx`: reemplazar las cards de Seguridad y la lista de accesos por una `<QuickAccessGrid>` (4 tiles). Envolver "Mis Datos" en `<Collapsible>` (shadcn) o estado local con animación.
- Nuevas rutas para los detalles agrupados:
  - `src/routes/perfil.seguridad.tsx` — contiene Correo / Contraseña / Teléfono / Verificación (las cards actuales reubicadas)
  - `src/routes/perfil.movimientos.tsx` — links a `/mis-recargas`, `/retirar`, `/transacciones`
  - `src/routes/perfil.actividad.tsx` — link a `/eventos` y futuras
  - `src/routes/perfil.ajustes.tsx` — apariencia, cerrar sesión
- Alternativa más liviana: en vez de 4 rutas nuevas, abrir cada grupo como un Sheet/Drawer modal desde la misma página de perfil. **Recomiendo rutas** para que sean navegables y compartibles.
- Solo afecta presentación/agrupación; no toca lógica de negocio ni datos.

## Confirmaciones que necesito

1. ¿Te sirven los 4 grupos propuestos (Seguridad, Movimientos, Actividad, Ajustes)? ¿O prefieres otra distribución/nombres?
2. ¿Subsecciones como **rutas nuevas** (`/perfil/seguridad`, etc.) o como **drawers/sheets** dentro del perfil?
3. ¿"Verificación de Identidad" entra en **Seguridad** (mi propuesta) o la dejamos como tile suelto?
