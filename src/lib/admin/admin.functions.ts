import { safeRpcError } from "@/lib/server-safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAvatarUrls } from "@/lib/avatars.server";

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
    if (error) throw safeRpcError(error);
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
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRe.test(s)) {
        q = q.or(`email.ilike.%${s}%,username.ilike.%${s}%,id.eq.${s}`);
      } else {
        q = q.or(`email.ilike.%${s}%,username.ilike.%${s}%`);
      }
    }
    if (data.status === "blocked") q = q.eq("is_blocked", true);
    else if (data.status === "active") q = q.eq("is_blocked", false);
    else if (data.status === "verified") q = q.eq("verification_status", "verified");
    else if (data.status === "unverified") q = q.neq("verification_status", "verified");

    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw safeRpcError(error);
    const list = rows ?? [];
    const resolved = await resolveAvatarUrls(list.map((r) => (r as { avatar_key?: string | null }).avatar_key));
    const withAvatars = list.map((r) => {
      const key = (r as { avatar_key?: string | null }).avatar_key ?? null;
      return { ...(r as Record<string, unknown>), avatar_url: key ? resolved.get(key) ?? null : null };
    });
    return { rows: withAvatars, total: count ?? 0, page: data.page, pageSize: data.pageSize };
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
    const avatarKey = (profile as { avatar_key?: string | null } | null)?.avatar_key ?? null;
    const resolved = await resolveAvatarUrls([avatarKey]);
    const avatar_url = avatarKey ? resolved.get(avatarKey) ?? null : null;

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
      avatar_url,
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
    if (error) throw safeRpcError(error);
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
    // Use the authenticated user's client so auth.uid() resolves inside the RPC.
    const { data: res, error } = await context.supabase.rpc("admin_adjust_balance", {
      p_target_user_id: data.userId,
      p_delta: data.amount,
      p_target: data.target,
      p_reason: data.reason ?? "",
    });
    if (error) throw safeRpcError(error);
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
    // Use authenticated client so auth.uid() resolves inside the RPC.
    const { error } = await context.supabase.rpc("admin_set_block", {
      p_target_user_id: data.userId,
      p_blocked: data.blocked,
    });
    if (error) throw safeRpcError(error);
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
      p_reason: data.reason ?? "",
    });
    if (error) throw safeRpcError(error);
    const row = Array.isArray(res) ? res[0] : res;
    return {
      total_xp: Number(row?.out_total_xp ?? 0),
      current_level: Number(row?.out_current_level ?? 0),
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
    if (error) throw safeRpcError(error);
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
    if (error) throw safeRpcError(error);

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
    await assertAdmin(context.userId);
    const { data: row, error } = await context.supabase.rpc("admin_update_rtp", {
      p_game: data.game,
      p_rtp_target: data.rtp_target,
      p_is_active: data.is_active ?? undefined,
    });
    if (error) throw safeRpcError(error);
    return row;
  });

/* ----------------------------- Roulette config ----------------------------- */

export const adminGetRouletteConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("roulette_config")
      .select("id, green_weight, updated_at, updated_by")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw safeRpcError(error);

    let updated_by_label: string | null = null;
    if (row?.updated_by) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("username, email")
        .eq("id", row.updated_by)
        .maybeSingle();
      updated_by_label = prof?.username ?? prof?.email ?? row.updated_by.slice(0, 6);
    }

    return {
      id: row?.id ?? null,
      green_weight: Number(row?.green_weight ?? 1.0),
      updated_at: row?.updated_at ?? null,
      updated_by_label,
    };
  });

export const adminUpdateRouletteConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        green_weight: z.number().min(1).max(5).step(0.1),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);

    const { data: existing } = await supabaseAdmin
      .from("roulette_config")
      .select("id")
      .limit(1)
      .maybeSingle();

    const upsert = {
      id: existing?.id ?? undefined,
      green_weight: data.green_weight,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };

    const { data: row, error } = await supabaseAdmin
      .from("roulette_config")
      .upsert(upsert)
      .select("id, green_weight, updated_at, updated_by")
      .single();
    if (error) throw safeRpcError(error);

    let updated_by_label: string | null = null;
    if (row?.updated_by) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("username, email")
        .eq("id", row.updated_by)
        .maybeSingle();
      updated_by_label = prof?.username ?? prof?.email ?? row.updated_by.slice(0, 6);
    }

    return {
      id: row.id,
      green_weight: Number(row.green_weight),
      updated_at: row.updated_at,
      updated_by_label,
    };
  });

