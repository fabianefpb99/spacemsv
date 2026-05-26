## Objetivo
Evitar que el astronauta, al salir volando, empuje el layout o genere scroll en mobile, sin que se vea un borde o máscara artificial.

## Plan
1. Mover la animación del astronauta a una capa visual totalmente separada del flujo del layout.
2. Convertir el área del juego en un viewport recortado real para el sprite, de modo que todo lo que salga de ese rectángulo quede invisible sin alterar medidas del documento.
3. Ajustar la animación de crash para que el desplazamiento ocurra sólo con `transform` dentro de esa capa, evitando expansión por ancho/alto visual.
4. Revisar los elementos flotantes del stage para que ninguno use offsets que puedan reintroducir scroll horizontal o vertical en mobile.
5. Validar el resultado en el viewport móvil actual para confirmar que el astronauta puede salir de escena sin mover componentes.

## Resultado esperado
- El astronauta puede desaparecer fuera de pantalla visualmente.
- No aparece scroll extra al crashear.
- La UI inferior no se mueve ni cambia de tamaño durante la animación.
- No se ve una “caja” o delimitación evidente alrededor de la máscara.

## Detalles técnicos
- Usaré un contenedor absoluto del stage con recorte (`overflow-hidden` en la capa correcta, no sólo en el nodo interno del astronauta).
- El sprite quedará fuera del flujo normal con posicionamiento absoluto y aislamiento del stacking/contexto visual.
- Si hace falta, ajustaré la keyframe `fly-away` para que salga dentro de un sistema de coordenadas controlado y no con desplazamientos que terminen afectando el documento.
- No tocaré la lógica de apuesta; sólo la capa visual y su contención.