/**
 * Mines — server-only helpers. NEVER import from client code.
 */
import { cryptoRandomInt } from "./engine.server";
import { MINES_TILES } from "./mines.shared";

/**
 * Crypto-grade Fisher–Yates → pick `mines` distinct positions in [0, TILES).
 * Identical algorithm to the previous client implementation, but seeded
 * with the Node crypto RNG so the result is never predictable.
 */
export function placeMines(mines: number): number[] {
  if (mines < 0 || mines >= MINES_TILES) {
    throw new Error("mines_out_of_range");
  }
  const indices = Array.from({ length: MINES_TILES }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, mines).sort((a, b) => a - b);
}