import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Settings, Minus, Plus } from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import bgAsset from "@/assets/blackjack-bg.png.asset.json";

type Phase = "betting" | "dealing" | "playing" | "dealerTurn" | "result";
type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { suit: Suit; rank: string; value: number; hidden?: boolean };
type Outcome = "win" | "lose" | "push" | "blackjack" | "bust";

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS = [
  { r: "A", v: 11 },
  { r: "2", v: 2 }, { r: "3", v: 3 }, { r: "4", v: 4 }, { r: "5", v: 5 },
  { r: "6", v: 6 }, { r: "7", v: 7 }, { r: "8", v: 8 }, { r: "9", v: 9 },
  { r: "10", v: 10 }, { r: "J", v: 10 }, { r: "Q", v: 10 }, { r: "K", v: 10 },
];

const MIN_BET = 500;
const MAX_BET = 100000;
const BET_STEP = 500;
const QUICK = [500, 1000, 2000, 5000];

function makeShoe(): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < 6; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) deck.push({ suit: s, rank: r.r, value: r.v });
    }
  }
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handScore(cards: Card[]): number {
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

function isBlackjack(cards: Card[]) {
  return cards.length === 2 && handScore(cards) === 21;
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function CardView({ card, idx, total, hidden }: { card: Card; idx: number; total: number; hidden?: boolean }) {
  // Compute overlap offset that shrinks as count grows
  const maxSpread = 38; // px between cards
  const minSpread = 18;
  const spread = Math.max(minSpread, maxSpread - (total - 2) * 4);
  const offset = (idx - (total - 1) / 2) * spread;
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      className="absolute top-0 left-1/2 h-[104px] w-[72px] sm:h-[118px] sm:w-[82px] rounded-md shadow-[0_4px_14px_rgba(0,0,0,0.55)] transition-all duration-300"
      style={{
        transform: `translate(calc(-50% + ${offset}px), 0) rotate(${(idx - (total - 1) / 2) * 2}deg)`,
        zIndex: idx + 1,
        animation: "bj-deal 0.45s ease-out both",
        animationDelay: `${idx * 0.12}s`,
      }}
    >
      {hidden ? (
        <div className="h-full w-full rounded-md border border-purple-300/60 bg-gradient-to-br from-[#3a1a78] to-[#1a0848] flex items-center justify-center">
          <div className="h-[80%] w-[80%] rounded-sm border border-purple-300/40 flex items-center justify-center text-purple-200/80 text-2xl">♠</div>
        </div>
      ) : (
        <div className="h-full w-full rounded-md border border-white/70 bg-white flex flex-col justify-between p-1.5">
          <div className={`text-left leading-none ${red ? "text-rose-600" : "text-slate-900"}`}>
            <div className="text-sm font-black sm:text-base">{card.rank}</div>
            <div className="text-xs sm:text-sm">{card.suit}</div>
          </div>
          <div className={`text-right text-xl sm:text-2xl leading-none ${red ? "text-rose-600" : "text-slate-900"}`}>
            {card.suit}
          </div>
        </div>
      )}
    </div>
  );
}

export function BlackjackGame() {
  const [balance, setBalance] = useState(100000);
  const [bet, setBet] = useState(2000);
  const [phase, setPhase] = useState<Phase>("betting");
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [payout, setPayout] = useState(0);
  const [doubled, setDoubled] = useState(false);
  const shoeRef = useRef<Card[]>(makeShoe());

  // Live "last winners" ticker
  type Winner = { id: number; name: string; amount: number; game: string };
  const NAMES = ["Carlos_07", "Maria.V", "Andrés", "Lucia91", "JuanK", "Sofi", "ElCapo", "Nico", "Daniela", "PipeR", "ValeM", "MateoG", "Camila", "RoyalK", "MissL", "JoseF", "Karen", "Sebas", "TaniaP", "BrayanX"];
  const GAMES = ["Blackjack", "Spaceman", "Minas", "Slot", "Dados"];
  const randWinner = (id: number): Winner => ({
    id,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    amount: (Math.floor(Math.random() * 195) + 5) * 1000,
    game: GAMES[Math.floor(Math.random() * GAMES.length)],
  });
  const seedRef = useRef(0);
  const [winners, setWinners] = useState<Winner[]>(() =>
    Array.from({ length: 8 }, () => randWinner(++seedRef.current))
  );
  useEffect(() => {
    const t = setInterval(() => {
      setWinners((ws) => [randWinner(++seedRef.current), ...ws].slice(0, 20));
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const draw = useCallback((): Card => {
    if (shoeRef.current.length < 20) shoeRef.current = makeShoe();
    return shoeRef.current.pop()!;
  }, []);

  const playerScore = handScore(player);
  const dealerScore = handScore(dealer);

  const resolve = useCallback((p: Card[], d: Card[], betAmount: number) => {
    const pBJ = isBlackjack(p);
    const dBJ = isBlackjack(d);
    const pScore = handScore(p);
    const dScore = handScore(d);
    let result: Outcome = "lose";
    let win = 0;
    if (pScore > 21) { result = "bust"; win = 0; }
    else if (pBJ && !dBJ) { result = "blackjack"; win = Math.floor(betAmount * 2.5); }
    else if (pBJ && dBJ) { result = "push"; win = betAmount; }
    else if (dScore > 21 || pScore > dScore) { result = "win"; win = betAmount * 2; }
    else if (pScore === dScore) { result = "push"; win = betAmount; }
    else { result = "lose"; win = 0; }
    setOutcome(result);
    setPayout(win);
    if (win > 0) setBalance((b) => b + win);
    setPhase("result");
  }, []);

  const dealerPlay = useCallback((p: Card[], d: Card[], betAmount: number) => {
    // Reveal hidden
    const revealed: Card[] = d.map((c) => ({ ...c, hidden: false }));
    setDealer(revealed);
    setPhase("dealerTurn");
    let current: Card[] = [...revealed];
    const step = () => {
      const score = handScore(current);
      if (score < 17) {
        const c = draw();
        current = [...current, c];
        setDealer([...current]);
        setTimeout(step, 600);
      } else {
        setTimeout(() => resolve(p, current, betAmount), 500);
      }
    };
    setTimeout(step, 700);
  }, [draw, resolve]);

  const onDeal = () => {
    if (bet > balance || bet < MIN_BET) return;
    setBalance((b) => b - bet);
    setOutcome(null);
    setPayout(0);
    setDoubled(false);
    const p: Card[] = [draw(), draw()];
    const hole: Card = { ...draw(), hidden: true };
    const d: Card[] = [draw(), hole];
    setPlayer(p);
    setDealer(d);
    setPhase("dealing");
    setTimeout(() => {
      if (isBlackjack(p)) {
        dealerPlay(p, d, bet);
      } else {
        setPhase("playing");
      }
    }, 900);
  };

  const onHit = () => {
    if (phase !== "playing") return;
    const c = draw();
    const np = [...player, c];
    setPlayer(np);
    if (handScore(np) >= 21) {
      setTimeout(() => dealerPlay(np, dealer, doubled ? bet * 2 : bet), 600);
    }
  };

  const onStand = () => {
    if (phase !== "playing") return;
    dealerPlay(player, dealer, doubled ? bet * 2 : bet);
  };

  const onDouble = () => {
    if (phase !== "playing" || player.length !== 2 || bet > balance) return;
    setBalance((b) => b - bet);
    setDoubled(true);
    const c = draw();
    const np = [...player, c];
    setPlayer(np);
    setTimeout(() => dealerPlay(np, dealer, bet * 2), 700);
  };

  const onNewHand = () => {
    setPlayer([]);
    setDealer([]);
    setOutcome(null);
    setPayout(0);
    setPhase("betting");
  };

  const adjustBet = (delta: number) => {
    setBet((b) => Math.min(MAX_BET, Math.max(MIN_BET, b + delta)));
  };

  const showDealerScore = phase !== "betting" && phase !== "dealing" && phase !== "playing";

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-hidden bg-[#060210] text-white"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <style>{`
        @keyframes bj-deal {
          0% { transform: translate(calc(-50% + 0px), -120px) rotate(0deg); opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes bj-glow {
          0%,100% { box-shadow: 0 0 0 rgba(168,85,247,0); }
          50% { box-shadow: 0 0 28px rgba(168,85,247,0.85), 0 0 60px rgba(217,70,239,0.55); }
        }
        @keyframes bj-pop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Background */}
      <img
        src={bgAsset.url}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "center top" }}
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060210]/60 via-transparent to-[#060210]/30" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-3 sm:max-w-lg sm:px-4">
        {/* Header — same as Mines */}
        <header
          className="flex items-center justify-between border-b border-purple-500/20 bg-[#060210]/80 px-3 pb-3 -mx-3 backdrop-blur-sm"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-1">
            <Link to="/home" className="rounded-md p-2 text-white hover:bg-white/10">
              <Menu className="h-7 w-7" strokeWidth={3} />
            </Link>
            <Link to="/home">
              <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="font-display text-xs font-bold text-white sm:text-sm">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </header>

        {/* Play area — flex-1, with absolutely positioned card zones */}
        <div className="relative flex-1">
          {/* Dealer hand — over the top card slots in the background (~22% of play area) */}
          <div className="absolute left-1/2 top-[14%] -translate-x-1/2">
            <div className="relative h-[100px] w-[200px]">
              {dealer.map((c, i) => (
                <CardView key={`d-${i}`} card={c} idx={i} total={dealer.length} hidden={c.hidden} />
              ))}
            </div>
            {showDealerScore && dealer.length > 0 && (
              <div className="mt-2 text-center">
                <span className="rounded-full border border-purple-400/50 bg-[#1a0b3a]/80 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-purple-100">
                  DEALER: {handScore(dealer)}
                </span>
              </div>
            )}
          </div>

          {/* Player hand — over the bottom card slots */}
          <div className="absolute left-1/2 top-[52%] -translate-x-1/2">
            <div className="relative h-[100px] w-[220px]">
              {player.map((c, i) => (
                <CardView key={`p-${i}`} card={c} idx={i} total={player.length} />
              ))}
            </div>
            {player.length > 0 && (
              <div className="mt-2 text-center">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${
                    playerScore > 21
                      ? "border-rose-400/60 bg-rose-900/40 text-rose-100"
                      : "border-emerald-400/50 bg-emerald-900/30 text-emerald-100"
                  }`}
                >
                  TÚ: {playerScore}
                </span>
              </div>
            )}
          </div>

          {/* Result overlay */}
          {phase === "result" && outcome && (
            <div className="absolute left-1/2 top-[38%] -translate-x-1/2 text-center" style={{ animation: "bj-pop 0.4s ease-out both" }}>
              <div
                className={`rounded-2xl border px-6 py-3 backdrop-blur-md ${
                  outcome === "win" || outcome === "blackjack"
                    ? "border-emerald-400/70 bg-emerald-950/60"
                    : outcome === "push"
                    ? "border-purple-400/70 bg-purple-950/60"
                    : "border-rose-400/70 bg-rose-950/60"
                }`}
                style={
                  outcome === "win" || outcome === "blackjack"
                    ? { animation: "bj-glow 1.6s ease-in-out infinite" }
                    : undefined
                }
              >
                <div className="font-display text-2xl font-black tracking-wider">
                  {outcome === "blackjack" && "¡BLACKJACK!"}
                  {outcome === "win" && "¡GANASTE!"}
                  {outcome === "push" && "EMPATE"}
                  {outcome === "lose" && "PERDISTE"}
                  {outcome === "bust" && "TE PASASTE"}
                </div>
                {payout > 0 && (
                  <div className="mt-1 text-sm font-bold text-emerald-300">
                    +${formatCOP(payout)} COP
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic HUD */}
        <div className="relative z-10 mx-auto w-full max-w-md px-1 pt-1">
          {phase === "betting" && (
            <div className="rounded-2xl border border-purple-500/40 bg-[#0c0620]/85 p-3 shadow-[0_0_20px_rgba(168,85,247,0.25)] backdrop-blur-md">
              <div className="text-center text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
                Apuesta
              </div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => adjustBet(-BET_STEP)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-400/50 bg-purple-900/40 text-purple-100 active:scale-95"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <div className="font-display text-2xl font-black text-white">
                  <span className="neon-green mr-0.5">$</span>{formatCOP(bet)}
                </div>
                <button
                  onClick={() => adjustBet(BET_STEP)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-400/50 bg-purple-900/40 text-purple-100 active:scale-95"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => setBet((b) => Math.min(MAX_BET, b + q))}
                    className="rounded-md border border-purple-500/40 bg-purple-900/30 px-2.5 py-1 text-[11px] font-bold text-purple-100 active:scale-95"
                  >
                    +{q >= 1000 ? `${q / 1000}K` : q}
                  </button>
                ))}
              </div>
              <button
                onClick={onDeal}
                disabled={bet > balance}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 font-display text-base font-black uppercase tracking-widest text-white shadow-[0_0_18px_rgba(217,70,239,0.55)] transition active:scale-[0.98] disabled:opacity-50"
              >
                Repartir
              </button>
            </div>
          )}

          {(phase === "playing" || phase === "dealing" || phase === "dealerTurn") && (
            <div className="rounded-2xl border border-purple-500/40 bg-[#0c0620]/85 p-3 shadow-[0_0_20px_rgba(168,85,247,0.25)] backdrop-blur-md">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
                <span>Apuesta: <span className="text-white">${formatCOP(doubled ? bet * 2 : bet)}</span></span>
                <span>Puntos: <span className="text-white">{playerScore}</span></span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  onClick={onHit}
                  disabled={phase !== "playing"}
                  className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 px-2 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-md active:scale-95 disabled:opacity-40"
                >
                  Pedir
                </button>
                <button
                  onClick={onStand}
                  disabled={phase !== "playing"}
                  className="rounded-xl bg-gradient-to-b from-fuchsia-600 to-purple-700 px-2 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-md active:scale-95 disabled:opacity-40"
                >
                  Plantarse
                </button>
                <button
                  onClick={onDouble}
                  disabled={phase !== "playing" || player.length !== 2 || bet > balance}
                  className="rounded-xl border-2 border-purple-400 bg-transparent px-2 py-2.5 text-sm font-black uppercase tracking-wider text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.45)] active:scale-95 disabled:opacity-40"
                >
                  Doblar
                </button>
              </div>
            </div>
          )}

          {phase === "result" && (
            <div className="rounded-2xl border border-purple-500/40 bg-[#0c0620]/85 p-3 shadow-[0_0_20px_rgba(168,85,247,0.25)] backdrop-blur-md">
              <button
                onClick={onNewHand}
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 font-display text-base font-black uppercase tracking-widest text-white shadow-[0_0_18px_rgba(217,70,239,0.55)] transition active:scale-[0.98]"
              >
                Nueva Mano
              </button>
            </div>
          )}
        </div>

        {/* Last winners ticker */}
        <div
          className="relative z-10 mx-auto mt-2 w-full max-w-md px-1"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        >
          <div className="rounded-xl border border-purple-500/30 bg-[#0c0620]/80 px-2 py-1.5 backdrop-blur-md">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-purple-200/80">
                Últimos ganadores
              </span>
            </div>
            <div className="relative h-[26px] overflow-hidden">
              <div className="flex flex-col gap-1">
                {winners.slice(0, 4).map((w, i) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between text-[11px]"
                    style={{
                      animation: i === 0 ? "bj-winner-in 0.5s ease-out both" : undefined,
                      opacity: i === 0 ? 1 : 0.55 - i * 0.12,
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-bold text-white">{w.name}</span>
                      <span className="hidden truncate text-[9px] uppercase tracking-wider text-purple-300/70 sm:inline">
                        · {w.game}
                      </span>
                    </span>
                    <span className="font-display font-black text-emerald-300">
                      +${formatCOP(w.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Avoid unused import warning when builds are strict
export default BlackjackGame;