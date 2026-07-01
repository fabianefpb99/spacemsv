import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MINES_BET_STEP,
  MINES_MAX,
  MINES_MAX_BET,
  MINES_MIN,
  MINES_MIN_BET,
  MINES_TILES,
  multiplierFor,
  type MinesPublicState,
} from "./mines.shared";
import { placeMines } from "./mines.server";
import {
  adjustBalance,
  cryptoRandomInt,
  deriveActionId,
  getBalance,
  newServerSeed,
  sha256Hex,
} from "./engine.server";
import { isBoostTarget } from "./boost.server";

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const BetSchema = z
  .number()
  .int()
  .min(MINES_MIN_BET)
  .max(MINES_MAX_BET)
  .refine((n) => n % MINES_BET_STEP === 0, {
    message: `bet must be a multiple of ${MINES_BET_STEP}`,
  });

const MinesCountSchema = z.number().int().min(MINES_MIN).max(MINES_MAX);

const DealInput = z.object({
  bet: BetSchema,
  mines: MinesCountSchema,
  client_action_id: z.string().uuid(),
});

const RevealInput = z.object({
  session_id: z.string().uuid(),
  nonce: z.number().int().min(0),
  tile_idx: z.number().int().min(0).max(MINES_TILES - 1),
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

export type MinesSessionView = {
  session_id: string;
  nonce: number;
  status: "open" | "closed";
  public_state: MinesPublicState;
  new_balance: number;
};

type SessionRow = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  bet_amount: number;
  state: { mineSet: number[] };
  public_state: MinesPublicState;
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
    .eq("game", "mines")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`mines_load_failed: ${error.message}`);
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
    .eq("game", "mines")
    .maybeSingle();
  if (error) throw new Error(`mines_load_failed: ${error.message}`);
  if (!data) throw new Error("mines_session_not_found");
  return data as unknown as SessionRow;
}

/** Public-safe view: hide mine positions while the round is open. */
function maskPublic(pub: MinesPublicState): MinesPublicState {
  if (pub.phase === "result") return pub;
  // Strip mineSetReveal/explodedTile while playing.
  const { mineSetReveal: _m, explodedTile: _e, ...rest } = pub;
  void _m;
  void _e;
  return rest;
}

async function applyAction(args: {
  session_id: string;
  user_id: string;
  expected_nonce: number;
  new_state: { mineSet: number[] };
  new_public_state: MinesPublicState;
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
      throw new Error("mines_stale_nonce");
    }
    throw new Error(`mines_apply_failed: ${error.message}`);
  }
  return data as unknown as SessionRow;
}

/* ------------------------------------------------------------------ */
/* Resume                                                               */
/* ------------------------------------------------------------------ */

