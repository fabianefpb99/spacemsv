import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getSupabaseAdmin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function isAdmin(userId: string) {
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export const listAdminNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) return [];
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("admin_notifications")
      .select("id,type,title,body,link,meta,read_by,created_at")
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);
    return (data ?? []).map((n) => ({
      ...n,
      read: Array.isArray(n.read_by) && n.read_by.includes(context.userId),
    }));
  });

export const markAdminNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) return { ok: false };
    const admin = await getSupabaseAdmin();
    const { error } = await admin.rpc("mark_admin_notification_read", { p_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllAdminNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) return { count: 0 };
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin.rpc("mark_all_admin_notifications_read");
    if (error) throw new Error(error.message);
    return { count: (data as number) ?? 0 };
  });