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

/**
 * Bias intensities (percent, 0-100) that tilt draws in the house's favor.
 * Higher = harder for the player. Defaults are tuned to land around
 * ~99% RTP; `getBlackjackBias()` scales them up when the configured
 * `rtp_target` for blackjack is lower than that.
 */
export type BJBias = {
  /** % chance the dealer's hole card gets swapped for a high card. */
  holePct: number;
  /** % chance a dealer hit lands in [17,21]. */
  dealerHitPct: number;
  /** % chance a player hit at score >= 12 draws a busting card. */
  playerBustPct: number;
};

export const BJ_DEFAULT_BIAS: BJBias = {
  holePct: 18,
  dealerHitPct: 14,
  playerBustPct: 12,
};

/** Map a configured RTP target to bias intensities. */
export function biasFromRtpTarget(rtpTarget: number): BJBias {
  // 99.5% is roughly the "fair" 6-deck S17 RTP. Anything lower means
  // the house wants extra edge; we scale biases proportionally.
  const extraEdge = Math.max(0, 99.5 - rtpTarget); // e.g. 99→0.5, 97→2.5
  const mult = Math.min(4, 1 + extraEdge); // 1x..4x
  const cap = (n: number) => Math.min(60, Math.round(n));
  return {
    holePct: cap(BJ_DEFAULT_BIAS.holePct * mult),
    dealerHitPct: cap(BJ_DEFAULT_BIAS.dealerHitPct * mult),
    playerBustPct: cap(BJ_DEFAULT_BIAS.playerBustPct * mult),
  };
}

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
 * Draw the dealer's hole card with a 9% bias toward a high rank.
 */
export function drawHoleBiased(
  shoe: Card[],
  bias: BJBias = BJ_DEFAULT_BIAS,
): { card: Card; shoe: Card[] } {
  if (shoe.length < RESHUFFLE_THRESHOLD) {
    shoe = makeShoe();
  }
  const top = shoe.pop()!;
  if (cryptoRandomInt(100) < bias.holePct && !HIGH_RANKS.has(top.rank)) {
    // Scan a wider window so the bias actually finds a high card.
    const lookback = Math.min(20, shoe.length);
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
 * Draw a card for the dealer's hit with a 6% bias toward a card that
 * lands the dealer in [17, 21].
 */
export function drawForDealerHit(
  shoe: Card[],
  currentScore: number,
  bias: BJBias = BJ_DEFAULT_BIAS,
  playerScore?: number,
): { card: Card; shoe: Card[] } {
  if (shoe.length < RESHUFFLE_THRESHOLD) {
    shoe = makeShoe();
  }
  if (cryptoRandomInt(100) < bias.dealerHitPct) {
    const lookback = Math.min(16, shoe.length);
    // Preferred range: tie-or-beat the player when we know their score,
    // otherwise just "land safely in 17-21".
    const targetMin =
      playerScore && playerScore <= 21
        ? Math.max(17, playerScore)
        : 17;
    const need = (v: number) => {
      const total = currentScore + v;
      return total >= targetMin && total <= 21;
    };
    // First pass: look for a card that ties or beats the player.
    for (let k = shoe.length - 1; k >= shoe.length - lookback; k--) {
      const c = shoe[k];
      const v = c.rank === "A" ? (currentScore + 11 <= 21 ? 11 : 1) : c.value;
      if (need(v)) {
        shoe.splice(k, 1);
        return { card: c, shoe };
      }
    }
    // Fallback: if we couldn't find a tie-or-beat card, accept any
    // card that keeps the dealer in [17,21] (better than busting).
    if (targetMin > 17) {
      for (let k = shoe.length - 1; k >= shoe.length - lookback; k--) {
        const c = shoe[k];
        const v = c.rank === "A" ? (currentScore + 11 <= 21 ? 11 : 1) : c.value;
        const total = currentScore + v;
        if (total >= 17 && total <= 21) {
          shoe.splice(k, 1);
          return { card: c, shoe };
        }
      }
    }
  }
  const card = shoe.pop()!;
  return { card, shoe };
}

/**
 * Draw a card for a player hit. When the player's current score is
 * already 12+, a small bias makes the next card more likely to bust
 * the hand (push the total over 21). Adds house edge on hit decisions.
 */
export function drawForPlayerHit(
  shoe: Card[],
  currentScore: number,
  bias: BJBias = BJ_DEFAULT_BIAS,
): { card: Card; shoe: Card[] } {
  if (shoe.length < RESHUFFLE_THRESHOLD) {
    shoe = makeShoe();
  }
  if (currentScore >= 12 && cryptoRandomInt(100) < bias.playerBustPct) {
    const lookback = Math.min(16, shoe.length);
    const minBustValue = 22 - currentScore; // any card >= this busts
    for (let k = shoe.length - 1; k >= shoe.length - lookback; k--) {
      const c = shoe[k];
      // For aces, the soft logic in handScore will demote — only count as bust if hard.
      const v = c.rank === "A" ? 1 : c.value;
      if (v >= minBustValue) {
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
  bias: BJBias = BJ_DEFAULT_BIAS,
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
      const { card, shoe: nextShoe } = drawForDealerHit(shoe, score, bias, pScore);
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