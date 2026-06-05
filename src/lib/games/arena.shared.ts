/**
 * Arena — shared constants & types.
 * Client + server source of truth. Server validates against this; client
 * only renders labels and limits.
 */

export const ARENA_MIN_BET = 500;
export const ARENA_MAX_BET = 500000;
export const ARENA_BET_STEP = 500;

export type ArenaCharacterId = "nova" | "shadow" | "titan" | "blaze";

export const ARENA_CHARACTERS: readonly ArenaCharacterId[] = [
  "nova",
  "shadow",
  "titan",
  "blaze",
] as const;

/** Fixed odds shown to the player. Source of truth; server uses the same. */
export const ARENA_ODDS: Record<ArenaCharacterId, number> = {
  nova: 2.3,
  shadow: 3.5,
  titan: 4.8,
  blaze: 6.5,
};

/**
 * Implied probabilities used by the server (sum 1.046 → RTP 91.5%).
 * Exposed here only for UI hints / debugging, never trusted on the wire.
 */
export const ARENA_IMPLIED_PROB: Record<ArenaCharacterId, number> = {
  nova: 0.424,
  shadow: 0.279,
  titan: 0.203,
  blaze: 0.14,
};

export type ArenaCombatEvent = {
  round: number;
  attacker: ArenaCharacterId;
  target: ArenaCharacterId;
  damage: number;
  hp: Record<ArenaCharacterId, number>;
  finisher?: boolean;
};

export type ArenaRoundResult = {
  was_duplicate: boolean;
  new_balance: number;
  round_id?: string;
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