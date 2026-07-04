import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeRpcError } from "@/lib/server-safe-error";
import { WORLD_CUP_2026_TEAM_CODES } from "@/lib/sports/world-cup-2026-teams";

async function getSupabaseAdmin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

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

/* ============================================================
 * Types (mirror DB shape; keep client-safe)
 * ========================================================== */

export type SportsCompetition = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SportsMatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export type SportsMatch = {
  id: string;
  competition_id: string;
  competition_name: string | null;
  slug: string;
  home_name: string;
  home_flag_code: string;
  away_name: string;
  away_flag_code: string;
  start_at: string;
  status: SportsMatchStatus;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  home_score: number | null;
  away_score: number | null;
  is_featured: boolean;
  is_published: boolean;
  bets_closed_at: string | null;
  settled_at: string | null;
  cancelled_at: string | null;
  bet_count: number;
  bet_total_stake: number;
  created_at: string;
  updated_at: string;
};

/* ============================================================
 * Timezone setting
 * ========================================================== */

export const adminGetSportsTimezone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "sports_timezone")
      .maybeSingle();
    if (error) throw safeRpcError(error);
    const tz = typeof data?.value === "string" ? data.value : "America/Bogota";
    return { timezone: tz };
  });

const tzInput = z.object({ timezone: z.string().min(1).max(64) });

export const adminSetSportsTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tzInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // Validate the timezone by trying to use it
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: data.timezone }).format(new Date());
    } catch {
      throw new Error("invalid_timezone");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "sports_timezone", value: data.timezone as unknown as never }, { onConflict: "key" });
    if (error) throw safeRpcError(error);
    return { ok: true, timezone: data.timezone };
  });

/* ============================================================
 * Competitions
 * ========================================================== */

export const adminListCompetitions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("sports_competitions")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw safeRpcError(error);
    return { competitions: (data ?? []) as SportsCompetition[] };
  });

const competitionUpsertInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "slug_invalid"),
  name: z.string().trim().min(2).max(80),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

export const adminUpsertCompetition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => competitionUpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const payload = {
      slug: data.slug,
      name: data.name,
      is_active: data.is_active,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("sports_competitions")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw safeRpcError(error);
      return { competition: row as SportsCompetition };
    }
    const { data: row, error } = await supabaseAdmin
      .from("sports_competitions")
      .insert(payload)
      .select()
      .single();
    if (error) throw safeRpcError(error);
    return { competition: row as SportsCompetition };
  });

const competitionIdInput = z.object({ id: z.string().uuid() });

export const adminDeleteCompetition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => competitionIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { count, error: countErr } = await supabaseAdmin
      .from("sports_matches")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", data.id);
    if (countErr) throw safeRpcError(countErr);
    if ((count ?? 0) > 0) throw new Error("competition_has_matches");
    const { error } = await supabaseAdmin
      .from("sports_competitions")
      .delete()
      .eq("id", data.id);
    if (error) throw safeRpcError(error);
    return { ok: true };
  });

/* ============================================================
 * Matches
 * ========================================================== */

const listMatchesInput = z.object({
  competition_id: z.string().uuid().optional(),
  status: z.enum(["all", "scheduled", "live", "finished", "cancelled"]).default("all"),
});

export const adminListMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listMatchesInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();

    let q = supabaseAdmin
      .from("sports_matches")
      .select("*, competition:sports_competitions(name)")
      .order("start_at", { ascending: true });

    if (data.competition_id) q = q.eq("competition_id", data.competition_id);
    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw safeRpcError(error);

    const ids = (rows ?? []).map((r) => r.id);
    let aggByMatch = new Map<string, { count: number; stake: number }>();
    if (ids.length > 0) {
      const { data: bets, error: betsErr } = await supabaseAdmin
        .from("sports_bets")
        .select("match_id, stake")
        .in("match_id", ids);
      if (betsErr) throw safeRpcError(betsErr);
      for (const b of bets ?? []) {
        const prev = aggByMatch.get(b.match_id as string) ?? { count: 0, stake: 0 };
        prev.count += 1;
        prev.stake += Number(b.stake ?? 0);
        aggByMatch.set(b.match_id as string, prev);
      }
    }

    const matches: SportsMatch[] = (rows ?? []).map((r) => {
      const agg = aggByMatch.get(r.id) ?? { count: 0, stake: 0 };
      const comp = (r as unknown as { competition: { name: string } | null }).competition;
      return {
        id: r.id,
        competition_id: r.competition_id,
        competition_name: comp?.name ?? null,
        slug: r.slug,
        home_name: r.home_name,
        home_flag_code: r.home_flag_code,
        away_name: r.away_name,
        away_flag_code: r.away_flag_code,
        start_at: r.start_at,
        status: r.status as SportsMatchStatus,
        odds_home: Number(r.odds_home),
        odds_draw: Number(r.odds_draw),
        odds_away: Number(r.odds_away),
        home_score: r.home_score,
        away_score: r.away_score,
        is_featured: r.is_featured,
        is_published: r.is_published,
        bets_closed_at: r.bets_closed_at,
        settled_at: r.settled_at,
        cancelled_at: r.cancelled_at,
        bet_count: agg.count,
        bet_total_stake: agg.stake,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    return { matches };
  });

const matchUpsertInput = z.object({
  id: z.string().uuid().optional(),
  competition_id: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "slug_invalid"),
  home_name: z.string().trim().min(1).max(60),
  home_flag_code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => WORLD_CUP_2026_TEAM_CODES.has(v), "invalid_flag_code"),
  away_name: z.string().trim().min(1).max(60),
  away_flag_code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => WORLD_CUP_2026_TEAM_CODES.has(v), "invalid_flag_code"),
  // ISO string with timezone info
  start_at: z.string().datetime({ offset: true }),
  odds_home: z.number().min(1.01).max(999.99),
  odds_draw: z.number().min(1.01).max(999.99),
  odds_away: z.number().min(1.01).max(999.99),
  is_featured: z.boolean(),
  is_published: z.boolean(),
});

