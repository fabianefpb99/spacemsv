
# Nuevo diseño del flotante Login / Registro

Modal moderno inspirado en la referencia enviada: **avatar NOVA** (de Arena) arriba, wordmark BETSPACE, mensaje motivador, tabs segmented "Iniciar sesión / Registrarse", campos con icono, CTA morado con glow y enlace inferior para cambiar de modo. Sin login social. Funciona en modo oscuro y claro respetando los tokens semánticos del proyecto.

## Cambios

### 1. Header del modal
- **NOVA** (`src/assets/arena/nova-idle.png`) a ~88px en un contenedor circular con halo morado suave.
- Wordmark **BETSPACE** debajo con la tipografía display actual.
- Copy que cambia según la pestaña:
  - **Iniciar sesión** — "Tu misión te espera" · "Entra y sigue ganando desde donde lo dejaste."
  - **Registrarse** — "Empieza a ganar hoy" · "Crea tu cuenta en 30 segundos y activa tu bono de bienvenida."

### 2. Tabs segmented
Píldora con dos opciones. El activo lleva superficie clara con leve sombra sobre morado; el inactivo queda transparente y atenuado. Transición suave.

### 3. Campos
- Label pequeña por encima.
- Input con icono a la izquierda (`Mail`, `User`, `Lock`, `Ticket`), padding cómodo.
- Contraseña con toggle `Eye/EyeOff`.
- Foco: anillo `ring-primary/40`.
- Errores en línea con color destructivo.

### 4. CTA principal
- Full width, alto 48px, radio 12px, gradiente `--primary → --primary-glow`, glow morado al hover, `active:scale-[.98]`.
- Texto: "Iniciar sesión" / "Crear cuenta y ganar".
- Loading con spinner.

### 5. Pie
- "¿No tienes cuenta? **Regístrate gratis**" ↔ "¿Ya juegas con nosotros? **Inicia sesión**".
- Mini-legal: "Al continuar aceptas los Términos" (link a `/terminos`).
- Se elimina completamente el bloque de Google del diálogo.

### 6. Contenedor
- `max-w-[420px]`, padding 28px, radio 20px.
- **Dark**: `bg-[hsl(var(--background))]` con borde `border-primary/25` y glow morado en el top.
- **Light**: fondo blanco con borde suave y sombra elegante.
- Backdrop `bg-black/70 backdrop-blur-md`.
- Botón × discreto arriba a la derecha.

### 7. Motion
- Entrada: fade + scale 0.96→1 (150ms).
- Cambio de tab: crossfade (100ms).

## Detalles técnicos

- Se reescribe **solo** `src/components/auth/AuthDialog.tsx`. Se importa `novaIdle from "@/assets/arena/nova-idle.png.asset.json"` y se usa `<img src={novaIdle.url} />`.
- Se elimina `GoogleButton` y el import de `lovable`. Verifico que no se use fuera del diálogo antes de borrarlo del archivo.
- Se **conservan** intactos: `signUpSchema`, `signInSchema`, submit handlers, referral RPC, paso 2 con `PersonalDataForm`, `refreshSession`, control de scroll/Escape/portal.
- Estilos con **tokens semánticos** (`bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`, `ring-ring`, `text-muted-foreground`) — nada hardcodeado (`text-white`, `bg-black`, `bg-[#...]`) → el modo claro funciona automáticamente.
- El diálogo **no** se marca como `theme-dark-fixed`; sigue el tema global (la regla de memoria sobre overrides `html.light` no aplica porque no hay override específico).
- Se limpian las clases `.auth-dialog-*` viejas de `src/styles.css` que ya no se usan, para no dejar CSS que pise el nuevo look.
- Se añaden como `@utility` en `styles.css` (Tailwind v4) solo lo estrictamente necesario: `auth-cta-gradient` y `auth-panel-glow`, ambos derivados de `var(--primary)` para que respondan al tema.

## Verificación

1. Abrir modal en `/home` invitado — modo oscuro OK, NOVA visible.
2. Toggle a modo claro — contraste, botón y foco correctos.
3. Signin con credenciales inválidas → error visible.
4. Signup completo con referral → paso 2 con `PersonalDataForm`.
5. Escape, click backdrop, botón ×, scroll interno en móvil (390px).
