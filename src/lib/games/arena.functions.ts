import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ARENA_BET_STEP,
  ARENA_CHARACTERS,
  ARENA_MAX_BET,
  ARENA_MIN_BET,
  type ArenaCharacterId,
  type ArenaCombatEvent,
  type ArenaRoundResult,
} from "./arena.shared";

const PlayInput = z.object({
  bet: z
    .number()
    .int()
    .min(ARENA_MIN_BET)
    .max(ARENA_MAX_BET)
    .refine((n) => n % ARENA_BET_STEP === 0, {
      message: `bet must be a multiple of ${ARENA_BET_STEP}`,
    }),
  character: z.enum(ARENA_CHARACTERS as unknown as [ArenaCharacterId, ...ArenaCharacterId[]]),
  client_action_id: z.string().uuid(),
  odds_perm: z
    .tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()])
    .refine(
      (p) => {
        const seen = new Set<number>();
        for (const v of p) {
          if (v < 1 || v > 4) return false;
          if (seen.has(v)) return false;
          seen.add(v);
        }
        return true;
      },
      { message: "odds_perm must be a permutation of [1,2,3,4]" },
    )
    .optional(),
});

/**
 * Single-shot arena fight. All money + RNG logic lives in `play_arena_v1`
 * (Postgres SECURITY DEFINER). This wrapper only validates input, calls the
 * RPC under the user's auth context, and reshapes the payload for the UI.
 *
 * Idempotent on `client_action_id`. Retries return the cached result and
 * never move the balance twice.
 */
export const playArena = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PlayInput.parse(input))
  .handler(async ({ data, context }): Promise<ArenaRoundResult> => {
    const { supabase, userId } = context;
    const { bet, character, client_action_id, odds_perm } = data;

    const { data: raw, error } = await supabase.rpc("play_arena_v1", {
      p_user_id: userId,
      p_bet_amount: bet,
      p_character: character,
      p_client_action_id: client_action_id,
      p_odds_perm: odds_perm ?? undefined,
    });

    if (error) {
      // Map known RPC exceptions to friendly Spanish messages.
      const msg = error.message ?? "";
      if (msg.includes("insufficient_funds")) throw new Error("Saldo insuficiente");
      if (msg.includes("invalid_bet")) throw new Error("Apuesta inválida");
      if (msg.includes("invalid_character")) throw new Error("Personaje inválido");
      throw new Error("No se pudo procesar la pelea. Intenta de nuevo.");
    }

    const payload = raw as {
      was_duplicate: boolean;
      new_balance: number;
      round_id?: string;
      cached: {
        character_bet: ArenaCharacterId;
        winner: ArenaCharacterId;
        won: boolean;
        multiplier: number;
        payout: number;
        bet_amount: number;
        odds_snapshot: Record<ArenaCharacterId, number>;
        combat_log: ArenaCombatEvent[];
        server_seed: string;
        server_seed_hash: string;
      };
    };

    const c = payload.cached;
    return {
      was_duplicate: payload.was_duplicate,
      new_balance: Number(payload.new_balance),
      round_id: payload.round_id,
      character_bet: c.character_bet,
      winner: c.winner,
      won: c.won,
      multiplier: Number(c.multiplier),
      payout: Number(c.payout),
      bet_amount: Number(c.bet_amount),
      odds_snapshot: c.odds_snapshot,
      combat_log: c.combat_log ?? [],
      server_seed: c.server_seed,
      server_seed_hash: c.server_seed_hash,
    };
  });