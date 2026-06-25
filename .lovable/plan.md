Plan:

1. Ajustar solo el slider del home en modo claro.
2. Quitar/neutralizar en modo claro el borde oscuro fijo `border-violet-800/50` que está generando la línea negra entre el módulo y el recorrido.
3. Rehacer el pseudo-borde de modo claro para que el recorrido morado/fucsia cubra exactamente el borde visual, solapándose 1–2px si hace falta.
4. Mantener intacto el modo oscuro: no cambiar su borde, colores ni animación.
5. Verificar en el preview que el `::before` del slider queda pegado al borde y que no queda línea negra visible.