export const minesResume = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MinesSessionView | null> => {
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

export const minesDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DealInput.parse(input))
  .handler(async ({ data, context }): Promise<MinesSessionView> => {
    const userId = context.userId;
    const { bet, mines, client_action_id } = data;

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
      game: "mines",
      client_action_id,
      meta: { kind: "mines_bet", bet, mines },
    }).catch((err) => {
      if (err instanceof Error && err.message === "insufficient_funds") {
        throw new Error("Saldo insuficiente");
      }
      throw err;
    });

    // 3. Generate mine positions and persist.
    const serverSeed = newServerSeed();
    const serverSeedHash = sha256Hex(serverSeed);
    const mineSet = placeMines(mines);

    const publicState: MinesPublicState = {
      bet,
      mines,
      picks: 0,
      revealed: [],
      phase: "playing",
      multiplier: 1,
      nextMultiplier: multiplierFor(mines, 1),
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("game_sessions")
      .insert({
        user_id: userId,
        game: "mines",
        bet_amount: bet,
        status: "open",
        payout: null,
        state: { mineSet } as never,
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
      throw new Error(`mines_insert_failed: ${insertErr?.message ?? "unknown"}`);
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
/* Reveal a tile                                                        */
/* ------------------------------------------------------------------ */

export const minesReveal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RevealInput.parse(input))
  .handler(async ({ data, context }): Promise<MinesSessionView> => {
    const userId = context.userId;
    const session = await loadSessionForUser(data.session_id, userId);
    if (session.status !== "open") throw new Error("mines_session_closed");
    if (session.nonce !== data.nonce) throw new Error("mines_stale_nonce");
    if (session.public_state.phase !== "playing") {
      throw new Error("mines_not_playing");
    }
    if (session.public_state.revealed.includes(data.tile_idx)) {
      throw new Error("mines_tile_already_revealed");
    }

    const { mines, bet, picks } = session.public_state;
    let mineSet = session.state.mineSet;
    let isMine = mineSet.includes(data.tile_idx);

    // Boost: si el jugador es target, movemos la mina pisada a una casilla
    // todavía sin revelar para que el pick sea seguro. Mantenemos el conteo
    // de minas intacto y la integridad del juego para el resto de picks.
    if (isMine && (await isBoostTarget(userId, "mines"))) {
      const revealed = session.public_state.revealed;
      const occupied = new Set<number>([
        ...revealed,
        data.tile_idx,
        ...mineSet,
      ]);
      const candidates: number[] = [];
      for (let i = 0; i < MINES_TILES; i += 1) {
        if (!occupied.has(i)) candidates.push(i);
      }
      if (candidates.length > 0) {
        const swap = candidates[cryptoRandomInt(candidates.length)];
        mineSet = mineSet
          .filter((idx) => idx !== data.tile_idx)
          .concat(swap);
        isMine = false;
      }
    }
    const revealed = [...session.public_state.revealed, data.tile_idx];

    let publicState: MinesPublicState;
    let status: "open" | "closed" = "open";
    let payoutOut = 0;
    let newBalance = await getBalance(userId);

    if (isMine) {
      // Bust → close, reveal all mines.
      publicState = {
        bet,
        mines,
        picks,
        revealed,
        phase: "result",
        multiplier: multiplierFor(mines, picks),
        nextMultiplier: 0,
        outcome: "lost",
        payout: 0,
        explodedTile: data.tile_idx,
        mineSetReveal: mineSet,
      };
      status = "closed";
    } else {
      const nextPicks = picks + 1;
      const safeTotal = MINES_TILES - mines;
      const currentMult = multiplierFor(mines, nextPicks);
      if (nextPicks >= safeTotal) {
        // Auto-cashout: every safe tile opened.
        const payout = Math.floor(bet * currentMult);
        const credit = await adjustBalance({
          user_id: userId,
          delta: payout,
          type: "win",
          game: "mines",
          client_action_id: deriveActionId(data.client_action_id, "win"),
          meta: { kind: "mines_win_auto", bet, mines, picks: nextPicks, multiplier: currentMult },
        });
        newBalance = credit.new_balance;
        payoutOut = payout;
        publicState = {
          bet,
          mines,
          picks: nextPicks,
          revealed,
          phase: "result",
          multiplier: currentMult,
          nextMultiplier: 0,
          outcome: "won",
          payout,
          mineSetReveal: mineSet,
        };
        status = "closed";
      } else {
        publicState = {
          bet,
          mines,
          picks: nextPicks,
          revealed,
          phase: "playing",
          multiplier: currentMult,
          nextMultiplier: multiplierFor(mines, nextPicks + 1),
        };
      }
    }

    const updated = await applyAction({
      session_id: session.id,
      user_id: userId,
      expected_nonce: session.nonce,
      new_state: { mineSet },
      new_public_state: publicState,
      new_status: status,
      new_payout: status === "closed" ? payoutOut : null,
    });

    return {
      session_id: updated.id,
      nonce: updated.nonce,
      status,
      public_state: maskPublic(publicState),
      new_balance: newBalance,
    };
  });

/* ------------------------------------------------------------------ */
/* Cashout                                                              */
/* ------------------------------------------------------------------ */

export const minesCashout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CashoutInput.parse(input))
  .handler(async ({ data, context }): Promise<MinesSessionView> => {
    const userId = context.userId;
    const session = await loadSessionForUser(data.session_id, userId);
    if (session.status !== "open") throw new Error("mines_session_closed");
    if (session.nonce !== data.nonce) throw new Error("mines_stale_nonce");
    if (session.public_state.phase !== "playing") {
      throw new Error("mines_not_playing");
    }
    if (session.public_state.picks <= 0) {
      throw new Error("mines_no_picks_yet");
    }

    const { mines, bet, picks, revealed } = session.public_state;
    const mineSet = session.state.mineSet;
    const mult = multiplierFor(mines, picks);
    const payout = Math.floor(bet * mult);

    const credit = await adjustBalance({
      user_id: userId,
      delta: payout,
      type: "win",
      game: "mines",
      client_action_id: deriveActionId(data.client_action_id, "cashout"),
      meta: { kind: "mines_win", bet, mines, picks, multiplier: mult },
    });

    const publicState: MinesPublicState = {
      bet,
      mines,
      picks,
      revealed,
      phase: "result",
      multiplier: mult,
      nextMultiplier: 0,
      outcome: "won",
      payout,
      mineSetReveal: mineSet,
    };

    const updated = await applyAction({
      session_id: session.id,
      user_id: userId,
      expected_nonce: session.nonce,
      new_state: { mineSet },
      new_public_state: publicState,
      new_status: "closed",
      new_payout: payout,
    });

    return {
      session_id: updated.id,
      nonce: updated.nonce,
      status: "closed",
      public_state: publicState,
      new_balance: credit.new_balance,
    };
  });