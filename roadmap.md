# Roadmap — Salida de Lovable Cloud a Supabase propio

## Tareas abiertas
1. **Habilitar/conectar Supabase propio en este proyecto** (pedido directo del usuario) — verificar si la conexión requiere autorización del usuario en la UI de Lovable.
2. Actualizar paquete de migración (ZIP de julio tiene 121 migraciones; hoy son 134) con schema completo actualizado.
3. Definir con el usuario: ¿dónde se aloja la app? (Vercel / Cloudflare / servidor propio / seguir en Lovable).
4. Definir con el usuario: ¿migrar datos y usuarios con contraseñas, empezar limpio, o solo usuarios+saldos?
5. Actualizar `GUIA-MIGRACION.md` (cron jobs, secrets, auth providers, storage, env vars) según las respuestas.

## Notas
- Desconectar Lovable Cloud es irreversible y borra todos los datos — NO hacerlo hasta que el nuevo backend esté verificado en producción.
