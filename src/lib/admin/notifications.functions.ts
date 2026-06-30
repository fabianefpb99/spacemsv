import { safeRpcError } from "@/lib/server-safe-error";
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
    if (error) throw safeRpcError(error);
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
    // Read current read_by, append our user id if missing, then write back.
    const { data: row, error: readErr } = await admin
      .from("admin_notifications")
      .select("read_by")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const current: string[] = Array.isArray(row?.read_by) ? (row!.read_by as string[]) : [];
    if (current.includes(context.userId)) return { ok: true };
    const next = Array.from(new Set([...current, context.userId]));
    const { error } = await admin
      .from("admin_notifications")
      .update({ read_by: next })
      .eq("id", data.id);
    if (error) throw safeRpcError(error);
    return { ok: true };
  });

export const markAllAdminNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) return { count: 0 };
    const admin = await getSupabaseAdmin();
    const { data: rows, error: readErr } = await admin
      .from("admin_notifications")
      .select("id, read_by")
      .not("read_by", "cs", `{${context.userId}}`);
    if (readErr) throw new Error(readErr.message);
    let count = 0;
    for (const r of rows ?? []) {
      const current: string[] = Array.isArray(r.read_by) ? (r.read_by as string[]) : [];
      if (current.includes(context.userId)) continue;
      const next = Array.from(new Set([...current, context.userId]));
      const { error } = await admin
        .from("admin_notifications")
        .update({ read_by: next })
        .eq("id", r.id);
      if (!error) count++;
    }
    return { count };
  });