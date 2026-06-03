/**
 * Snap a candidate bet to a valid step multiple within [min, cap].
 * cap = min(balance, maxBet). Floors to step so the server's
 * `n % step === 0` validator never rejects a balance-capped value
 * (e.g. balance 5650 with step 500 → 5500).
 */
export function clampBetToStep(
  candidate: number,
  balance: number,
  maxBet: number,
  step: number,
  minBet: number,
): number {
  const cap = Math.min(balance, maxBet);
  const bounded = Math.min(cap, Math.max(0, candidate));
  const snapped = Math.floor(bounded / step) * step;
  return Math.max(minBet, snapped);
}