import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getSupabaseAdmin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/**
 * Server-side helper: assert the calling user has the admin role.
 * Uses supabaseAdmin to bypass RLS for the role lookup.
 */
async function assertAdmin(userId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`role_check_failed: ${error.message}`);
  if (!data) throw new Error("not_admin");
}

/* -------------------------- Role check (client) -------------------------- */

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isAdmin: !!data };
  });

/* ------------------------------ Users list ------------------------------ */

const listUsersInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(["all", "active", "blocked", "verified", "unverified"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(50).default(20),
});

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listUsersInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabaseAdmin
      .from("admin_users_overview")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.search) {
      const s = data.search.toLowerCase();
      q = q.or(`email.ilike.%${s}%,username.ilike.%${s}%,id.ilike.%${s}%`);
    }
    if (data.status === "blocked") q = q.eq("is_blocked", true);
    else if (data.status === "active") q = q.eq("is_blocked", false);
    else if (data.status === "verified") q = q.eq("verification_status", "verified");
    else if (data.status === "unverified") q = q.neq("verification_status", "verified");

    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

/* ----------------------------- User detail ----------------------------- */

export const adminGetUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const [{ data: profile }, { data: bal }, { data: txs }, authUserRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("user_balances").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin
        .from("transactions")
        .select("type, amount, game, created_at")
        .eq("user_id", data.userId)
        .limit(2000),
      supabaseAdmin.auth.admin.getUserById(data.userId),
    ]);
    const authUser = "data" in authUserRes ? authUserRes.data.user : null;

    let totalBet = 0,
      totalWin = 0,
      totalDeposit = 0,
      totalWithdraw = 0;
    const gameCount: Record<string, number> = {};
    for (const t of txs ?? []) {
      const a = Number(t.amount) || 0;
      if (t.type === "bet") {
        totalBet += Math.abs(a);
        if (t.game) gameCount[t.game] = (gameCount[t.game] ?? 0) + 1;
      } else if (t.type === "win") totalWin += a;
      else if (t.type === "deposit") totalDeposit += a;
      else if (t.type === "withdrawal") totalWithdraw += Math.abs(a);
    }
    const favorite = Object.entries(gameCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      profile,
      balance: Number(bal?.balance ?? 0),
      bonus_balance: Number(bal?.bonus_balance ?? 0),
      stats: {
        totalBet,
        totalWin,
        totalDeposit,
        totalWithdraw,
        net: totalWin - totalBet,
        favorite,
      },
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      email: authUser?.email ?? profile?.email ?? null,
    };
  });

/* --------------------------- User transactions --------------------------- */

export const adminGetUserTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("transactions")
      .select("id, type, amount, balance_after, game, created_at, meta")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ----------------------------- Admin actions ----------------------------- */

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().refine((n) => n !== 0, "amount_required"),
        target: z.enum(["real", "bonus"]),
        reason: z.string().max(200).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: res, error } = await context.supabase.rpc("admin_adjust_balance", {
      p_target_user_id: data.userId,
      p_delta: data.amount,
      p_target: data.target,
      p_reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(res) ? res[0] : res;
    return {
      new_balance: Number(row?.new_balance ?? 0),
      new_bonus: Number(row?.new_bonus ?? 0),
    };
  });

export const adminSetBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), blocked: z.boolean() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await context.supabase.rpc("admin_set_block", {
      p_target_user_id: data.userId,
      p_blocked: data.blocked,
    });
    if (error) throw new Error(error.message);
    return { ok: true, blocked: data.blocked };
  });

export const adminAdjustXp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        delta: z.number().int().refine((n) => n !== 0, "delta_required"),
        reason: z.string().max(200).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: res, error } = await context.supabase.rpc("admin_adjust_xp", {
      p_target_user_id: data.userId,
      p_delta: data.delta,
      p_reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(res) ? res[0] : res;
    return {
      total_xp: Number(row?.total_xp ?? 0),
      current_level: Number(row?.current_level ?? 0),
    };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const uRes = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = "data" in uRes ? uRes.data.user?.email : undefined;
    if (!email) throw new Error("user_email_missing");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: context.userId,
      action: "reset_password",
      target_user_id: data.userId,
      meta: { email },
    });
    // Do NOT return the action_link to the client. The recovery link is a
    // single-use credential that grants account takeover; rely on the email
    // delivery only. We keep `link` invocation so Supabase sends the email.
    void link;
    return { ok: true };
  });

/* ------------------------------- RTP config ------------------------------- */

