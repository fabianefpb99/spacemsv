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

/**
 * Permutación de odds (4 elementos, valores 1..4 todos distintos).
 * perm[i] = rango asignado al personaje en posición i del array
 * ARENA_CHARACTERS. Rango 1 = favorito (odds 2.30), rango 4 = underdog
 * (odds 6.50). El servidor valida la permutación e ignora el resto.
 */
export type ArenaOddsPerm = [number, number, number, number];

const ARENA_BASE_ODDS = [2.3, 3.5, 4.8, 6.5] as const;

function shuffle4(): ArenaOddsPerm {
  const arr: number[] = [1, 2, 3, 4];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr as ArenaOddsPerm;
}

/**
 * Genera una nueva permutación de odds garantizando que el "favorito"
 * (personaje con odds más bajas) sea distinto al de la ronda anterior.
 * En el primer call (prevFavorite=null) cualquier permutación es válida.
 */
export function nextArenaOddsPerm(prevFavorite: ArenaCharacterId | null): {
  perm: ArenaOddsPerm;
  odds: Record<ArenaCharacterId, number>;
  favorite: ArenaCharacterId;
} {
  for (let safety = 0; safety < 50; safety++) {
    const perm = shuffle4();
    const favIdx = perm.indexOf(1);
    const favorite = ARENA_CHARACTERS[favIdx];
    if (prevFavorite === null || favorite !== prevFavorite) {
      const odds = {} as Record<ArenaCharacterId, number>;
      ARENA_CHARACTERS.forEach((id, i) => {
        odds[id] = ARENA_BASE_ODDS[perm[i] - 1];
      });
      return { perm, odds, favorite };
    }
  }
  // Fallback teórico — nunca debería llegar aquí.
  const perm = shuffle4();
  const odds = {} as Record<ArenaCharacterId, number>;
  ARENA_CHARACTERS.forEach((id, i) => {
    odds[id] = ARENA_BASE_ODDS[perm[i] - 1];
  });
  return { perm, odds, favorite: ARENA_CHARACTERS[perm.indexOf(1)] };
}

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