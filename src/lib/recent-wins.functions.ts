import { createServerFn } from "@tanstack/react-start";
import { resolveAvatarUrls } from "@/lib/avatars.server";

export type RecentWin = {
  user_id: string;
  username: string;
  avatar_key: string | null;
  avatar_url?: string | null;
  game: string;
  amount: number;
  multiplier: number;
  created_at: string;
};

export const getRecentPublicWins = createServerFn({ method: "GET" }).handler(
  async (): Promise<RecentWin[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc(
      "get_recent_public_wins",
      { p_limit: 20 },
    );
    if (error) return [];
    if (!Array.isArray(data)) return [];
    const rows: RecentWin[] = data.map((r: any) => ({
      user_id: String(r.user_id),
      username: String(r.username ?? "Jugador"),
      avatar_key: r.avatar_key ?? null,
      game: String(r.game ?? "casino"),
      amount: Number(r.amount ?? 0),
      multiplier: Number(r.multiplier ?? 1),
      created_at: String(r.created_at),
    }));
    const urlMap = await resolveAvatarUrls(rows.map((r) => r.avatar_key));
    return rows.map((r) => ({
      ...r,
      avatar_url: r.avatar_key ? urlMap.get(r.avatar_key) ?? null : null,
    }));
  },
);