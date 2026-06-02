/**
 * Mines — shared constants and pure math.
 * Safe to import from both client and server (no Node-only deps).
 * Keep values in sync with any local UI defaults.
 */

export const MINES_TILES = 16;
export const MINES_MIN = 1;
export const MINES_MAX = 15;

export const MINES_MIN_BET = 500;
export const MINES_MAX_BET = 100000;
export const MINES_BET_STEP = 500;

const RTP_BASE = 0.907;

/** Per-mines RTP (matches the previous client-local tuning). */
export function rtpFor(mines: number): number {
  if (mines <= 1) return 0.887625; // → ~0.95x first pick
  if (mines === 2) return 0.917;
  if (mines === 3) return 0.934375; // → ~1.15x first pick
  return RTP_BASE;
}

/**
 * Multiplier after `picks` safe tiles opened, with `mines` mines.
 * Formula: RTP * prod_{i=0..k-1} (N - i) / (N - M - i)
 */
export function multiplierFor(mines: number, picks: number): number {
  if (picks <= 0) return 1;
  const safeTotal = MINES_TILES - mines;
  if (picks > safeTotal) return 0;
  let m = rtpFor(mines);
  for (let i = 0; i < picks; i++) {
    m *= (MINES_TILES - i) / (safeTotal - i);
  }
  return Math.round(m * 100) / 100;
}

export type MinesPhase = "playing" | "result";
export type MinesOutcome = "won" | "lost";

/** Public state sent to the client. Mine positions only included on close. */
export type MinesPublicState = {
  bet: number;
  mines: number;
  picks: number;
  revealed: number[];
  phase: MinesPhase;
  multiplier: number; // current cash-out multiplier
  nextMultiplier: number; // multiplier if next pick is safe
  outcome?: MinesOutcome;
  payout?: number;
  explodedTile?: number; // tile that triggered the loss
  mineSetReveal?: number[]; // all mines (only on close)
};