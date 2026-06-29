import { cryptoRandomInt } from "./engine.server";
import { CHICKEN_MAX_STEPS, chickenSafeProb } from "./chicken.shared";

/**
 * Pre-generates the entire SAFE/BROKEN sequence for a round at deal time.
 * Index 0 is the asteroid the chicken starts on (always safe / unused).
 * Indices 1..CHICKEN_MAX_STEPS are the asteroids the chicken would jump to.
 *
 * Pre-committing the whole sequence (instead of rolling per-jump) keeps the
 * round's outcome fully determined server-side at deal time, so the server
 * cannot "re-roll" mid-round and the seed remains verifiable.
 */
export function placeBrokenSequence(): boolean[] {
  const broken: boolean[] = new Array(CHICKEN_MAX_STEPS + 1).fill(false);
  for (let step = 1; step <= CHICKEN_MAX_STEPS; step++) {
    const safeProb = chickenSafeProb(step);
    // Integer threshold for cryptoRandomInt(10000).
    const threshold = Math.round(safeProb * 10000);
    const roll = cryptoRandomInt(10000);
    broken[step] = roll >= threshold; // true => BROKEN
  }
  return broken;
}