/**
 * Chicken Road — shared constants and pure math.
 * Safe to import from both client and server.
 */

export const CHICKEN_MIN_BET = 500;
export const CHICKEN_MAX_BET = 50000;
export const CHICKEN_BET_STEP = 500;

/** Maximum number of jumps in a single round. */
export const CHICKEN_MAX_STEPS = 20;

/** RTP baked into each safe-jump multiplier (house edge ~3%). */
const CHICKEN_RTP = 0.97;
/** Base probability that the next asteroid is SAFE. */
const SAFE_PROB_BASE = 0.81;
/** Slight decrease per step to ramp up tension. Floor at 0.55. */
const SAFE_PROB_DECAY = 0.007;
const SAFE_PROB_FLOOR = 0.55;

/**
 * Probability the asteroid at `step` (1-indexed) is SAFE. Decreases slightly
 * with each jump so high multipliers carry real risk.
 */
export function chickenSafeProb(step: number): number {
  const p = SAFE_PROB_BASE - SAFE_PROB_DECAY * Math.max(0, step - 1);
  return Math.max(SAFE_PROB_FLOOR, p);
}

/** Pre-computed multipliers so the first jump starts low and the curve keeps
 *  the same relative growth between steps. Step 1 is anchored to 1.05x and
 *  each following step preserves the original RTP-based ratios. */
function buildStepMultipliers(): number[] {
  const original: number[] = [1, CHICKEN_RTP * (1 / chickenSafeProb(1))];
  for (let i = 2; i <= CHICKEN_MAX_STEPS; i++) {
    original[i] = original[i - 1] * (1 / chickenSafeProb(i));
  }

  const multipliers: number[] = [1];
  multipliers[1] = 1.05; // low first-jump payout
  for (let i = 2; i <= CHICKEN_MAX_STEPS; i++) {
    const ratio = original[i] / original[i - 1];
    multipliers[i] = Math.round(multipliers[i - 1] * ratio * 100) / 100;
  }
  return multipliers;
}

const CHICKEN_STEP_MULTIPLIERS = buildStepMultipliers();

/**
 * Cash-out multiplier after `step` successful jumps.
 * Starts at 1.05x for the first safe jump and grows with the same
 * relative progression as the original RTP curve.
 */
export function chickenMultiplier(step: number): number {
  if (step <= 0) return 1;
  return CHICKEN_STEP_MULTIPLIERS[Math.min(step, CHICKEN_MAX_STEPS)];
}

export type ChickenPhase = "playing" | "result";
export type ChickenOutcome = "won" | "lost";
export type ChickenLossKind = "broken"; // extensible: ufo | meteor | blackhole

/** Public state sent to the client. Future asteroid outcomes stay server-side. */
export type ChickenPublicState = {
  bet: number;
  step: number;             // safe jumps completed so far
  multiplier: number;       // current cash-out multiplier (= mult(step))
  nextMultiplier: number;   // mult(step + 1) — what the next jump pays
  phase: ChickenPhase;
  outcome?: ChickenOutcome;
  payout?: number;
  brokenAt?: number;        // step index of the broken asteroid (loss only)
  lossKind?: ChickenLossKind;
};