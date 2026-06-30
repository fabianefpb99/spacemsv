import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FavoriteGame = { game: string; plays: number };

export const getMyFavoriteGames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FavoriteGame[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("transactions")
      .select("game")
      .eq("user_id", userId)
      .eq("type", "bet")
      .not("game", "is", null)
      .limit(2000);
    if (error || !Array.isArray(data)) return [];
    const counts = new Map<string, number>();
    for (const row of data) {
      const g = (row as { game: string | null }).game;
      if (!g) continue;
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([game, plays]) => ({ game, plays }))
      .sort((a, b) => b.plays - a.plays);
  });