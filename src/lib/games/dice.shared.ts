/**
 * Dice — shared constants & pure math.
 * Imported by both client (UI) and server (RNG / payout). Keep server as
 * source of truth; the client only uses these to render labels/limits.
 */

export const DICE_MIN_BET = 500;
export const DICE_MAX_BET = 50000;
export const DICE_BET_STEP = 500;

export type DiceSide = "low" | "high";

/** Allowed multipliers (in order shown in the UI). */
export const DICE_MULTS = [1.15, 1.42, 1.9, 2.85, 4.75, 9.5] as const;
export type DiceMult = (typeof DICE_MULTS)[number];

/**
 * Win probability per multiplier. The house edge is baked into this table:
 * RTP = winProb * mult. Keep client & server reading the SAME values.
 */
export const DICE_WIN_PROB: Record<number, number> = {
  // Ajuste 2026-07-07: baja de win-prob para reducir RTP real (~50% → ~35%)
  // manteniendo la sensación de victoria frecuente en el multiplicador bajo.
  1.15: 0.44,
  1.42: 0.32,
  1.9:  0.18,
  2.85: 0.09,
  4.75: 0.045,
  9.5:  0.022,
};

export function diceWinProb(mult: number): number {
  return DICE_WIN_PROB[mult] ?? 0;
}

export function isDiceMult(n: number): n is DiceMult {
  return (DICE_MULTS as readonly number[]).includes(n);
}

/** Public result returned to the client after a roll. */
export type DiceRollResult = {
  roll: number;          // 1..6
  won: boolean;
  payout: number;        // 0 on loss, floor(bet * mult) on win
  multiplier: number;    // multiplier used (echo)
  side: DiceSide;        // side used (echo)
  bet: number;           // bet used (echo)
  server_seed_hash: string;
  server_seed: string;   // revealed: single-shot game, no future commitment
  new_balance: number;
};