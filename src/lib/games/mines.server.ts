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

/* ------------------------------------------------------------------ */
/* Hot session cache (latency)                                         */
/* ------------------------------------------------------------------ */

/**
 * In-memory cache of the *authoritative* session row we just wrote, so a
 * consecutive reveal in the same worker isolate can skip the extra SELECT
 * round-trip. This is only a hint: every mutation still goes through
 * `bj_apply_action`, which re-checks ownership + nonce atomically inside
 * Postgres. A stale/missing entry simply falls back to the DB read, and a
 * wrong entry can never be committed (the nonce check rejects it).
 */
type CachedMinesSession = {
  row: unknown;
  expires: number;
};

const SESSION_TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;
const sessionCache = new Map<string, CachedMinesSession>();

function cacheKey(sessionId: string, userId: string) {
  return `${sessionId}:${userId}`;
}

export function cacheMinesSession(
  sessionId: string,
  userId: string,
  row: unknown,
): void {
  if (sessionCache.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of sessionCache) {
      if (v.expires <= now) sessionCache.delete(k);
    }
    if (sessionCache.size >= MAX_ENTRIES) {
      const oldest = sessionCache.keys().next().value;
      if (oldest) sessionCache.delete(oldest);
    }
  }
  sessionCache.set(cacheKey(sessionId, userId), {
    row,
    expires: Date.now() + SESSION_TTL_MS,
  });
}

export function getCachedMinesSession(
  sessionId: string,
  userId: string,
): unknown | null {
  const hit = sessionCache.get(cacheKey(sessionId, userId));
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    sessionCache.delete(cacheKey(sessionId, userId));
    return null;
  }
  return hit.row;
}

export function dropCachedMinesSession(sessionId: string, userId: string): void {
  sessionCache.delete(cacheKey(sessionId, userId));
}