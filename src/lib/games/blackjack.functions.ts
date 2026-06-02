import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BJ_BET_STEP,
  BJ_MAX_BET,
  BJ_MIN_BET,
  type BJPublicState,
  type Card,
  handScore,
  isBlackjack,
} from "./blackjack.shared";
import {
  drawCard,
  drawForDealerHit,
  drawHoleBiased,
  makeShoe,
  resolveHand,
} from "./blackjack.server";
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
  .min(BJ_MIN_BET)
  .max(BJ_MAX_BET)
  .refine((n) => n % BJ_BET_STEP === 0, {
    message: `bet must be a multiple of ${BJ_BET_STEP}`,
  });

const DealInput = z.object({
  bet: BetSchema,
  client_action_id: z.string().uuid(),
});

const ActionInput = z.object({
  session_id: z.string().uuid(),
  nonce: z.number().int().min(0),
  client_action_id: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/* Types returned to the client                                        */
/* ------------------------------------------------------------------ */

export type BJSessionView = {
  session_id: string;
  nonce: number;
  status: "open" | "closed";
  public_state: BJPublicState;
  new_balance: number;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

type SessionRow = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  bet_amount: number;
  state: { shoe: Card[] };
  public_state: BJPublicState;
  nonce: number;
};

async function loadOpenSession(userId: string): Promise<SessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("game_sessions")
    .select("id, user_id, status, bet_amount, state, public_state, nonce")
    .eq("user_id", userId)
    .eq("game", "blackjack")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`bj_load_failed: ${error.message}`);
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
    .eq("game", "blackjack")
    .maybeSingle();
  if (error) throw new Error(`bj_load_failed: ${error.message}`);
  if (!data) throw new Error("bj_session_not_found");
  return data as unknown as SessionRow;
}

/** Strip the hole-card value when sending to the client. */
function maskHole(pub: BJPublicState): BJPublicState {
  return {
    ...pub,
    dealer: pub.dealer.map((c) =>
      c.hidden ? { suit: c.suit, rank: "?", value: 0, hidden: true } : c,
    ),
  };
}

async function applyAction(args: {
  session_id: string;
  user_id: string;
  expected_nonce: number;
  new_state: { shoe: Card[] };
  new_public_state: BJPublicState;
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
      throw new Error("bj_stale_nonce");
    }
    throw new Error(`bj_apply_failed: ${error.message}`);
  }
  return data as unknown as SessionRow;
}

/* ------------------------------------------------------------------ */
/* Resume                                                               */
/* ------------------------------------------------------------------ */

export const bjResume = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BJSessionView | null> => {
    const userId = context.userId;
    const session = await loadOpenSession(userId);
    if (!session) return null;
    const balance = await getBalance(userId);
    return {
      session_id: session.id,
      nonce: session.nonce,
      status: session.status,
      public_state: maskHole(session.public_state),
      new_balance: balance,
    };
  });

/* ------------------------------------------------------------------ */
/* Deal                                                                 */
/* ------------------------------------------------------------------ */

