import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adjustBalance,
  deriveActionId,
  getTransactionById,
  newServerSeed,
  setTransactionMeta,
  sha256Hex,
  weightedPick,
} from "./engine.server";
import {
  evaluateSlotGrid,
  SLOT_BET_STEP,
  SLOT_LINES,
  SLOT_MAX_BET,
  SLOT_MIN_BET,
  SLOT_REELS,
  SLOT_ROWS,
  SLOT_SYMBOLS,
  type SlotWin,
} from "./slot.shared";

const SpinInput = z.object({
  bet_amount: z
    .number()
    .int()
    .min(SLOT_MIN_BET)
    .max(SLOT_MAX_BET)
    .refine((n) => n % SLOT_BET_STEP === 0, {
      message: `bet must be a multiple of ${SLOT_BET_STEP}`,
    }),
  client_action_id: z.string().uuid(),
});

export type SpinResult = {
  grid: string[][];
  wins: SlotWin[];
  total: number;
  bet_amount: number;
  new_balance: number;
  server_seed_hash: string;
  // server_seed only revealed after the round is closed (always closed for slot)
  server_seed: string;
  was_duplicate: boolean;
};

function generateSlotGrid(): string[][] {
  const ids = SLOT_SYMBOLS.map((s) => s.id);
  const weights = SLOT_SYMBOLS.map((s) => s.weight);
  return Array.from({ length: SLOT_REELS }, () =>
    Array.from({ length: SLOT_ROWS }, () => weightedPick(ids, weights)),
  );
}

export const spinSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SpinInput.parse(input))
  .handler(async ({ data, context }): Promise<SpinResult> => {
    const userId = context.userId;
    const lineBet = Math.max(1, Math.floor(data.bet_amount / SLOT_LINES));

    const serverSeed = newServerSeed();
    const serverSeedHash = sha256Hex(serverSeed);

    // 1. Debit the bet (idempotent on client_action_id)
    let debit;
    try {
      debit = await adjustBalance({
        user_id: userId,
        delta: -data.bet_amount,
        type: "bet",
        game: "slot",
        client_action_id: data.client_action_id,
        meta: { kind: "slot_bet", server_seed_hash: serverSeedHash },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "insufficient_funds") {
        throw new Error("Saldo insuficiente");
      }
      throw e;
    }

    // 2. Duplicate spin → return the cached outcome from the bet tx meta.
    if (debit.was_duplicate) {
      const tx = await getTransactionById(debit.transaction_id);
      const meta = (tx?.meta ?? {}) as { result?: SpinResult };
      if (meta.result) {
        return { ...meta.result, new_balance: debit.new_balance, was_duplicate: true };
      }
      throw new Error("duplicate_spin_without_result");
    }

    // 3. Generate the official grid using crypto RNG and evaluate it.
    const grid = generateSlotGrid();
    const { wins, total } = evaluateSlotGrid(grid, lineBet);

    // 4. Credit the win (also idempotent via derived action id).
    let newBalance = debit.new_balance;
    if (total > 0) {
      const winActionId = deriveActionId(data.client_action_id, "win");
      const credit = await adjustBalance({
        user_id: userId,
        delta: total,
        type: "win",
        game: "slot",
        client_action_id: winActionId,
        meta: {
          kind: "slot_win",
          bet_action_id: data.client_action_id,
          line_count: wins.length,
        },
      });
      newBalance = credit.new_balance;
    }

    const result: SpinResult = {
      grid,
      wins,
      total,
      bet_amount: data.bet_amount,
      new_balance: newBalance,
      server_seed_hash: serverSeedHash,
      server_seed: serverSeed,
      was_duplicate: false,
    };

    // 5. Persist the outcome inside the bet tx meta so retries return identically.
    try {
      await setTransactionMeta(debit.transaction_id, {
        kind: "slot_bet",
        server_seed_hash: serverSeedHash,
        server_seed: serverSeed,
        bet_amount: data.bet_amount,
        result,
      });
    } catch {
      // Best-effort: idempotency still works via the dedupe key; a missing
      // cached result on retry just throws a clean error to the client.
    }

    return result;
  });