import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  SAMURAI_BET_STEP,
  SAMURAI_MAX_BET,
  SAMURAI_MIN_BET,
  type SamuraiSlotWin,
} from "./slot-samurai.shared";

const SpinInput = z.object({
  bet_amount: z
    .number()
    .int()
    .min(SAMURAI_MIN_BET)
    .max(SAMURAI_MAX_BET)
    .refine((n) => n % SAMURAI_BET_STEP === 0, {
      message: `bet must be a multiple of ${SAMURAI_BET_STEP}`,
    }),
  client_action_id: z.string().uuid(),
});

export type SamuraiSpinResult = {
  grid: string[][];
  wins: SamuraiSlotWin[];
  total: number;
  bet_amount: number;
  new_balance: number;
  server_seed_hash: string;
  server_seed: string;
  was_duplicate: boolean;
};

export const spinSlotSamurai = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SpinInput.parse(input))
  .handler(async ({ data, context }): Promise<SamuraiSpinResult> => {
    const userId = context.userId;

    const { data: rpcData, error } = await (
      supabaseAdmin.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("spin_slot_samurai_v1", {
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
        wins: SamuraiSlotWin[];
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