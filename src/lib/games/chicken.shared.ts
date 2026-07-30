/**
 * Chicken Road — shared constants and pure math.
 * Safe to import from both client and server.
 */

export const CHICKEN_MIN_BET = 500;
export const CHICKEN_MAX_BET = 50000;
export const CHICKEN_BET_STEP = 500;

/** Maximum number of jumps in a single round. */
export const CHICKEN_MAX_STEPS = 20;

/**
 * RTP applied at EVERY cash-out point (house edge 4% flat, always in favour of
 * the house no matter when the player cashes out).
 */
const CHICKEN_RTP = 0.96;
/** Base probability that the next asteroid is SAFE. */
const SAFE_PROB_BASE = 0.875;
/** Decrease per step to ramp up tension. Floor at 0.62. */
const SAFE_PROB_DECAY = 0.008;
const SAFE_PROB_FLOOR = 0.62;
/**
 * Sporadic instant-crash on the VERY FIRST jump. This is the house's recovery
 * lever: no matter how good the run looks, ~9% of rounds die immediately at
 * step 1. It is folded into `chickenSafeProb(1)`, so the server RNG and the
 * multiplier curve both stay mathematically consistent (RTP untouched).
 */
export const CHICKEN_INSTANT_CRASH_PROB = 0.09;

/**
 * Probability the asteroid at `step` (1-indexed) is SAFE. Decreases slightly
 * with each jump so high multipliers carry real risk.
 */
export function chickenSafeProb(step: number): number {
  const p = SAFE_PROB_BASE - SAFE_PROB_DECAY * Math.max(0, step - 1);
  const base = Math.max(SAFE_PROB_FLOOR, p);
  // First jump additionally carries the sporadic instant-crash risk.
  if (step === 1) return base * (1 - CHICKEN_INSTANT_CRASH_PROB);
  return base;
}

/**
 * Multipliers derived directly from the true survival odds, scaled by the RTP.
 * mult(n) = RTP / P(survive n jumps) — so the expected value of cashing out at
 * ANY step is exactly 96% of the bet: no "sucker" steps, no free steps, and the
 * house edge is identical whether the player cashes out at jump 1 or jump 20.
 *
 * Resulting curve (approx): 1.17x, 1.44x, 1.79x, 2.25x, 2.86x, 3.67x ... 369x.
 * ~53% of rounds reach jump 3 (1.79x) and ~43% reach jump 4 (2.25x), so early
 * cash-outs finally pay something meaningful instead of ~1.1x.
 */
function buildStepMultipliers(): number[] {
  const multipliers: number[] = [1];
  let survival = 1;
  for (let i = 1; i <= CHICKEN_MAX_STEPS; i++) {
    survival *= chickenSafeProb(i);
    multipliers[i] = Math.round((CHICKEN_RTP / survival) * 100) / 100;
  }
  return multipliers;
}

const CHICKEN_STEP_MULTIPLIERS = buildStepMultipliers();

/** Cash-out multiplier after `step` successful jumps (1.17x for the first). */
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