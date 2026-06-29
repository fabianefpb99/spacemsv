import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CHICKEN_BET_STEP,
  CHICKEN_MAX_BET,
  CHICKEN_MAX_STEPS,
  CHICKEN_MIN_BET,
  chickenMultiplier,
  type ChickenPublicState,
} from "./chicken.shared";
import { placeBrokenSequence } from "./chicken.server";
import {
  adjustBalance,
  deriveActionId,
  getBalance,
  newServerSeed,
  sha256Hex,
} from "./engine.server";

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const BetSchema = z
  .number()
  .int()
  .min(CHICKEN_MIN_BET)
  .max(CHICKEN_MAX_BET)
  .refine((n) => n % CHICKEN_BET_STEP === 0, {
    message: `bet must be a multiple of ${CHICKEN_BET_STEP}`,
  });

const DealInput = z.object({
  bet: BetSchema,
  client_action_id: z.string().uuid(),
});

const JumpInput = z.object({
  session_id: z.string().uuid(),
  nonce: z.number().int().min(0),
  client_action_id: z.string().uuid(),
});

const CashoutInput = z.object({
  session_id: z.string().uuid(),
  nonce: z.number().int().min(0),
  client_action_id: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type ChickenSessionView = {
  session_id: string;
  nonce: number;
  status: "open" | "closed";
  public_state: ChickenPublicState;
  new_balance: number;
};

type SessionRow = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  bet_amount: number;
  state: { brokenSeq: boolean[] };
  public_state: ChickenPublicState;
  nonce: number;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

async function loadOpenSession(userId: string): Promise<SessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("game_sessions")
    .select("id, user_id, status, bet_amount, state, public_state, nonce")
    .eq("user_id", userId)
    .eq("game", "chicken")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`chicken_load_failed: ${error.message}`);
  if (!data) return null;
  return data as unknown as SessionRow;
}

async function loadSessionForUser(
  sessionId: string,
  userId: string,
): Promise<SessionRow> {
  const { data, error } = await supabaseAdmin
    .from("game_sessions")
    .select("id, user_id, status, bet_amount, state, public_state, nonce")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("game", "chicken")
    .maybeSingle();
  if (error) throw new Error(`chicken_load_failed: ${error.message}`);
  if (!data) throw new Error("chicken_session_not_found");
  return data as unknown as SessionRow;
}

/** Strip the future broken sequence from the public view. */
function maskPublic(pub: ChickenPublicState): ChickenPublicState {
  return pub;
}

async function applyAction(args: {
  session_id: string;
  user_id: string;
  expected_nonce: number;
  new_state: { brokenSeq: boolean[] };
  new_public_state: ChickenPublicState;
  new_status: "open" | "closed";
  new_payout?: number | null;
}): Promise<SessionRow> {
  const { data, error } = await (
    supabaseAdmin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )("bj_apply_action", {
    p_session_id: args.session_id,
    p_user_id: args.user_id,
    p_expected_nonce: args.expected_nonce,
    p_new_state: args.new_state,
    p_new_public_state: args.new_public_state,
    p_new_status: args.new_status,
    p_new_payout: args.new_payout ?? null,
  });
  if (error) {
    if (error.message?.includes("bj_stale_nonce")) {
      throw new Error("chicken_stale_nonce");
    }
    throw new Error(`chicken_apply_failed: ${error.message}`);
  }
  return data as unknown as SessionRow;
}

/* ------------------------------------------------------------------ */
/* Resume                                                               */
/* ------------------------------------------------------------------ */

export const chickenResume = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChickenSessionView | null> => {
    const userId = context.userId;
    const session = await loadOpenSession(userId);
    if (!session) return null;
    const balance = await getBalance(userId);
    return {
      session_id: session.id,
      nonce: session.nonce,
      status: session.status,
      public_state: maskPublic(session.public_state),
      new_balance: balance,
    };
  });

/* ------------------------------------------------------------------ */
/* Deal                                                                 */
/* ------------------------------------------------------------------ */

