/**
 * Pure Blackjack types + helpers. Safe to import from client AND server.
 * The shoe + RNG + draw logic live in blackjack.server.ts.
 */

export type Suit = "♠" | "♥" | "♦" | "♣";

export type Card = {
  suit: Suit;
  rank: string;
  value: number;
  hidden?: boolean;
};

export type BJPhase = "playing" | "result";
export type BJOutcome = "win" | "lose" | "push" | "blackjack" | "bust";

export type BJPublicState = {
  player: Card[];
  /** Dealer cards. Hole card has `hidden: true` until settle. */
  dealer: Card[];
  bet: number;
  doubled: boolean;
  phase: BJPhase;
  outcome?: BJOutcome;
  payout?: number;
  /** Optional sequence of cards dealt to the dealer during their turn,
   *  in order, so the client can animate them one by one. */
  dealerSequence?: Card[];
};

export const BJ_MIN_BET = 500;
export const BJ_MAX_BET = 100000;
export const BJ_BET_STEP = 500;

export const BJ_SUITS: readonly Suit[] = ["♠", "♥", "♦", "♣"];
export const BJ_RANKS = [
  { r: "A",  v: 11 },
  { r: "2",  v: 2  },
  { r: "3",  v: 3  },
  { r: "4",  v: 4  },
  { r: "5",  v: 5  },
  { r: "6",  v: 6  },
  { r: "7",  v: 7  },
  { r: "8",  v: 8  },
  { r: "9",  v: 9  },
  { r: "10", v: 10 },
  { r: "J",  v: 10 },
  { r: "Q",  v: 10 },
  { r: "K",  v: 10 },
] as const;

/** Score a hand using soft-ace logic. Hidden cards are skipped. */
export function handScore(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    total += c.value;
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handScore(cards) === 21;
}