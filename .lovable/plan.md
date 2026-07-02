## Objetivo
Darle más ventaja a la casa en la ruleta aumentando la probabilidad de que caiga el verde (0), pero sin afectar el resto del código. El ajuste será configurable desde el panel de administración y se aplicará en el sorteo del servidor.

## Situación actual
- La ruleta es europea: 37 números (0 verde, 18 rojos, 18 negros).
- El sorteo se hace en la función SQL `spin_roulette_v1` con distribución uniforme (cada número 1/37 ≈ 2.7%).
- El verde paga 14×; rojo/negro paga 2×.
- No existe ningún peso configurable para el verde.
- El usuario quiere un aumento "bastante notable" (4/5) y que sea configurable y funcional, a diferencia de la sección de RTP que no funciona.

## Propuesta de implementación

### 1. Base de datos: nueva tabla `roulette_config`
Crear una tabla pequeña y única para guardar el peso del verde:

```sql
CREATE TABLE public.roulette_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  green_weight numeric NOT NULL DEFAULT 1.0 CHECK (green_weight >= 1.0 AND green_weight <= 5.0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roulette_config TO authenticated;
GRANT ALL ON public.roulette_config TO service_role;
ALTER TABLE public.roulette_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage roulette config" ON public.roulette_config
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

Insertar fila inicial: `green_weight = 1.0` (comportamiento actual).

### 2. Actualizar la función SQL `spin_roulette_v1`
En lugar de sortear uniforme entre 37 segmentos, se usará un sorteo ponderado:
- Rojo: peso 18
- Negro: peso 18
- Verde: peso configurable (`green_weight`)

La función leerá el peso de `roulette_config`, calculará el total de pesos y hará rejection sampling sobre ese rango. Así se mantiene la misma técnica criptográfica (`gen_random_bytes`) y solo cambia la distribución.

Ejemplo de efectos del peso:
- Peso 1.0 (actual): verde ≈ 2.7%
- Peso 2.0: verde ≈ 5.3%
- Peso 3.0: verde ≈ 7.7%
- Peso 5.0: verde ≈ 12.2%

Con peso 5.0 la casa sigue teniendo ventaja en rojo/negro (pagan 2× sobre 48.6% real), pero en verde el retorno esperado sube a ~171% (paga 14×). Por eso se propone un tope de 5.0 para no invertir la ventaja de la casa en verde. Si el usuario quiere mantener ventaja estricta en verde, se puede reducir el payout del verde de 14× a un valor que compense (por ejemplo, con peso 2.0 el payout debería ser ~9× para mantener house edge similar). Esto se discutirá antes de implementar si el usuario lo desea.

### 3. Server functions en `src/lib/admin/admin.functions.ts`
Crear dos funciones:
- `adminGetRouletteConfig`: devuelve `green_weight`, `updated_at`, `updated_by_label`.
- `adminUpdateRouletteConfig`: recibe `green_weight`, valida rango 1.0–5.0, actualiza fila y registra el admin.

Ambas usan `requireSupabaseAuth` y `assertAdmin`.

### 4. Componente admin `src/components/admin/RouletteConfigSection.tsx`
Nueva sección con:
- Slider o input numérico para `green_weight` (1.0 a 5.0, paso 0.1).
- Indicador en vivo de la probabilidad resultante del verde.
- Botón "Guardar" con estado de carga.
- Mensaje de éxito/error.
- Diseño consistente con el resto del panel (colores oscuros, púrpura).

### 5. Integrar en `src/routes/adminpanel.tsx`
- Agregar `roulette` a `AdminSection` en `src/components/admin/shared.tsx`.
- Agregar entrada en `SECTIONS` del panel con icono `Settings` o similar.
- Agregar caso en `renderSection` para mostrar `RouletteConfigSection`.

### 6. Verificación funcional
Después de implementar:
- Invocar `adminUpdateRouletteConfig` desde el sandbox para cambiar el peso a 2.0.
- Invocar `spin_roulette_v1` (o `spin_roulette_v2`) múltiples veces y contar frecuencia de verde para comprobar que sube.
- Restaurar el peso a 1.0 si es necesario después de las pruebas.
- Revisar el error de hydration que aparece en el preview; si persiste después de los cambios, se tratará como issue separado.

## Archivos a modificar/crear
- `supabase/migrations/` (nueva migración para tabla y función SQL)
- `src/lib/admin/admin.functions.ts` (server functions)
- `src/components/admin/RouletteConfigSection.tsx` (nuevo)
- `src/components/admin/shared.tsx` (añadir tipo `AdminSection`)
- `src/routes/adminpanel.tsx` (integrar sección)

## Notas de seguridad
- Solo admins con rol `admin` en `user_roles` podrán ver/modificar la configuración.
- La función SQL se ejecuta con el usuario autenticado (RLS); la función leerá `roulette_config` con una política `USING` que requiere rol admin, pero el sorteo de ruleta es llamado por un usuario normal. Por eso la tabla necesitará una política `SELECT` pública para la función de sorteo, o la función usará `SECURITY DEFINER` para leer la configuración. Se optará por `SECURITY DEFINER` en la función SQL para que el sorteo siempre pueda leer el peso actual sin exponer el historial de ediciones al usuario.