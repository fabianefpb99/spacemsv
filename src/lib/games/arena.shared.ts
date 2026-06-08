/**
 * Arena — shared constants & types.
 * Client + server source of truth. Server validates against this; client
 * only renders labels and limits.
 */

export const ARENA_MIN_BET = 1000;
export const ARENA_MAX_BET = 50000;
export const ARENA_BET_STEP = 500;

export type ArenaCharacterId = "nova" | "shadow" | "titan" | "blaze";

export const ARENA_CHARACTERS: readonly ArenaCharacterId[] = [
  "nova",
  "shadow",
  "titan",
  "blaze",
] as const;

/**
 * Cuotas base por rango (Opción A — 3 iguales + 1 estrella).
 * Rangos 1-3 = comunes (3.30x). Rango 4 = estrella (8.00x).
 * El servidor usa exactamente los mismos valores y pesos.
 *
 * Probabilidades reales:
 *   - Cada común: 280/1000 = 28%
 *   - Estrella:   110/1000 = 11%
 *   - Casa:       50/1000  =  5%
 * RTP por slot: común 28%·3.30 ≈ 92.4% · estrella 11%·8.00 = 88%.
 */
export const ARENA_ODDS: Record<ArenaCharacterId, number> = {
  nova: 3.3,
  shadow: 3.3,
  titan: 3.3,
  blaze: 8.0,
};

/** Probabilidades implícitas por personaje en la asignación base. */
export const ARENA_IMPLIED_PROB: Record<ArenaCharacterId, number> = {
  nova: 0.28,
  shadow: 0.28,
  titan: 0.28,
  blaze: 0.11,
};

/**
 * Permutación de odds (4 elementos, valores 1..4 todos distintos).
 * perm[i] = rango asignado al personaje en posición i del array
 * ARENA_CHARACTERS. Rangos 1-3 = comunes (odds 3.30, 28% c/u),
 * rango 4 = estrella (odds 8.00, 11%). El servidor valida y aplica.
 */
export type ArenaOddsPerm = [number, number, number, number];

const ARENA_BASE_ODDS = [3.3, 3.3, 3.3, 8.0] as const;

function shuffle4(): ArenaOddsPerm {
  const arr: number[] = [1, 2, 3, 4];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr as ArenaOddsPerm;
}

/**
 * Genera una nueva permutación garantizando que la "estrella" (personaje
 * con la cuota alta, rango 4) sea distinta a la de la ronda anterior.
 * En el primer call (prevStar=null) cualquier permutación es válida.
 */
export function nextArenaOddsPerm(prevStar: ArenaCharacterId | null): {
  perm: ArenaOddsPerm;
  odds: Record<ArenaCharacterId, number>;
  star: ArenaCharacterId;
} {
  for (let safety = 0; safety < 50; safety++) {
    const perm = shuffle4();
    const starIdx = perm.indexOf(4);
    const star = ARENA_CHARACTERS[starIdx];
    if (prevStar === null || star !== prevStar) {
      const odds = {} as Record<ArenaCharacterId, number>;
      ARENA_CHARACTERS.forEach((id, i) => {
        odds[id] = ARENA_BASE_ODDS[perm[i] - 1];
      });
      return { perm, odds, star };
    }
  }
  const perm = shuffle4();
  const odds = {} as Record<ArenaCharacterId, number>;
  ARENA_CHARACTERS.forEach((id, i) => {
    odds[id] = ARENA_BASE_ODDS[perm[i] - 1];
  });
  return { perm, odds, star: ARENA_CHARACTERS[perm.indexOf(4)] };
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