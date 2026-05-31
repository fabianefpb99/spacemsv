## Problemas actuales

1. **Pips planos**: hoy son esferas brillantes (glow + highlight superior) que parecen botones pegados encima, no agujeros perforados en la cara.
2. **Esquinas huecas**: cada cara tiene `border-radius: 22px`, pero las caras se unen en un cubo de aristas rectas. El radio recorta cada cara individualmente y deja triángulos transparentes en las esquinas, por eso "se ven huecas".
3. **Material de lámina**: gradiente y bordes muy contrastados (borde lila claro + glow morado fuerte) hacen que parezca chapa pintada, no un dado sólido tipo resina/cristal.

## Plan

Cambios en `src/styles.css` (sección "Dice game"), sin tocar lógica de juego.

### 1. Pips como huecos perforados
Reemplazar el estilo de `.dice-pip` para que se vean hundidos:
- Fondo oscuro casi negro con un leve gradiente que simule el fondo del hueco.
- `box-shadow` con `inset` fuerte arriba (sombra interna) + reflejo `inset` abajo claro → da la ilusión de profundidad cóncava.
- Eliminar el highlight superior brillante (`::after`) y reemplazarlo por un punto de luz minúsculo en el fondo del hueco (acento fucsia/violeta muy tenue).
- Mantener tamaño actual para no romper el layout del grid 3×3.

### 2. Cubo con esquinas realmente redondeadas
Dos ajustes combinados:
- **Bajar el `border-radius` de las caras** de `22px` a `~10px` para que las aristas del cubo coincidan mejor.
- **Añadir bisel de arista** mediante un segundo `box-shadow` exterior oscuro muy ajustado + un `inset` claro en el borde de cada cara, simulando el chaflán de un dado real. Las esquinas dejan de verse como agujeros porque el bisel oscuro las cierra visualmente.
- Opcional: añadir una sombra proyectada bajo el cubo (en `.dice-stage`) para anclarlo y reforzar la sensación 3D.

### 3. Material tipo resina/cristal en vez de lámina
Reescribir el `background` y `box-shadow` de `.dice-face`:
- Gradiente radial más suave (centro violeta translúcido → bordes morado profundo) sin la franja blanca tan marcada arriba.
- Reflejo especular (`::after`) más sutil y desplazado, tipo brillo de canto de cristal.
- Reducir el glow exterior morado para que el dado no parezca un letrero de neón; mantener un halo discreto que ya cubre `.dice-halo` aparte.
- Ajustar el borde de la cara a un tono más oscuro y fino para reforzar la lectura de "cuerpo sólido".

### 4. QA visual
Tras los cambios, revisar las 6 caras (idle gira lento por las 6) y la animación de tirada en `/dados` para confirmar:
- Los pips se ven como agujeros, no como esferas.
- Las esquinas del cubo se ven cerradas y redondeadas, sin triángulos transparentes.
- El cubo se siente como un objeto sólido, no como una placa morada.

## Fuera de alcance

- No se cambia la lógica de tirada ni la animación de giros.
- No se mueve la sección "Últimos resultados" ni los multiplicadores.
- No se cambian colores globales del tema.
