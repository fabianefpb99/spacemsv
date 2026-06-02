import { randomBytes, createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server-only game engine helpers. NEVER import this from client code.
 * The `.server.ts` extension is the boundary enforced by the bundler.
 */

export type TxType =
  | "bet"
  | "win"
  | "bonus"
  | "adjustment"
  | "deposit"
  | "withdrawal";

/** Uniformly distributed integer in [0, maxExclusive) using rejection sampling. */
export function cryptoRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("cryptoRandomInt: maxExclusive must be a positive integer");
  }
  if (maxExclusive === 1) return 0;
  const max = 0x100000000; // 2^32
  const limit = max - (max % maxExclusive);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = randomBytes(4).readUInt32BE(0);
    if (r < limit) return r % maxExclusive;
  }
}

/** Weighted random pick using crypto-grade randomness. */
export function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
  if (items.length !== weights.length || items.length === 0) {
    throw new Error("weightedPick: items/weights length mismatch");
  }
  let total = 0;
  for (const w of weights) {
    if (!Number.isInteger(w) || w < 0) throw new Error("weightedPick: weights must be non-negative integers");
    total += w;
  }
  if (total <= 0) throw new Error("weightedPick: total weight must be > 0");
  const pick = cryptoRandomInt(total);
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (pick < acc) return items[i];
  }
  return items[items.length - 1];
}

/** SHA-256 hex digest. */
export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Cryptographically strong server seed (256 bits, hex). */
export function newServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Derive a stable UUID-formatted action id from a root client_action_id.
 * Used so secondary writes (e.g. credit the win) are also idempotent
 * when the same spin is retried with the same root id.
 */
export function deriveActionId(rootId: string, suffix: string): string {
  const h = sha256Hex(`${rootId}:${suffix}`);
  // Format as a UUIDv5-looking value (RFC 4122-like layout; not a real v5).
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "5" + h.slice(13, 16),
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + h.slice(18, 20),
    h.slice(20, 32),
  ].join("-");
}

/**
 * Single permitted entry point for moving money. Wraps the SQL
 * function `public.adjust_balance`, which:
 *  - locks `user_balances` FOR UPDATE
 *  - rejects negative resulting balances (`insufficient_funds`)
 *  - is idempotent by `(user_id, client_action_id)`
 *  - writes a row to `transactions` with `balance_after`
 */
export async function adjustBalance(args: {
  user_id: string;
  delta: number;
  type: TxType;
  game?: string | null;
  round_id?: string | null;
  client_action_id: string;
  meta?: Record<string, unknown>;
}): Promise<{ new_balance: number; transaction_id: string; was_duplicate: boolean }> {
  const { data, error } = await supabaseAdmin.rpc("adjust_balance", {
    p_user_id: args.user_id,
    p_delta: args.delta,
    p_type: args.type,
    p_game: args.game ?? undefined,
    p_game_round_id: args.round_id ?? undefined,
    p_client_action_id: args.client_action_id,
    p_meta: (args.meta ?? {}) as never,
  });
  if (error) {
    // Surface known business errors as typed strings.
    if (error.message?.includes("insufficient_funds")) {
      throw new Error("insufficient_funds");
    }
    if (error.message?.includes("balance_row_missing")) {
      throw new Error("balance_row_missing");
    }
    throw new Error(`adjust_balance_failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("adjust_balance_no_result");
  return {
    new_balance: Number(row.new_balance),
    transaction_id: row.transaction_id as string,
    was_duplicate: Boolean(row.was_duplicate),
  };
}

/** Fetch a single transaction by id (admin). */
export async function getTransactionById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id, user_id, type, amount, balance_after, game, client_action_id, meta, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`get_tx_failed: ${error.message}`);
  return data;
}

/** Replace the `meta` jsonb of a transaction (admin). Used to cache spin outcomes. */
export async function setTransactionMeta(id: string, meta: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("transactions")
    .update({ meta: meta as never })
    .eq("id", id);
  if (error) throw new Error(`set_tx_meta_failed: ${error.message}`);
}

/** Read the current user balance (admin, bypasses RLS). */
export async function getBalance(user_id: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("user_balances")
    .select("balance")
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) throw new Error(`get_balance_failed: ${error.message}`);
  return data ? Number(data.balance) : 0;
}