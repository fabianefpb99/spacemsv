import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PerfilStats = {
  bets: number;
  won: number;
  withdrawn: number;
  favorite: string;
};

export const getPerfilStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PerfilStats> => {
    const { supabase, userId } = context;

    let bets = 0;
    let won = 0;
    let withdrawn = 0;
    const gameCounts: Record<string, number> = {};

    const PAGE = 1000;
    let from = 0;
    // Safety cap: 50 pages = 50k rows per user.
    for (let i = 0; i < 50; i++) {
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount, game")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) break;
      const rows = data ?? [];
      for (const r of rows) {
        const t = (r as { type: string }).type;
        const amt = Number((r as { amount: number | string }).amount) || 0;
        const g = (r as { game: string | null }).game;
        if (t === "bet") {
          bets++;
          if (g) gameCounts[g] = (gameCounts[g] ?? 0) + 1;
        } else if (t === "win") {
          won += amt;
        } else if (t === "withdrawal") {
          withdrawn += Math.abs(amt);
        }
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    const favorite =
      Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return { bets, won, withdrawn, favorite };
  });