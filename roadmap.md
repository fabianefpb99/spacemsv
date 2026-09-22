# Roadmap — Salida de Lovable Cloud a Supabase propio

## Hallazgo clave (21 sep 2026)
- Un proyecto con Lovable Cloud activo **NO puede conectar un Supabase externo**: la plataforma lo bloquea y no existe herramienta para habilitarlo. La única vía es migración completa fuera de Lovable (backend + hosting).
- Además, en Lovable Cloud no hay acceso a la contraseña de la base de datos ni a la service_role key → no es posible un `pg_dump` completo. Los hashes de contraseña de usuarios NO se pueden exportar: en el nuevo backend los usuarios entran con "olvidé mi contraseña" la primera vez (o se re-registran).

## Tareas abiertas
1. **Esperando decisión del usuario**: ¿proceder con la salida completa? ¿Dónde aloja la app? (Vercel / Cloudflare / servidor propio)
2. ~~Regenerar paquete de migración actualizado~~ ✅ Entregado 22 sep 2026: `betspace-migrations-2026-09-22.zip` (134 migraciones + LEEME).
3. Export de datos del schema público vía API (profiles, balances, transacciones, VIP, misiones, apuestas deportivas, etc.) a SQL/CSV importable.
4. Plan de usuarios auth: exportar emails/ids y script para crearlos en el nuevo proyecto + flujo de reset de contraseña.
5. Actualizar `GUIA-MIGRACION.md` (cron jobs, secrets como RESEND_API_KEY, storage, env vars, redirect URLs).
6. NO desconectar Lovable Cloud hasta que el nuevo sitio esté verificado en producción (es irreversible y borra todo).