/* ----------------------------- Casino stats ----------------------------- */

const rangeInput = z.object({
  range: z.enum(["today", "week", "month", "3months", "6months", "all", "custom"]).default("today"),
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
  } else if (input.range === "3months") {
    from = new Date(now.getTime() - 90 * 86400 * 1000);
  } else if (input.range === "6months") {
    from = new Date(now.getTime() - 180 * 86400 * 1000);
  } else if (input.range === "all") {
    from = new Date(0);
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

    // Paginate to bypass PostgREST max-rows cap; otherwise long ranges
    // truncate and games added later (e.g. arena) get dropped from totals.
    type TxRow = { type: string; amount: number | string | null; game: string | null; created_at: string };
    const txs: TxRow[] = [];
    const pageSize = 1000;
    for (let pageStart = 0; ; pageStart += pageSize) {
      const { data: page, error } = await supabaseAdmin
        .from("transactions")
        .select("type, amount, game, created_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: true })
        .range(pageStart, pageStart + pageSize - 1);
      if (error) throw safeRpcError(error);
      if (!page || page.length === 0) break;
      txs.push(...(page as TxRow[]));
      if (page.length < pageSize) break;
      if (txs.length >= 200000) break; // safety cap
    }

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

/* --------------------- High winners alert (net casino P/L) --------------------- */

/**
 * Returns users whose net casino profit (sum(win) - sum(bet)) exceeds the
 * threshold. This is pure casino-derived profit and naturally excludes the
 * seeded initial real balance and deposits (those aren't `win` transactions).
 */
export const adminGetHighWinners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ threshold: z.number().min(1).max(10_000_000).default(50000) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    await assertAdmin(context.userId);

    // Paginate transactions to avoid PostgREST row cap.
    type TxRow = { user_id: string; type: string; amount: number | string | null };
    const perUser: Record<string, { bet: number; win: number }> = {};
    const pageSize = 1000;
    for (let start = 0; ; start += pageSize) {
      const { data: page, error } = await supabaseAdmin
        .from("transactions")
        .select("user_id, type, amount")
        .in("type", ["bet", "win"])
        .order("created_at", { ascending: true })
        .range(start, start + pageSize - 1);
      if (error) throw safeRpcError(error);
      if (!page || page.length === 0) break;
      for (const t of page as TxRow[]) {
        if (!t.user_id) continue;
        perUser[t.user_id] ??= { bet: 0, win: 0 };
        const a = Number(t.amount) || 0;
        if (t.type === "bet") perUser[t.user_id].bet += Math.abs(a);
        else if (t.type === "win") perUser[t.user_id].win += a;
      }
      if (page.length < pageSize) break;
      if (start > 500_000) break;
    }

    const winners = Object.entries(perUser)
      .map(([user_id, v]) => ({ user_id, bet: v.bet, win: v.win, net: v.win - v.bet }))
      .filter((u) => u.net >= data.threshold)
      .sort((a, b) => b.net - a.net)
      .slice(0, 50);

    if (winners.length === 0) return { winners: [] };

    const ids = winners.map((w) => w.user_id);
    const [{ data: profs }, { data: bals }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, email").in("id", ids),
      supabaseAdmin.from("user_balances").select("user_id, balance, bonus_balance").in("user_id", ids),
    ]);
    const profMap: Record<string, { username: string | null; email: string | null }> = {};
    for (const p of profs ?? []) profMap[p.id] = { username: p.username, email: p.email };
    const balMap: Record<string, { balance: number; bonus_balance: number }> = {};
    for (const b of bals ?? []) balMap[b.user_id] = { balance: Number(b.balance ?? 0), bonus_balance: Number(b.bonus_balance ?? 0) };

    return {
      winners: winners.map((w) => ({
        ...w,
        username: profMap[w.user_id]?.username ?? null,
        email: profMap[w.user_id]?.email ?? null,
        balance: balMap[w.user_id]?.balance ?? 0,
      })),
    };
  });