export const bjDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DealInput.parse(input))
  .handler(async ({ data, context }): Promise<BJSessionView> => {
    const userId = context.userId;
    const { bet, client_action_id } = data;

    // 1a. Idempotency: if this exact client_action_id already produced
    // a session, just return it. Prevents `bj_insert_failed: duplicate
    // key` when the client retries the same deal call.
    {
      const { data: dup } = await supabaseAdmin
        .from("game_sessions")
        .select("id, user_id, status, bet_amount, state, public_state, nonce")
        .eq("user_id", userId)
        .eq("game", "blackjack")
        .eq("client_action_id", client_action_id)
        .maybeSingle();
      if (dup) {
        const row = dup as unknown as SessionRow;
        const balance = await getBalance(userId);
        return {
          session_id: row.id,
          nonce: row.nonce,
          status: row.status,
          public_state: maskHole(row.public_state),
          new_balance: balance,
        };
      }
    }

    // 1b. If a hand is already in progress, RESUME it instead of
    // force-closing — closing a playing hand would leave the bet
    // debited with no payout (real money loss).
    const existing = await loadOpenSession(userId);
    if (existing) {
      if (existing.public_state.phase === "playing") {
        const balance = await getBalance(userId);
        return {
          session_id: existing.id,
          nonce: existing.nonce,
          status: existing.status,
          public_state: maskHole(existing.public_state),
          new_balance: balance,
        };
      }
      // Stale open session (e.g. result already shown) → safe to close.
      await supabaseAdmin
        .from("game_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    // 2. Debit the bet (idempotent by client_action_id).
    const debit = await adjustBalance({
      user_id: userId,
      delta: -bet,
      type: "bet",
      game: "blackjack",
      client_action_id,
      meta: { kind: "blackjack_bet", bet },
    }).catch((err) => {
      if (err instanceof Error && err.message === "insufficient_funds") {
        throw new Error("Saldo insuficiente");
      }
      throw err;
    });

    // 3. Build shoe + initial deal.
    const serverSeed = newServerSeed();
    const serverSeedHash = sha256Hex(serverSeed);
    let shoe = makeShoe();

    const draws: Card[] = [];
    for (let i = 0; i < 3; i++) {
      const r = drawCard(shoe);
      shoe = r.shoe;
      draws.push(r.card);
    }
    const hole = drawHoleBiased(shoe);
    shoe = hole.shoe;

    const player: Card[] = [draws[0], draws[2]];
    const dealer: Card[] = [draws[1], { ...hole.card, hidden: true }];

    let publicState: BJPublicState = {
      player,
      dealer,
      bet,
      doubled: false,
      phase: "playing",
    };
    let status: "open" | "closed" = "open";
    let payout = 0;
    let newBalance = debit.new_balance;

    // 4. Natural blackjack → resolve immediately.
    if (isBlackjack(player)) {
      const resolved = resolveHand(shoe, player, dealer, bet);
      shoe = resolved.shoe;
      publicState = {
        player,
        dealer: resolved.dealer,
        bet,
        doubled: false,
        phase: "result",
        outcome: resolved.outcome,
        payout: resolved.payout,
        dealerSequence: resolved.dealerSequence,
      };
      status = "closed";
      payout = resolved.payout;
      if (payout > 0) {
        const credit = await adjustBalance({
          user_id: userId,
          delta: payout,
          type: "win",
          game: "blackjack",
          client_action_id: deriveActionId(client_action_id, "win"),
          meta: { kind: "blackjack_win", bet, outcome: resolved.outcome },
        });
        newBalance = credit.new_balance;
      }
    }

    // 5. Create the session row.
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("game_sessions")
      .insert({
        user_id: userId,
        game: "blackjack",
        bet_amount: bet,
        status,
        payout: status === "closed" ? payout : null,
        state: { shoe } as never,
        public_state: publicState as never,
        server_seed: serverSeed,
        server_seed_hash: serverSeedHash,
        nonce: 0,
        client_action_id,
        closed_at: status === "closed" ? new Date().toISOString() : null,
      })
      .select("id, nonce")
      .single();
    if (insertErr || !inserted) {
      throw new Error(`bj_insert_failed: ${insertErr?.message ?? "unknown"}`);
    }

    return {
      session_id: inserted.id,
      nonce: inserted.nonce,
      status,
      public_state: maskHole(publicState),
      new_balance: newBalance,
    };
  });

/* ------------------------------------------------------------------ */
/* Hit                                                                  */
/* ------------------------------------------------------------------ */

export const bjHit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ActionInput.parse(input))
  .handler(async ({ data, context }): Promise<BJSessionView> => {
    const userId = context.userId;
    const session = await loadSessionForUser(data.session_id, userId);
    if (session.status !== "open") throw new Error("bj_session_closed");
    if (session.nonce !== data.nonce) throw new Error("bj_stale_nonce");
    if (session.public_state.phase !== "playing") {
      throw new Error("bj_not_playing");
    }

    let shoe = session.state.shoe;
    const drawn = drawCard(shoe);
    shoe = drawn.shoe;
    const player = [...session.public_state.player, drawn.card];
    const score = handScore(player);

    const bet = session.public_state.bet;
    const doubled = session.public_state.doubled;
    const effectiveBet = doubled ? bet * 2 : bet;

    let publicState: BJPublicState;
    let status: "open" | "closed" = "open";
    let payout = 0;
    let newBalance = await getBalance(userId);

    if (score >= 21) {
      // Bust or natural 21 → resolve.
      const resolved = resolveHand(shoe, player, session.public_state.dealer, effectiveBet);
      shoe = resolved.shoe;
      publicState = {
        player,
        dealer: resolved.dealer,
        bet,
        doubled,
        phase: "result",
        outcome: resolved.outcome,
        payout: resolved.payout,
        dealerSequence: resolved.dealerSequence,
      };
      status = "closed";
      payout = resolved.payout;
      if (payout > 0) {
        const credit = await adjustBalance({
          user_id: userId,
          delta: payout,
          type: "win",
          game: "blackjack",
          client_action_id: deriveActionId(data.client_action_id, "win"),
          meta: { kind: "blackjack_win", bet: effectiveBet, outcome: resolved.outcome },
        });
        newBalance = credit.new_balance;
      }
    } else {
      publicState = {
        ...session.public_state,
        player,
      };
    }

    const updated = await applyAction({
      session_id: session.id,
      user_id: userId,
      expected_nonce: session.nonce,
      new_state: { shoe },
      new_public_state: publicState,
      new_status: status,
      new_payout: status === "closed" ? payout : null,
    });

    return {
      session_id: updated.id,
      nonce: updated.nonce,
      status,
      public_state: maskHole(publicState),
      new_balance: newBalance,
    };
  });

/* ------------------------------------------------------------------ */
/* Stand                                                                */
/* ------------------------------------------------------------------ */

export const bjStand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ActionInput.parse(input))
  .handler(async ({ data, context }): Promise<BJSessionView> => {
    const userId = context.userId;
    const session = await loadSessionForUser(data.session_id, userId);
    if (session.status !== "open") throw new Error("bj_session_closed");
    if (session.nonce !== data.nonce) throw new Error("bj_stale_nonce");
    if (session.public_state.phase !== "playing") {
      throw new Error("bj_not_playing");
    }

    const bet = session.public_state.bet;
    const doubled = session.public_state.doubled;
    const effectiveBet = doubled ? bet * 2 : bet;

    const resolved = resolveHand(
      session.state.shoe,
      session.public_state.player,
      session.public_state.dealer,
      effectiveBet,
    );

    const publicState: BJPublicState = {
      player: session.public_state.player,
      dealer: resolved.dealer,
      bet,
      doubled,
      phase: "result",
      outcome: resolved.outcome,
      payout: resolved.payout,
      dealerSequence: resolved.dealerSequence,
    };

    let newBalance = await getBalance(userId);
    if (resolved.payout > 0) {
      const credit = await adjustBalance({
        user_id: userId,
        delta: resolved.payout,
        type: "win",
        game: "blackjack",
        client_action_id: deriveActionId(data.client_action_id, "win"),
        meta: { kind: "blackjack_win", bet: effectiveBet, outcome: resolved.outcome },
      });
      newBalance = credit.new_balance;
    }

    const updated = await applyAction({
      session_id: session.id,
      user_id: userId,
      expected_nonce: session.nonce,
      new_state: { shoe: resolved.shoe },
      new_public_state: publicState,
      new_status: "closed",
      new_payout: resolved.payout,
    });

    return {
      session_id: updated.id,
      nonce: updated.nonce,
      status: "closed",
      public_state: maskHole(publicState),
      new_balance: newBalance,
    };
  });