export const adminListRtp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("game_rtp_config")
      .select("*")
      .order("game");
    if (error) throw new Error(error.message);

    // Compute live RTP from last 30 days of transactions per game
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const { data: txs } = await supabaseAdmin
      .from("transactions")
      .select("game, type, amount")
      .gte("created_at", since)
      .in("type", ["bet", "win"]);
    const agg: Record<string, { bet: number; win: number }> = {};
    for (const t of txs ?? []) {
      if (!t.game) continue;
      agg[t.game] ??= { bet: 0, win: 0 };
      if (t.type === "bet") agg[t.game].bet += Math.abs(Number(t.amount));
      else if (t.type === "win") agg[t.game].win += Number(t.amount);
    }

    // Load updater usernames
    const ids = Array.from(new Set((rows ?? []).map((r: { updated_by: string | null }) => r.updated_by).filter(Boolean) as string[]));
    const updaters: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, username, email")
        .in("id", ids);
      for (const p of profs ?? []) updaters[p.id] = p.username ?? p.email ?? p.id.slice(0, 6);
    }

    return (rows ?? []).map((r: {
      game: string;
      updated_by: string | null;
      updated_at?: string | null;
      rtp_target?: number | null;
      is_active?: boolean | null;
      [key: string]: unknown;
    }) => {
      const a = agg[r.game];
      const live = a && a.bet > 0 ? Number(((a.win / a.bet) * 100).toFixed(2)) : null;
      return {
        ...r,
        rtp_live: live,
        updated_by_label: r.updated_by ? updaters[r.updated_by] ?? "Admin" : null,
      };
    });
  });

export const adminUpdateRtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        game: z.string().min(1).max(40),
        rtp_target: z.number().min(50).max(100),
        is_active: z.boolean().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin.rpc("admin_update_rtp", {
      p_game: data.game,
      p_rtp_target: data.rtp_target,
      p_is_active: data.is_active ?? undefined,
    });
    if (error) throw new Error(error.message);
    return row;
  });

/* ----------------------------- Casino stats ----------------------------- */

const rangeInput = z.object({
  range: z.enum(["today", "week", "month", "custom"]).default("today"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function resolveRange(input: z.infer<typeof rangeInput>) {
  const now = new Date();
  let from: Date;
  let to: Date = now;
  if (input.range === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else if (input.range === "week") {
    from = new Date(now.getTime() - 7 * 86400 * 1000);
  } else if (input.range === "month") {
    from = new Date(now.getTime() - 30 * 86400 * 1000);
  } else {
    from = input.from ? new Date(input.from) : new Date(now.getTime() - 86400 * 1000);
    to = input.to ? new Date(input.to) : now;
  }
  return { from, to };
}

export const adminGetCasinoStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const { from, to } = resolveRange(data);

    const { data: txs, error } = await supabaseAdmin
      .from("transactions")
      .select("type, amount, game, created_at")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .limit(50000);
    if (error) throw new Error(error.message);

    let bets = 0,
      wins = 0,
      deposits = 0,
      withdrawals = 0;
    const byGame: Record<string, { bet: number; win: number }> = {};
    for (const t of txs ?? []) {
      const a = Number(t.amount) || 0;
      if (t.type === "bet") {
        bets += Math.abs(a);
        if (t.game) {
          byGame[t.game] ??= { bet: 0, win: 0 };
          byGame[t.game].bet += Math.abs(a);
        }
      } else if (t.type === "win") {
        wins += a;
        if (t.game) {
          byGame[t.game] ??= { bet: 0, win: 0 };
          byGame[t.game].win += a;
        }
      } else if (t.type === "deposit") {
        deposits += a;
      } else if (t.type === "withdrawal") {
        withdrawals += Math.abs(a);
      }
    }

    const ggr = bets - wins; // gross gaming revenue
    const houseEdge = bets > 0 ? (ggr / bets) * 100 : 0;
    const games = Object.entries(byGame)
      .map(([game, v]) => ({
        game,
        bets: v.bet,
        wins: v.win,
        ggr: v.bet - v.win,
        rtp: v.bet > 0 ? Number(((v.win / v.bet) * 100).toFixed(2)) : 0,
        edge: v.bet > 0 ? Number((((v.bet - v.win) / v.bet) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.bets - a.bets);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: { bets, wins, ggr, deposits, withdrawals, houseEdge: Number(houseEdge.toFixed(2)) },
      games,
    };
  });

export const adminGetDashboardKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [{ count: totalUsers }, { data: todayTx }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("transactions")
        .select("type, amount")
        .gte("created_at", todayStart.toISOString()),
    ]);
    let bets = 0,
      wins = 0;
    for (const t of todayTx ?? []) {
      const a = Number(t.amount) || 0;
      if (t.type === "bet") bets += Math.abs(a);
      else if (t.type === "win") wins += a;
    }
    return {
      totalUsers: totalUsers ?? 0,
      betsToday: bets,
      ggrToday: bets - wins,
    };
  });