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
  /** True when the dealer's up-card is an Ace and the player has not
   *  yet accepted/declined insurance. While true, the "Doblar" button
   *  in the UI is replaced by "Seguro". Hit/Stand/Double implicitly
   *  decline insurance. */
  insuranceOffered?: boolean;
  /** Whether the player accepted the insurance side bet. */
  insuranceTaken?: boolean;
  /** Amount debited as insurance (floor(bet/2) when taken, else 0). */
  insuranceCost?: number;
  /** Insurance payout returned to the player (3x cost on dealer BJ, else 0). */
  insurancePayout?: number;
};

export const BJ_MIN_BET = 500;
export const BJ_MAX_BET = 50000;
export const BJ_BET_STEP = 500;

/* ------------------------------------------------------------------ */
/* Variants                                                            */
/* ------------------------------------------------------------------ */

/** Game keys for the different Blackjack tables we expose. They share
 *  the exact same engine and rules — only bet limits, RTP config row,
 *  and visual theme differ. Stats are naturally separated by the `game`
 *  column in `game_sessions` and `transactions`. */
export type BJVariantKey = "blackjack" | "blackjack_vip";

export type BJVariantConfig = {
  gameKey: BJVariantKey;
  minBet: number;
  maxBet: number;
  betStep: number;
};

export const BJ_VARIANTS: Record<BJVariantKey, BJVariantConfig> = {
  blackjack: {
    gameKey: "blackjack",
    minBet: BJ_MIN_BET,
    maxBet: BJ_MAX_BET,
    betStep: BJ_BET_STEP,
  },
  blackjack_vip: {
    gameKey: "blackjack_vip",
    minBet: 5_000,
    maxBet: 200_000,
    betStep: 1_000,
  },
};

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