/* ------------------------------------------------------------------ */
/* Double                                                               */
/* ------------------------------------------------------------------ */

export const bjDouble = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ActionInput.parse(input))
  .handler(async ({ data, context }): Promise<BJSessionView> => {
    const userId = context.userId;
    const session = await loadSessionForUser(data.session_id, userId);
    if (session.status !== "open") throw new Error("bj_session_closed");
    if (session.nonce !== data.nonce) throw new Error("bj_stale_nonce");
    if (session.public_state.phase !== "playing") {
      throw new Error("bj_not_playing");
    }
    if (session.public_state.player.length !== 2) {
      throw new Error("bj_double_not_allowed");
    }
    if (session.public_state.doubled) {
      throw new Error("bj_already_doubled");
    }

    const bet = session.public_state.bet;

    // Debit the second bet (idempotent).
    const debit = await adjustBalance({
      user_id: userId,
      delta: -bet,
      type: "bet",
      game: "blackjack",
      client_action_id: deriveActionId(data.client_action_id, "double"),
      meta: { kind: "blackjack_double", bet },
    }).catch((err) => {
      if (err instanceof Error && err.message === "insufficient_funds") {
        throw new Error("Saldo insuficiente");
      }
      throw err;
    });
    let newBalance = debit.new_balance;

    let shoe = session.state.shoe;
    const drawn = drawCard(shoe);
    shoe = drawn.shoe;
    const player = [...session.public_state.player, drawn.card];
    const effectiveBet = bet * 2;

    const resolved = resolveHand(shoe, player, session.public_state.dealer, effectiveBet);

    const publicState: BJPublicState = {
      player,
      dealer: resolved.dealer,
      bet,
      doubled: true,
      phase: "result",
      outcome: resolved.outcome,
      payout: resolved.payout,
      dealerSequence: resolved.dealerSequence,
    };

    if (resolved.payout > 0) {
      const credit = await adjustBalance({
        user_id: userId,
        delta: resolved.payout,
        type: "win",
        game: "blackjack",
        client_action_id: deriveActionId(data.client_action_id, "double_win"),
        meta: { kind: "blackjack_win", bet: effectiveBet, outcome: resolved.outcome },
      });
      newBalance = credit.new_balance;
    }

    const updated = await applyAction({
      session_id: session.id,
      user_id: userId,
      expected_nonce: session.nonce,
      new_state: { shoe: resolved.shoe },
      new_public_state: publicState,
      new_status: "closed",
      new_payout: resolved.payout,
    });

    return {
      session_id: updated.id,
      nonce: updated.nonce,
      status: "closed",
      public_state: maskHole(publicState),
      new_balance: newBalance,
    };
  });