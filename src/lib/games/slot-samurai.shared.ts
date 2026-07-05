/**
 * Samurai Legend slot — pure data + evaluation. Safe to import from client AND server.
 * Mirrors the SQL function `spin_slot_samurai_v1` (5x3 grid, 20 paylines, Pay Both Ways).
 */

export type SamuraiSymbol = {
  id: string;
  pay: readonly [number, number, number]; // 3 / 4 / 5 of a kind, multiplier of LINE BET
  weight: number;
};

export const SAMURAI_SYMBOLS: readonly SamuraiSymbol[] = [
  { id: "boss",  pay: [55, 240, 1100], weight: 2  },
  { id: "car",   pay: [34, 130, 440],  weight: 3  },
  { id: "brief", pay: [24, 72, 240],   weight: 4  },
  { id: "gold",  pay: [19, 50, 165],   weight: 5  },
  { id: "watch", pay: [13, 32, 95],    weight: 6  },
  { id: "chip",  pay: [10, 24, 68],    weight: 8  },
  { id: "hat",   pay: [8, 18, 50],     weight: 10 },
  { id: "card",  pay: [7, 14, 32],     weight: 12 },
] as const;

/** 20 paylines for a 5x3 grid (row index per reel, 0=top, 2=bottom). */
export const SAMURAI_PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 1, 2, 2, 2],
  [2, 1, 0, 0, 0],
  [1, 0, 2, 0, 1],
];

export const SAMURAI_REELS = 5;
export const SAMURAI_ROWS = 3;
export const SAMURAI_MIN_BET = 500;
export const SAMURAI_MAX_BET = 50000;
export const SAMURAI_BET_STEP = 500;
export const SAMURAI_LINES = SAMURAI_PAYLINES.length;

export type SamuraiSlotWin = {
  lineIdx: number;
  symbolId: string;
  count: number;
  payout: number;
  cells: [number, number][];
};