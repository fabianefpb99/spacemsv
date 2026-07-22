## Error real

El error fue mezclar dos flujos distintos dentro del mismo modal:

1. **Login / registro simple**: email, usuario, contraseña, referido.
2. **Datos personales**: nombre, cédula, fecha de expedición, teléfono, términos.

Al meter el segundo formulario dentro de `AuthDialog`, heredó cosas que ya no deberían existir ahí: el header grande, el switch “Iniciar sesión / Registrarse”, el centrado del modal corto y las restricciones de altura/scroll pensadas para login. Por eso en iOS termina pegándose al safe area y el scroll se vuelve inconsistente.

## Plan de corrección

### 1. Dejar `AuthDialog` solo para login y registro simple

- El modal de login/registro volverá a encargarse únicamente de:
  - Iniciar sesión.
  - Crear cuenta con email, usuario, contraseña y referido.
- Se elimina el paso 2 interno que muestra `PersonalDataForm` dentro de `AuthDialog`.
- Así desaparece el switch de login/registro cuando el usuario ya está registrado.

### 2. Después del registro exitoso, cerrar modal y mandar al Home

Cuando el usuario termine el registro simple:

```text
Registro simple exitoso
→ cerrar AuthDialog
→ refrescar sesión
→ navegar al Home
→ activar flotante independiente de datos personales
```

No se quedará dentro del modal de registro.

### 3. Crear un flotante independiente para datos personales

Usaremos un modal separado para completar los datos personales:

- Título enfocado: “Completa tus datos” o similar.
- Sin botones de “Iniciar sesión / Registrarse”.
- Sin logo/header grande de autenticación.
- Solo la explicación breve y el formulario de datos.
- Se mantiene como información adicional necesaria para retiros.

### 4. Arreglar el scroll de raíz en ese flotante nuevo

El modal de datos personales tendrá una estructura distinta a la de login:

```text
Overlay fijo pantalla completa
└── Contenedor scroll principal con h-dvh / overflow-y-auto
    └── Panel con padding safe-area top/bottom
        └── Formulario completo
```

Puntos clave:

- El scroll será del contenedor principal, no de un panel interno recortado.
- Se respetará `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)`.
- En móviles no se centrará verticalmente si el contenido es alto; empezará debajo del safe area y permitirá bajar hasta el botón.
- En desktop puede verse centrado/limpio si cabe.

### 5. Mantener compacto el formulario, pero sin depender de eso para que funcione

- Se conservan los campos más compactos.
- Pero el arreglo principal no será “apretar más cosas”, sino separar el flujo y hacer que el scroll funcione aunque el contenido sea alto.

### 6. Reutilizar la lógica existente sin romper perfil/retiros

- `PersonalDataForm` seguirá siendo el formulario base.
- No se toca la lógica de guardado en la base de datos.
- No se cambian validaciones de cédula, fecha, teléfono, mayoría de edad o términos.
- Las pantallas de perfil/retiros que ya usan datos personales no deben romperse.

### 7. Verificación

Voy a verificar en viewport móvil tipo iPhone que:

- Login/registro simple vuelve a verse centrado y normal.
- Tras registrarse, el usuario queda en Home.
- El nuevo flotante de datos personales aparece separado.
- No aparece el switch login/registro en ese flotante.
- El scroll baja hasta “Finalizar registro”.
- El panel no queda debajo del notch/safe area.