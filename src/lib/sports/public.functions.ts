import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public read-only server function for sports match details.
 *
 * Uses the publishable (anon) key + narrow public SELECT policy on
 * `sports_matches` (is_published = true). Only safe columns are projected —
 * no admin flags, no bet aggregates, no internal timestamps beyond start_at.
 * Input is validated as UUID before any query hits the DB.
 */

const input = z.object({ id: z.string().uuid() });

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export type PublicMatchRow = {
  id: string;
  slug: string;
  home_name: string;
  home_flag_code: string;
  away_name: string;
  away_flag_code: string;
  start_at: string;
  status: "scheduled" | "live" | "finished" | "cancelled";
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  competition_name: string | null;
};

export const getPublicMatch = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }): Promise<{ match: PublicMatchRow | null }> => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("sports_matches")
      .select(
        "id, slug, home_name, home_flag_code, away_name, away_flag_code, start_at, status, odds_home, odds_draw, odds_away, competition:sports_competitions(name)",
      )
      .eq("id", data.id)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      // Do not leak DB details to public callers.
      return { match: null };
    }
    if (!row) return { match: null };

    const comp = (row as unknown as { competition: { name: string } | null }).competition;
    return {
      match: {
        id: row.id,
        slug: row.slug,
        home_name: row.home_name,
        home_flag_code: row.home_flag_code,
        away_name: row.away_name,
        away_flag_code: row.away_flag_code,
        start_at: row.start_at,
        status: row.status as PublicMatchRow["status"],
        odds_home: Number(row.odds_home),
        odds_draw: Number(row.odds_draw),
        odds_away: Number(row.odds_away),
        competition_name: comp?.name ?? null,
      },
    };
  });