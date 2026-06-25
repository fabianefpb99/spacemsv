import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  generateFillers,
  getColombiaParts,
  type FillerEntry,
} from "@/lib/fillers";

export type RankingEntry = {
  user_id: string;
  username: string;
  avatar_key: string | null;
  net_amount: number;
};

/**
 * Merge real + filler entries, sort by amount desc, take top N.
 * Stable: when amounts tie, reals (passed first) keep precedence.
 */
function mergeAndTop(
  reals: RankingEntry[],
  fillers: FillerEntry[],
  top: number,
): RankingEntry[] {
  const tagged = [
    ...reals.map((e, i) => ({ e, real: 1, i })),
    ...fillers.map((e, i) => ({
      e: e as RankingEntry,
      real: 0,
      i: reals.length + i,
    })),
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

    if (realRank == null || myNet <= 0) {
      return { rank: null as number | null, net_amount: myNet };
    }
    return { rank: realRank + fillersAhead, net_amount: myNet };
  });