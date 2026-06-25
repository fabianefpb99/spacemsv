import { createServerFn } from "@tanstack/react-start";

export type RecentWin = {
  user_id: string;
  username: string;
  avatar_key: string | null;
  game: string;
  amount: number;
  created_at: string;
};

export const getRecentPublicWins = createServerFn({ method: "GET" }).handler(
  async (): Promise<RecentWin[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_recent_public_wins", {
      p_limit: 20,
    });
    if (error) return [];
    if (!Array.isArray(data)) return [];
    return data.map((r: any) => ({
      user_id: String(r.user_id),
      username: String(r.username ?? "Jugador"),
      avatar_key: r.avatar_key ?? null,
      game: String(r.game ?? "casino"),
      amount: Number(r.amount ?? 0),
      created_at: String(r.created_at),
    }));
  },
);