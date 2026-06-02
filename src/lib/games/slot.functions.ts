import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  SLOT_BET_STEP,
  SLOT_MAX_BET,
  SLOT_MIN_BET,
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
  // server_seed revealed at settle time (slot rounds settle instantly)
  server_seed: string;
  was_duplicate: boolean;
};

export const spinSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SpinInput.parse(input))
  .handler(async ({ data, context }): Promise<SpinResult> => {
    const userId = context.userId;

    // ONE round-trip: the SQL function `spin_slot_v1` runs the entire spin
    // atomically (lock balance → validate → RNG → evaluate → debit → credit
    // → record txs) and returns the full outcome. Same idempotency
    // contract as before: replaying with the same client_action_id returns
    // the cached result without re-mutating the balance.
    const { data: rpcData, error } = await (
      supabaseAdmin.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("spin_slot_v1", {
      p_user_id: userId,
      p_bet_amount: data.bet_amount,
      p_client_action_id: data.client_action_id,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("insufficient_funds")) throw new Error("Saldo insuficiente");
      if (msg.includes("invalid_bet")) throw new Error("Apuesta inválida");
      if (msg.includes("balance_row_missing")) throw new Error("Cuenta sin saldo inicializado");
      throw new Error(`spin_failed: ${msg}`);
    }

    const payload = rpcData as {
      was_duplicate: boolean;
      new_balance: number | string;
      cached: {
        grid: string[][];
        wins: SlotWin[];
        total: number;
        bet_amount: number;
        server_seed_hash: string;
        server_seed: string;
      };
    } | null;

    if (!payload || !payload.cached || !payload.cached.grid) {
      throw new Error("spin_no_result");
    }

    return {
      grid: payload.cached.grid,
      wins: payload.cached.wins ?? [],
      total: Number(payload.cached.total ?? 0),
      bet_amount: Number(payload.cached.bet_amount ?? data.bet_amount),
      new_balance: Number(payload.new_balance),
      server_seed_hash: payload.cached.server_seed_hash,
      server_seed: payload.cached.server_seed,
      was_duplicate: Boolean(payload.was_duplicate),
    };
  });