/**
 * Deterministic "online" base count that drifts smoothly per hour.
 * - Range: 120..1600
 * - Step: ±10–20% from the previous hour
 * - Anchored daily so the curve is stable across clients within the same hour.
 * - Rounded to a "nice" multiple of 20 (120, 140, 180, 200, ...).
 */

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 120;
const MAX = 1600;

export function getHourlyOnlineBase(now: Date = new Date()): number {
  // Anchor to UTC midnight of today.
  const dayIndex = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000,
  );
  const rng = mulberry32(dayIndex * 1013904223 + 1664525);

  // Day start value somewhere mid-range so we don't always begin at the extremes.
  let v = 200 + rng() * 600; // 200..800

  const hour = now.getUTCHours();
  for (let h = 0; h <= hour; h++) {
    const r1 = rng();
    const r2 = rng();
    const pct = 0.1 + r1 * 0.1; // 10–20%
    let dir = r2 < 0.5 ? -1 : 1;
    // Soft pull away from edges so we don't flatline at the boundary.
    if (v < MIN * 1.2) dir = 1;
    else if (v > MAX * 0.85) dir = -1;
    v = v * (1 + dir * pct);
    if (v < MIN) v = MIN + rng() * 40;
    if (v > MAX) v = MAX - rng() * 80;
  }

  // Round to a "nice" multiple of 20.
  return Math.max(MIN, Math.min(MAX, Math.round(v / 20) * 20));
}