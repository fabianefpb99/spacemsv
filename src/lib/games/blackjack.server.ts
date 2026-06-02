/**
 * Server-only Blackjack engine. Holds the shoe, draws cards with
 * crypto-grade RNG, applies the (small) house edge bias, and resolves
 * the dealer's turn. NEVER import from client code.
 */
import {
  BJ_RANKS,
  BJ_SUITS,
  type Card,
  type BJOutcome,
  handScore,
  isBlackjack,
} from "./blackjack.shared";
import { cryptoRandomInt } from "./engine.server";

const DECK_COUNT = 6;
const RESHUFFLE_THRESHOLD = 20;
const HIGH_RANKS = new Set(["10", "J", "Q", "K", "A"]);

/** Build a 6-deck shoe (312 cards) and Fisher-Yates shuffle with crypto RNG. */
export function makeShoe(): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < DECK_COUNT; d++) {
    for (const s of BJ_SUITS) {
      for (const r of BJ_RANKS) {
        deck.push({ suit: s, rank: r.r, value: r.v });
      }
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Mutates `shoe` (pops from the end), reshuffling if running low. */
export function drawCard(shoe: Card[]): { card: Card; shoe: Card[] } {
  if (shoe.length < RESHUFFLE_THRESHOLD) {
    shoe = makeShoe();
  }
  const card = shoe.pop()!;
  return { card, shoe };
}

/**
 * Draw the dealer's hole card with an 8% bias toward a high rank.
 * Identical odds to the previous client implementation.
 */
export function drawHoleBiased(shoe: Card[]): { card: Card; shoe: Card[] } {
  if (shoe.length < RESHUFFLE_THRESHOLD) {
    shoe = makeShoe();
  }
  const top = shoe.pop()!;
  if (cryptoRandomInt(100) < 8 && !HIGH_RANKS.has(top.rank)) {
    const lookback = Math.min(6, shoe.length);
    for (let k = shoe.length - 1; k >= shoe.length - lookback; k--) {
      if (HIGH_RANKS.has(shoe[k].rank)) {
        const swapped = shoe[k];
        shoe[k] = top;
        return { card: swapped, shoe };
      }
    }
  }
  return { card: top, shoe };
}

/**
 * Draw a card for the dealer's hit with a 5% bias toward a card that
 * lands the dealer in [17, 21]. Identical odds to the client version.
 */
export function drawForDealerHit(
  shoe: Card[],
  currentScore: number,
): { card: Card; shoe: Card[] } {
  if (shoe.length < RESHUFFLE_THRESHOLD) {
    shoe = makeShoe();
  }
  if (cryptoRandomInt(100) < 5) {
    const lookback = Math.min(4, shoe.length);
    const need = (v: number) => {
      const total = currentScore + v;
      return total >= 17 && total <= 21;
    };
    for (let k = shoe.length - 1; k >= shoe.length - lookback; k--) {
      const c = shoe[k];
      const v = c.rank === "A" ? (currentScore + 11 <= 21 ? 11 : 1) : c.value;
      if (need(v)) {
        shoe.splice(k, 1);
        return { card: c, shoe };
      }
    }
  }
  const card = shoe.pop()!;
  return { card, shoe };
}

/**
 * Play the dealer's turn end-to-end and resolve the hand. Returns the
 * full sequence of cards drawn so the client can animate them, plus the
 * final outcome + payout.
 */
export function resolveHand(
  shoe: Card[],
  player: Card[],
  dealer: Card[],
  bet: number,
): {
  shoe: Card[];
  dealer: Card[];
  dealerSequence: Card[];
  outcome: BJOutcome;
  payout: number;
} {
  const revealedDealer: Card[] = dealer.map((c) => ({ ...c, hidden: false }));
  const dealerSequence: Card[] = [];

  const pScore = handScore(player);

  // Player already bust → dealer doesn't need to play.
  if (pScore <= 21) {
    while (handScore(revealedDealer) < 17) {
      const score = handScore(revealedDealer);
      const { card, shoe: nextShoe } = drawForDealerHit(shoe, score);
      shoe = nextShoe;
      revealedDealer.push(card);
      dealerSequence.push(card);
    }
  }

  const dScore = handScore(revealedDealer);
  const pBJ = isBlackjack(player);
  const dBJ = isBlackjack(revealedDealer);

  let outcome: BJOutcome = "lose";
  let payout = 0;

  if (pScore > 21) {
    outcome = "bust";
    payout = 0;
  } else if (pBJ && !dBJ) {
    outcome = "blackjack";
    payout = Math.floor(bet * 2.5);
  } else if (pBJ && dBJ) {
    outcome = "push";
    payout = bet;
  } else if (dScore > 21 || pScore > dScore) {
    outcome = "win";
    payout = bet * 2;
  } else if (pScore === dScore) {
    outcome = "push";
    payout = bet;
  } else {
    outcome = "lose";
    payout = 0;
  }

  return { shoe, dealer: revealedDealer, dealerSequence, outcome, payout };
}