export const chickenDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DealInput.parse(input))
  .handler(async ({ data, context }): Promise<ChickenSessionView> => {
    const userId = context.userId;
    const { bet, client_action_id } = data;

    // 1. Close any leftover open session.
    const existing = await loadOpenSession(userId);
    if (existing) {
      await supabaseAdmin
        .from("game_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    // 2. Debit (idempotent).
    const debit = await adjustBalance({
      user_id: userId,
      delta: -bet,
      type: "bet",
      game: "chicken",
      client_action_id,
      meta: { kind: "chicken_bet", bet },
    }).catch((err) => {
      if (err instanceof Error && err.message === "insufficient_funds") {
        throw new Error("Saldo insuficiente");
      }
      throw err;
    });

    // 3. Pre-generate the full broken sequence.
    const serverSeed = newServerSeed();
    const serverSeedHash = sha256Hex(serverSeed);
    const brokenSeq = placeBrokenSequence();

    const publicState: ChickenPublicState = {
      bet,
      step: 0,
      multiplier: 1,
      nextMultiplier: chickenMultiplier(1),
      phase: "playing",
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("game_sessions")
      .insert({
        user_id: userId,
        game: "chicken",
        bet_amount: bet,
        status: "open",
        payout: null,
        state: { brokenSeq } as never,
        public_state: publicState as never,
        server_seed: serverSeed,
        server_seed_hash: serverSeedHash,
        nonce: 0,
        client_action_id,
        closed_at: null,
      })
      .select("id, nonce")
      .single();
    if (insertErr || !inserted) {
      throw new Error(`chicken_insert_failed: ${insertErr?.message ?? "unknown"}`);
    }

    return {
      session_id: inserted.id,
      nonce: inserted.nonce,
      status: "open",
      public_state: maskPublic(publicState),
      new_balance: debit.new_balance,
    };
  });

/* ------------------------------------------------------------------ */
/* Jump                                                                  */
/* ------------------------------------------------------------------ */

export const chickenJump = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => JumpInput.parse(input))
  .handler(async ({ data, context }): Promise<ChickenSessionView> => {
    const userId = context.userId;
    const session = await loadSessionForUser(data.session_id, userId);
    if (session.status !== "open") throw new Error("chicken_session_closed");
    if (session.nonce !== data.nonce) throw new Error("chicken_stale_nonce");
    if (session.public_state.phase !== "playing") {
      throw new Error("chicken_not_playing");
    }

    const { bet, step } = session.public_state;
    const nextStep = step + 1;
    if (nextStep > CHICKEN_MAX_STEPS) {
      throw new Error("chicken_max_reached");
    }

    const brokenSeq = session.state.brokenSeq;
    const isBroken = !!brokenSeq[nextStep];

    let newPublicState: ChickenPublicState;
    let newStatus: "open" | "closed" = "open";
    let payoutOut = 0;
    let newBalance = await getBalance(userId);

    if (isBroken) {
      newPublicState = {
        bet,
        step,
        multiplier: chickenMultiplier(step),
        nextMultiplier: 0,
        phase: "result",
        outcome: "lost",
        payout: 0,
        brokenAt: nextStep,
        lossKind: "broken",
      };
      newStatus = "closed";
    } else {
      const reachedMax = nextStep >= CHICKEN_MAX_STEPS;
      const currentMult = chickenMultiplier(nextStep);
      if (reachedMax) {
        // Auto cash-out at max.
        const payout = Math.floor(bet * currentMult);
        const credit = await adjustBalance({
          user_id: userId,
          delta: payout,
          type: "win",
          game: "chicken",
          client_action_id: deriveActionId(data.client_action_id, "win_auto"),
          meta: { kind: "chicken_win_auto", bet, step: nextStep, multiplier: currentMult },
        });
        newBalance = credit.new_balance;
        payoutOut = payout;
        newPublicState = {
          bet,
          step: nextStep,
          multiplier: currentMult,
          nextMultiplier: 0,
          phase: "result",
          outcome: "won",
          payout,
        };
        newStatus = "closed";
      } else {
        newPublicState = {
          bet,
          step: nextStep,
          multiplier: currentMult,
          nextMultiplier: chickenMultiplier(nextStep + 1),
          phase: "playing",
        };
      }
    }

    const updated = await applyAction({
      session_id: session.id,
      user_id: userId,
      expected_nonce: session.nonce,
      new_state: { brokenSeq },
      new_public_state: newPublicState,
      new_status: newStatus,
      new_payout: newStatus === "closed" ? payoutOut : null,
    });

    return {
      session_id: updated.id,
      nonce: updated.nonce,
      status: newStatus,
      public_state: maskPublic(newPublicState),
      new_balance: newBalance,
    };
  });

/* ------------------------------------------------------------------ */
/* Cashout                                                              */
/* ------------------------------------------------------------------ */

export const chickenCashout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CashoutInput.parse(input))
  .handler(async ({ data, context }): Promise<ChickenSessionView> => {
    const userId = context.userId;
    const session = await loadSessionForUser(data.session_id, userId);
    if (session.status !== "open") throw new Error("chicken_session_closed");
    if (session.nonce !== data.nonce) throw new Error("chicken_stale_nonce");
    if (session.public_state.phase !== "playing") {
      throw new Error("chicken_not_playing");
    }
    if (session.public_state.step <= 0) {
      throw new Error("chicken_no_jumps_yet");
    }

    const { bet, step } = session.public_state;
    const mult = chickenMultiplier(step);
    const payout = Math.floor(bet * mult);

    const credit = await adjustBalance({
      user_id: userId,
      delta: payout,
      type: "win",
      game: "chicken",
      client_action_id: deriveActionId(data.client_action_id, "cashout"),
      meta: { kind: "chicken_win", bet, step, multiplier: mult },
    });

    const newPublicState: ChickenPublicState = {
      bet,
      step,
      multiplier: mult,
      nextMultiplier: 0,
      phase: "result",
      outcome: "won",
      payout,
    };

    const updated = await applyAction({
      session_id: session.id,
      user_id: userId,
      expected_nonce: session.nonce,
      new_state: { brokenSeq: session.state.brokenSeq },
      new_public_state: newPublicState,
      new_status: "closed",
      new_payout: payout,
    });

    return {
      session_id: updated.id,
      nonce: updated.nonce,
      status: "closed",
      public_state: newPublicState,
      new_balance: credit.new_balance,
    };
  });