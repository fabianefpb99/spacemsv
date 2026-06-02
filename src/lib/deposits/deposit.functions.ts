import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("not_admin");
}

/* ---------- User-facing ---------- */

export const createDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    amount: z.number().int().min(1000).max(5_000_000),
    bonus: z.number().int().min(0).max(5_000_000),
    method: z.enum(["nequi", "breb"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const token = bearer();
    if (!token) {
      console.error("[createDeposit] missing bearer", { userId: context.userId });
      throw new Error("missing_auth_token");
    }
    const supa = userClient(token);
    const { data: row, error } = await supa.rpc("create_deposit_request", {
      p_amount: data.amount, p_bonus: data.bonus, p_method: data.method,
    });
    if (error) {
      console.error("[createDeposit] RPC error", {
        userId: context.userId, code: error.code, message: error.message, details: error.details,
      });
      throw new Error(error.message);
    }
    return row;
  });

export const confirmDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    payer_self: z.boolean(),
    first_name: z.string().trim().max(80).optional().nullable(),
    last_name: z.string().trim().max(80).optional().nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const token = bearer();
    if (!token) {
      console.error("[confirmDeposit] missing bearer", { userId: context.userId, depositId: data.id });
      throw new Error("missing_auth_token");
    }
    const supa = userClient(token);
    const ip = getRequestHeader("cf-connecting-ip")
      ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim()
      ?? null;
    const { data: row, error } = await supa.rpc("confirm_deposit_request", {
      p_id: data.id,
      p_payer_self: data.payer_self,
      p_first_name: data.first_name ?? null,
      p_last_name: data.last_name ?? null,
      p_phone: data.phone ?? null,
      p_ip: ip,
    });
    if (error) {
      console.error("[confirmDeposit] RPC error", {
        userId: context.userId, depositId: data.id,
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
      throw new Error(error.message);
    }
    console.log("[confirmDeposit] success", { userId: context.userId, depositId: data.id, status: row?.status });
    return row;
  });

export const getMyDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("deposit_requests").select("*")
      .eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("deposit_requests").select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelMyDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supa = userClient(bearer());
    const { data: row, error } = await supa.rpc("cancel_deposit_request", { p_id: data.id });
    if (error) throw new Error(error.message);
    return row;
  });

export const getMyPendingReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("deposit_requests").select("*")
      .eq("user_id", context.userId)
      .eq("status", "pendiente_revision")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

/* ---------- Admin ---------- */

const adminListInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(["all","pendiente_pago","pendiente_revision","aprobada","rechazada","expirada"]).default("all"),
  method: z.enum(["all","nequi","breb"]).default("all"),
  range: z.enum(["today","week","month","all","custom"]).default("all"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(25),
});

export const adminListDeposits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => adminListInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabaseAdmin.from("deposit_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.method !== "all") q = q.eq("method", data.method);
    if (data.search) {
      const s = data.search;
      q = q.or(`reference.ilike.%${s}%,email.ilike.%${s}%,username.ilike.%${s}%,user_id.ilike.%${s}%`);
    }
    const now = new Date();
    let fromDt: Date | null = null;
    let toDt: Date | null = null;
    if (data.range === "today") { fromDt = new Date(now); fromDt.setHours(0,0,0,0); }
    else if (data.range === "week") fromDt = new Date(now.getTime() - 7*86400_000);
    else if (data.range === "month") fromDt = new Date(now.getTime() - 30*86400_000);
    else if (data.range === "custom") {
      if (data.from) fromDt = new Date(data.from);
      if (data.to) toDt = new Date(data.to);
    }
    if (fromDt) q = q.gte("created_at", fromDt.toISOString());
    if (toDt) q = q.lte("created_at", toDt.toISOString());

    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const adminGetDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("deposit_requests").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminApproveDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supa = userClient(bearer());
    const { data: row, error } = await supa.rpc("admin_approve_deposit", { p_id: data.id });
    if (error) throw new Error(error.message);
    return row;
  });

export const adminRejectDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    reason: z.string().trim().min(3).max(300),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supa = userClient(bearer());
    const { data: row, error } = await supa.rpc("admin_reject_deposit", {
      p_id: data.id, p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const adminPendingDepositsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { count, error } = await supabaseAdmin
      .from("deposit_requests").select("id", { count: "exact", head: true })
      .eq("status", "pendiente_revision");
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });