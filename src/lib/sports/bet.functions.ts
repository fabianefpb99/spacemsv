import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeRpcError } from "@/lib/server-safe-error";

/**
 * Place a sports bet for the currently-signed-in user.
 *
 * Security posture:
 * - `requireSupabaseAuth` guarantees `context.userId` is trusted (validated
 *   bearer). The client never gets to pick which user_id is charged.
 * - The actual write goes through the `sports_place_bet` SECURITY DEFINER
 *   RPC, which locks the match + user_balances rows, re-reads the odds
 *   from the DB (client-provided odds are IGNORED), validates the match
 *   is still open, debits the balance, inserts into sports_bets and
 *   writes a transactions row atomically.
 * - Errors are sanitized via `safeRpcError` so we never leak schema names.
 */

const placeInput = z.object({
  matchId: z.string().uuid(),
  selection: z.enum(["home", "draw", "away"]),
  stake: z.number().int().min(1000).max(5_000_000),
});

export const placeSportsBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => placeInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: betId, error } = await supabase.rpc("sports_place_bet", {
      _match_id: data.matchId,
      _selection: data.selection,
      _stake: data.stake,
    });
    if (error) throw safeRpcError(error);
    return { betId: betId as string };
  });

export type MyBetRow = {
  id: string;
  match_id: string;
  selection: "home" | "draw" | "away";
  stake: number;
  odds: number;
  potential_payout: number;
  payout: number | null;
  status: "pending" | "won" | "lost" | "refunded";
  created_at: string;
  home_name: string;
  away_name: string;
  home_flag_code: string;
  away_flag_code: string;
  start_at: string;
  match_status: "scheduled" | "live" | "finished" | "cancelled";
};

export const getMySportsBets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ bets: MyBetRow[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sports_bets")
      .select(
        "id, match_id, selection, stake, odds, potential_payout, payout, status, created_at, match:sports_matches(home_name, away_name, home_flag_code, away_flag_code, start_at, status)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw safeRpcError(error);
    const rows: MyBetRow[] = (data ?? []).map((r: unknown) => {
      const row = r as {
        id: string;
        match_id: string;
        selection: MyBetRow["selection"];
        stake: number | string;
        odds: number | string;
        potential_payout: number | string;
        payout: number | string | null;
        status: MyBetRow["status"];
        created_at: string;
        match: {
          home_name: string;
          away_name: string;
          home_flag_code: string;
          away_flag_code: string;
          start_at: string;
          status: MyBetRow["match_status"];
        } | null;
      };
      return {
        id: row.id,
        match_id: row.match_id,
        selection: row.selection,
        stake: Number(row.stake),
        odds: Number(row.odds),
        potential_payout: Number(row.potential_payout),
        payout: row.payout == null ? null : Number(row.payout),
        status: row.status,
        created_at: row.created_at,
        home_name: row.match?.home_name ?? "—",
        away_name: row.match?.away_name ?? "—",
        home_flag_code: row.match?.home_flag_code ?? "",
        away_flag_code: row.match?.away_flag_code ?? "",
        start_at: row.match?.start_at ?? row.created_at,
        match_status: row.match?.status ?? "scheduled",
      };
    });
    return { bets: rows };
  });