export const adminUpsertMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchUpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const payload = {
      competition_id: data.competition_id,
      slug: data.slug,
      home_name: data.home_name,
      home_flag_code: data.home_flag_code,
      away_name: data.away_name,
      away_flag_code: data.away_flag_code,
      start_at: data.start_at,
      odds_home: data.odds_home,
      odds_draw: data.odds_draw,
      odds_away: data.odds_away,
      is_featured: data.is_featured,
      is_published: data.is_published,
    };
    if (data.id) {
      // Guard: cannot edit odds/start after match is live/finished/cancelled
      const { data: current, error: cErr } = await supabaseAdmin
        .from("sports_matches")
        .select("status")
        .eq("id", data.id)
        .maybeSingle();
      if (cErr) throw safeRpcError(cErr);
      if (!current) throw new Error("match_not_found");
      if (current.status !== "scheduled") {
        throw new Error("match_locked_after_start");
      }
      const { data: row, error } = await supabaseAdmin
        .from("sports_matches")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw safeRpcError(error);
      return { match_id: row.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("sports_matches")
      .insert(payload)
      .select()
      .single();
    if (error) throw safeRpcError(error);
    return { match_id: row.id };
  });

const matchPatchInput = z.object({
  id: z.string().uuid(),
  is_featured: z.boolean().optional(),
  is_published: z.boolean().optional(),
});

export const adminPatchMatchFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchPatchInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const patch: { is_featured?: boolean; is_published?: boolean } = {};
    if (typeof data.is_featured === "boolean") patch.is_featured = data.is_featured;
    if (typeof data.is_published === "boolean") patch.is_published = data.is_published;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("sports_matches")
      .update(patch)
      .eq("id", data.id);
    if (error) throw safeRpcError(error);
    return { ok: true };
  });

const settleInput = z.object({
  id: z.string().uuid(),
  home_score: z.number().int().min(0).max(99),
  away_score: z.number().int().min(0).max(99),
});

export const adminSettleMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settleInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await context.supabase.rpc("sports_settle_match", {
      _match_id: data.id,
      _home_score: data.home_score,
      _away_score: data.away_score,
    });
    if (error) throw safeRpcError(error);
    return { ok: true };
  });

const idInput = z.object({ id: z.string().uuid() });

export const adminCancelMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await context.supabase.rpc("sports_cancel_match", { _match_id: data.id });
    if (error) throw safeRpcError(error);
    return { ok: true };
  });

export const adminUnsettleMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // Types are auto-generated; the new RPC is referenced by name.
    const { error } = await (context.supabase.rpc as (name: string, args: Record<string, unknown>) => Promise<{ error: unknown }>) (
      "sports_unsettle_match",
      { _match_id: data.id },
    );
    if (error) throw safeRpcError(error as { message?: string });
    return { ok: true };
  });

export const adminDeleteMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { count, error: cErr } = await supabaseAdmin
      .from("sports_bets")
      .select("id", { count: "exact", head: true })
      .eq("match_id", data.id);
    if (cErr) throw safeRpcError(cErr);
    if ((count ?? 0) > 0) throw new Error("match_has_bets");
    const { error } = await supabaseAdmin
      .from("sports_matches")
      .delete()
      .eq("id", data.id);
    if (error) throw safeRpcError(error);
    return { ok: true };
  });