import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DICE_BET_STEP,
  DICE_MAX_BET,
  DICE_MIN_BET,
  DICE_MULTS,
  diceWinProb,
  type DiceRollResult,
} from "./dice.shared";
import {
  adjustBalance,
  cryptoRandomInt,
  deriveActionId,
  getBalance,
  newServerSeed,
  sha256Hex,
} from "./engine.server";
import { isBoostTarget } from "./boost.server";

const RollInput = z.object({
  bet: z
    .number()
    .int()
    .min(DICE_MIN_BET)
    .max(DICE_MAX_BET)
    .refine((n) => n % DICE_BET_STEP === 0, {
      message: `bet must be a multiple of ${DICE_BET_STEP}`,
    }),
  side: z.enum(["low", "high"]),
  mult: z
    .number()
    .refine((n) => (DICE_MULTS as readonly number[]).includes(n), {
      message: "invalid multiplier",
    }),
  client_action_id: z.string().uuid(),
});

/**
 * Stateless single-shot dice roll.
 *
 * Flow (atomic from the player's POV):
 *   1. Validate input (zod) and ensure user is signed in (middleware).
 *   2. Debit the bet via adjust_balance — idempotent on client_action_id,
 *      rejects with `insufficient_funds` if balance is too low.
 *   3. Decide win/loss with crypto-grade RNG using diceWinProb(mult).
 *   4. Pick a face consistent with the outcome and the chosen side.
 *   5. If won, credit floor(bet * mult) using a derived idempotent id.
 *   6. Return the final balance + reveal seed.
 *
 * The client may retry the same client_action_id safely; the balance never
 * moves twice.
 */
export const diceRoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RollInput.parse(input))
  .handler(async ({ data, context }): Promise<DiceRollResult> => {
    const userId = context.userId;
    const { bet, side, mult, client_action_id } = data;

    // Debit (idempotent). If retried with the same id, the SQL function
    // returns was_duplicate=true without moving the balance again. We still
    // re-derive the outcome from the seed deterministically below.
    const serverSeed = newServerSeed();
    const serverSeedHash = sha256Hex(serverSeed);

    const debit = await adjustBalance({
      user_id: userId,
      delta: -bet,
      type: "bet",
      game: "dice",
      client_action_id,
      meta: {
        kind: "dice_bet",
        bet,
        side,
        mult,
        server_seed_hash: serverSeedHash,
      },
    }).catch((err) => {
      if (err instanceof Error && err.message === "insufficient_funds") {
        throw new Error("Saldo insuficiente");
      }
      throw err;
    });

    // If the user double-submitted the same action, return the cached result
    // shape without re-rolling. We don't have the original roll persisted
    // separately — the original transaction is the dedupe anchor — so we
    // simply return the current balance and a "no payout" view for the
    // retried request. The original request's response is what mattered.
    if (debit.was_duplicate) {
      const balance = await getBalance(userId);
      return {
        roll: 0,
        won: false,
        payout: 0,
        multiplier: mult,
        side,
        bet,
        server_seed_hash: serverSeedHash,
        server_seed: serverSeed,
        new_balance: balance,
      };
    }

    // ── RNG ─────────────────────────────────────────────────────────────
    // Win probability is stored as 2-decimal fractions; multiply by 10_000
    // to get an integer threshold for cryptoRandomInt(10000).
    const winProb = diceWinProb(mult);
    const threshold = Math.round(winProb * 10000);
    let won = cryptoRandomInt(10000) < threshold;

    // Boost: si el jugador es target de la sesión activa, forzamos victoria.
    if (!won && (await isBoostTarget(userId, "dice"))) {
      won = true;
    }

    // Pick face consistent with both `side` and outcome.
    //   side=low  ⇒ win means face ∈ {1,2,3}, loss means face ∈ {4,5,6}
    //   side=high ⇒ win means face ∈ {4,5,6}, loss means face ∈ {1,2,3}
    const winsLow = (side === "low" && won) || (side === "high" && !won);
    const face = winsLow ? 1 + cryptoRandomInt(3) : 4 + cryptoRandomInt(3);

    let newBalance = debit.new_balance;
    let payout = 0;
    if (won) {
      payout = Math.floor(bet * mult);
      const credit = await adjustBalance({
        user_id: userId,
        delta: payout,
        type: "win",
        game: "dice",
        client_action_id: deriveActionId(client_action_id, "win"),
        meta: {
          kind: "dice_win",
          bet,
          side,
          mult,
          roll: face,
          server_seed_hash: serverSeedHash,
        },
      });
      newBalance = credit.new_balance;
    }

    return {
      roll: face,
      won,
      payout,
      multiplier: mult,
      side,
      bet,
      server_seed_hash: serverSeedHash,
      server_seed: serverSeed,
      new_balance: newBalance,
    };
  });