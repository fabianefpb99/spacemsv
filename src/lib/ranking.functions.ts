import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RankingEntry = {
  user_id: string;
  username: string;
  avatar_key: string | null;
  net_amount: number;
};

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

    return {
      winners: toEntries(winnersRes.data),
      arena: toEntries(arenaRes.data),
    };
  },
);

export const getMyRankingPosition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_my_today_position");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return { rank: null as number | null, net_amount: 0 };
    return {
      rank: Number((row as any).rank),
      net_amount: Number((row as any).net_amount ?? 0),
    };
  });