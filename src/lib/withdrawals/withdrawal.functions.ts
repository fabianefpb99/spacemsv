import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

function userClient(token: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
}
function bearer() {
  const auth = getRequestHeader("Authorization") ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}
async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("not_admin");
}

/* ---------- User ---------- */

export const createWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    amount: z.number().int().min(20000).max(5_000_000),
    method: z.enum(["nequi", "breb"]),
    account_identifier: z.string().trim().min(4).max(80),
    account_label: z.string().trim().max(80).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const token = bearer();
    if (!token) throw new Error("missing_auth_token");
    const supa = userClient(token);
    const { data: row, error } = await supa.rpc("create_withdrawal_request", {
      p_amount: data.amount,
      p_method: data.method,
      p_account_identifier: data.account_identifier,
      p_account_label: data.account_label ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("withdrawal_requests").select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelMyWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supa = userClient(bearer());
    const { data: row, error } = await supa.rpc("cancel_withdrawal_request", { p_id: data.id });
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyWithdrawalAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("withdrawal_accounts").select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ---------- Admin ---------- */

const adminListInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(["all","pendiente","aprobada","rechazada","cancelada"]).default("pendiente"),
  method: z.enum(["all","nequi","breb"]).default("all"),
  range: z.enum(["today","week","month","all"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(25),
});

export const adminListWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => adminListInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabaseAdmin.from("withdrawal_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.method !== "all") q = q.eq("method", data.method);
    if (data.search) {
      const s = data.search;
      q = q.or(`email.ilike.%${s}%,username.ilike.%${s}%,account_identifier.ilike.%${s}%,user_id.ilike.%${s}%`);
    }
    const now = new Date();
    let fromDt: Date | null = null;
    if (data.range === "today") { fromDt = new Date(now); fromDt.setHours(0,0,0,0); }
    else if (data.range === "week") fromDt = new Date(now.getTime() - 7*86400_000);
    else if (data.range === "month") fromDt = new Date(now.getTime() - 30*86400_000);
    if (fromDt) q = q.gte("created_at", fromDt.toISOString());
    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const adminGetWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("withdrawal_requests").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminApproveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supa = userClient(bearer());
    const { data: row, error } = await supa.rpc("admin_approve_withdrawal", { p_id: data.id });
    if (error) throw new Error(error.message);
    return row;
  });

export const adminRejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    reason: z.string().trim().min(3).max(300),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supa = userClient(bearer());
    const { data: row, error } = await supa.rpc("admin_reject_withdrawal", {
      p_id: data.id, p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const adminPendingWithdrawalsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("withdrawal_requests").select("id", { count: "exact", head: true })
      .eq("status", "pendiente");
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });