import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RankingEntry = {
  user_id: string;
  username: string;
  avatar_key: string | null;
  net_amount: number;
};

/* ───────── Filler players (deterministic per day, Colombia tz) ───────── */

const FILLER_USERNAMES: string[] = [
  "luna_84", "kr1tyk", "andrxs07", "mariana.r", "betkingco",
  "daniela.m", "santi.cruz", "valeria_88", "jhonatan.q", "camilo.bet",
  "nayeli.x", "alejo_777", "carolina_v", "diegoz", "manu_galindo",
  "isa.b", "tato_99", "laura.fdz", "kevin.ace", "sofia_pro",
  "monica.r", "rafa_85", "yulianamx", "elkin.bet", "natalia_c",
  "jorge.win", "vivi.rivera", "fabio_jr", "salomon.k", "milena_07",
];

const FILLER_AVATAR_KEYS = [
  "avatar-1", "avatar-2", "avatar-3", "avatar-4",
  "avatar-5", "avatar-6", "avatar-7", "avatar-8",
];

function getColombiaParts(): { dateKey: string; hour: number } {
  // Colombia is UTC-5, no DST.
  const now = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return { dateKey: `${y}-${m}-${d}`, hour: now.getUTCHours() };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleTake<T>(arr: readonly T[], n: number, rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

/**
 * Smooth progress factor over the Colombia day:
 *  - before 06:00 → 0.25 (overnight low activity carry-over)
 *  - 06:00 → 0.25, 23:00 → 1.0 (linear ramp)
 */
function progressFactor(hour: number): number {
  if (hour < 6) return 0.25;
  if (hour >= 23) return 1.0;
  return 0.25 + ((hour - 6) / (23 - 6)) * 0.75;
}

function generateFillers(
  kind: "general" | "arena",
  count: number,
  dateKey: string,
  hour: number,
): RankingEntry[] {
  const rnd = mulberry32(hashString(`${dateKey}:${kind}`));
  const names = shuffleTake(FILLER_USERNAMES, count, rnd);
  const avatars = shuffleTake(FILLER_AVATAR_KEYS, count, rnd);

  // COP max amount ranges per kind.
  const range =
    kind === "general"
      ? { min: 80_000, max: 650_000 }
      : { min: 30_000, max: 220_000 };

  const factor = progressFactor(hour);

  // Decreasing max amounts so the top filler is clearly ahead.
  const out: RankingEntry[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1); // 0 (top) → 1 (bottom)
    // Slight per-slot jitter (±6%) so amounts feel organic, still deterministic.
    const jitter = 0.94 + rnd() * 0.12;
    const baseMax = range.max - (range.max - range.min) * t;
    const max = baseMax * jitter;
    const current = Math.max(1_000, Math.round((max * factor) / 100) * 100);
    out.push({
      user_id: `filler:${kind}:${i}:${dateKey}`,
      username: names[i] ?? `player_${i + 1}`,
      avatar_key: avatars[i % avatars.length] ?? null,
      net_amount: current,
    });
  }
  return out;
}

/**
 * Merge real + filler entries, sort by amount desc, take top N.
 * Stable: when amounts tie, reals (passed first) keep precedence.
 */
function mergeAndTop(
  reals: RankingEntry[],
  fillers: RankingEntry[],
  top: number,
): RankingEntry[] {
  const tagged = [
    ...reals.map((e, i) => ({ e, real: 1, i })),
    ...fillers.map((e, i) => ({ e, real: 0, i: reals.length + i })),
  ];
  tagged.sort((a, b) => {
    if (b.e.net_amount !== a.e.net_amount) return b.e.net_amount - a.e.net_amount;
    if (b.real !== a.real) return b.real - a.real; // reals win ties
    return a.i - b.i;
  });
  return tagged.slice(0, top).map((t) => t.e);
}

export const getRankingPublic = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ winners: RankingEntry[]; arena: RankingEntry[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [winnersRes, arenaRes] = await Promise.all([
      supabaseAdmin.rpc("get_today_top_winners", { p_limit: 10 }),
      supabaseAdmin.rpc("get_today_top_arena", { p_limit: 10 }),
    ]);

    const toEntries = (rows: unknown): RankingEntry[] =>
      Array.isArray(rows)
        ? rows.map((r: any) => ({
            user_id: String(r.user_id),
            username: String(r.username ?? "Jugador"),
            avatar_key: r.avatar_key ?? null,
            net_amount: Number(r.net_amount ?? 0),
          }))
        : [];

    const { dateKey, hour } = getColombiaParts();
    const fillersGeneral = generateFillers("general", 5, dateKey, hour);
    const fillersArena = generateFillers("arena", 10, dateKey, hour);

    return {
      winners: mergeAndTop(toEntries(winnersRes.data), fillersGeneral, 10),
      arena: mergeAndTop(toEntries(arenaRes.data), fillersArena, 10),
    };
  },
);

export const getMyRankingPosition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_my_today_position");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : null;
    const realRank = row ? Number((row as any).rank) : null;
    const myNet = row ? Number((row as any).net_amount ?? 0) : 0;

    // Merge with deterministic fillers so the displayed position reflects
    // what the user actually sees on the public ranking board.
    const { dateKey, hour } = getColombiaParts();
    const fillers = generateFillers("general", 5, dateKey, hour);
    const fillersAhead = fillers.filter((f) => f.net_amount > myNet).length;

    if (realRank == null) {
      // User has no winnings today: they sit after all fillers that have
      // any amount (which, in practice, is all of them).
      return { rank: fillersAhead + 1, net_amount: myNet };
    }
    return { rank: realRank + fillersAhead, net_amount: myNet };
  });