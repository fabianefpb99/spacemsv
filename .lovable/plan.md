Voy a corregirlo de forma aislada, sin tocar VIP, recargas ni el resto de Perfil.

Plan:
1. Revertir el enfoque del modal forzado con clase `dark`, porque no está aislando bien los inputs bajo `html.light` y deja composición mezclada.
2. Crear una clase específica para este modal, por ejemplo `personal-data-dialog`, aplicada solo en `PersonalDataDialog`.
3. Añadir reglas CSS de alta prioridad y solo bajo esa clase para:
   - panel oscuro sólido;
   - labels y textos claros legibles;
   - inputs/selects con fondo oscuro, texto blanco y placeholder lila suave;
   - bordes/focus morados;
   - menú desplegable del select también oscuro, aunque use portal;
   - checkbox, link de términos y botón Guardar con contraste correcto.
4. No cambiar componentes globales `Input`, `Select`, `Label` ni reglas generales de modo claro.
5. Verificar en `/perfil` con modo claro que el modal se vea 100% oscuro y legible, como los flujos oscuros ya trabajados.

Archivos a tocar:
- `src/components/profile/PersonalDataDialog.tsx`
- `src/components/profile/PersonalDataForm.tsx`
- `src/styles.css`