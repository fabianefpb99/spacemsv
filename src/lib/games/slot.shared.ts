/**
 * Slot game pure data + evaluation. Safe to import from client AND server.
 * The actual RNG and balance mutations live in slot.functions.ts (server-only).
 */

export type SlotSymbol = {
  id: string;
  pay: readonly [number, number, number]; // 3 / 4 / 5 of a kind, multiplier of LINE BET
  weight: number;
};

export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  // Ajuste 2026-07-30: premios de 3 iguales -3%; ese valor se traslada a los
  // premios mayores (5 iguales, +~29%). Espejo exacto de `spin_slot_v1`.
  { id: "boss",  pay: [53, 240, 1420], weight: 2  },
  { id: "car",   pay: [33, 130, 570],  weight: 3  },
  { id: "brief", pay: [23, 72, 310],   weight: 4  },
  { id: "gold",  pay: [18, 50, 213],   weight: 5  },
  { id: "watch", pay: [16, 32, 123],   weight: 6  },
  { id: "chip",  pay: [14, 24, 88],    weight: 8  },
  { id: "hat",   pay: [11, 18, 65],    weight: 11 },
  { id: "card",  pay: [11, 14, 41],    weight: 13 },
] as const;

export const SLOT_PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 0, 0, 0, 0],
  [3, 3, 3, 3, 3],
  [0, 1, 2, 1, 0],
  [3, 2, 1, 2, 3],
  [1, 2, 3, 2, 1],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [3, 3, 2, 1, 1],
  [1, 0, 0, 0, 1],
  [2, 3, 3, 3, 2],
  [0, 1, 1, 1, 0],
  [3, 2, 2, 2, 3],
  [1, 2, 1, 2, 1],
  [2, 1, 2, 1, 2],
  [0, 1, 2, 3, 3],
  [3, 2, 1, 0, 0],
  [1, 1, 2, 3, 3],
  [2, 2, 1, 0, 0],
  [0, 2, 0, 2, 0],
  [3, 1, 3, 1, 3],
  [1, 0, 1, 0, 1],
  [2, 3, 2, 3, 2],
  [0, 3, 0, 3, 0],
];

export const SLOT_REELS = 5;
export const SLOT_ROWS = 4;
export const SLOT_MIN_BET = 500;
export const SLOT_MAX_BET = 50000;
export const SLOT_BET_STEP = 500;
export const SLOT_LINES = SLOT_PAYLINES.length;

const SLOT_SYMBOL_INDEX = new Map(SLOT_SYMBOLS.map((s, i) => [s.id, i]));

export type SlotWin = {
  lineIdx: number;
  symbolId: string;
  count: number;
  payout: number;
  cells: [number, number][];
};

/**
 * Evaluate a 5x4 slot grid (grid[reel][row]) against the 25 paylines,
 * Pay Both Ways. Mirrors the original client logic exactly so the
 * payout tables remain identical.
 */
export function evaluateSlotGrid(
  grid: string[][],
  lineBet: number,
): { wins: SlotWin[]; total: number } {
  const wins: SlotWin[] = [];
  SLOT_PAYLINES.forEach((line, lineIdx) => {
    // L → R
    const firstSym = grid[0][line[0]];
    let countL = 1;
    for (let r = 1; r < SLOT_REELS; r++) {
      if (grid[r][line[r]] === firstSym) countL++;
      else break;
    }
    if (countL >= 3) {
      const sym = SLOT_SYMBOLS[SLOT_SYMBOL_INDEX.get(firstSym)!];
      const payout = sym.pay[countL - 3] * lineBet;
      if (payout > 0) {
        const cells: [number, number][] = [];
        for (let r = 0; r < countL; r++) cells.push([r, line[r]]);
        wins.push({ lineIdx, symbolId: firstSym, count: countL, payout, cells });
      }
    }
    // R → L (skip if the L→R already covered all 5 reels)
    if (countL >= SLOT_REELS) return;
    const lastSym = grid[SLOT_REELS - 1][line[SLOT_REELS - 1]];
    let countR = 1;
    for (let r = SLOT_REELS - 2; r >= 0; r--) {
      if (grid[r][line[r]] === lastSym) countR++;
      else break;
    }
    if (countR >= 3) {
      const sym = SLOT_SYMBOLS[SLOT_SYMBOL_INDEX.get(lastSym)!];
      const payout = sym.pay[countR - 3] * lineBet;
      if (payout > 0) {
        const cells: [number, number][] = [];
        for (let i = 0; i < countR; i++) {
          const r = SLOT_REELS - 1 - i;
          cells.push([r, line[r]]);
        }
        wins.push({
          lineIdx: lineIdx + SLOT_PAYLINES.length,
          symbolId: lastSym,
          count: countR,
          payout,
          cells,
        });
      }
    }
  });
  const total = wins.reduce((a, w) => a + w.payout, 0);
  return { wins, total };
}