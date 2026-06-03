import { AuthControl } from "@/components/auth/AuthControl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FitText } from "@/components/ui/fit-text";
import { BetAmount } from "@/components/games/BetAmount";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Menu, Minus, Plus, Volume2, VolumeX } from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import bgAsset from "@/assets/blackjack-bg.png.asset.json";
import {
  playCardDealSound,
  startBlackjackAmbient,
  stopBlackjackAmbient,
  setMuted as setAudioMuted,
  isMuted as getAudioMuted,
  stopAllGameAudio,
} from "@/lib/gameAudio";
import { useMe, type MeData } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { toFriendlyError } from "@/lib/friendly-error";
import {
  bjDeal,
  bjDouble,
  bjHit,
  bjResume,
  bjStand,
  type BJSessionView,
} from "@/lib/games/blackjack.functions";
import {
  BJ_BET_STEP,
  BJ_MAX_BET,
  BJ_MIN_BET,
  type BJOutcome,
  type BJPublicState,
  type Card,
  handScore,
} from "@/lib/games/blackjack.shared";

type Phase = "betting" | "dealing" | "playing" | "dealerTurn" | "result";
type Winner = { id: number; name: string; amount: number; game: string };
type WinnerSlot = Winner & { slotId: number };

const QUICK = [500, 1000, 2000, 5000];
const TICKER_SPEED_PX_PER_MS = 0.06;
const TICKER_ITEM_WIDTH = 198;
const TICKER_GAP = 12;
const NAMES = ["Carlos_07", "Maria.V", "Andrés", "Lucia91", "JuanK", "Sofi", "ElCapo", "Nico", "Daniela", "PipeR", "ValeM", "MateoG", "Camila", "RoyalK", "MissL", "JoseF", "Karen", "Sebas", "TaniaP", "BrayanX"];
const GAMES = ["Blackjack", "Spaceman", "Minas", "Slot", "Dados"];
const INITIAL_WINNERS: Winner[] = [
  { id: 1, name: "Andrés", amount: 185000, game: "Spaceman" },
  { id: 2, name: "Camila", amount: 92000, game: "Minas" },
  { id: 3, name: "JoseF", amount: 241000, game: "Blackjack" },
  { id: 4, name: "Karen", amount: 158000, game: "Dados" },
  { id: 5, name: "Lucia91", amount: 214000, game: "Spaceman" },
  { id: 6, name: "MateoG", amount: 126000, game: "Blackjack" },
  { id: 7, name: "ValeM", amount: 67000, game: "Slot" },
  { id: 8, name: "Sofi", amount: 154000, game: "Minas" },
  { id: 9, name: "ElCapo", amount: 312000, game: "Spaceman" },
  { id: 10, name: "Nico", amount: 88000, game: "Dados" },
  { id: 11, name: "Daniela", amount: 173000, game: "Blackjack" },
  { id: 12, name: "PipeR", amount: 96000, game: "Slot" },
];

function pickDifferent(options: string[], blocked: string[]) {
  const available = options.filter((option) => !blocked.includes(option));
  const pool = available.length > 0 ? available : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeLiveWinner(id: number, current: Winner[]): Winner {
  return {
    id,
    name: pickDifferent(NAMES, current.slice(-4).map((w) => w.name)),
    amount: (Math.floor(Math.random() * 195) + 5) * 1000,
    game: pickDifferent(GAMES, current.slice(-3).map((w) => w.game)),
  };
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function uuid(): string {
  // Browser-only call site; falls back to a low-quality id only if crypto missing.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function CardView({ card, idx, total, hidden }: { card: Card; idx: number; total: number; hidden?: boolean }) {
  const maxSpread = 38;
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
  const { user } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();

  const realBalance = me.data?.balance ?? 0;
  const bonusBalance = me.data?.bonus_balance ?? 0;
  const balance = realBalance + bonusBalance;

  const dealFn = useServerFn(bjDeal);
  const hitFn = useServerFn(bjHit);
  const standFn = useServerFn(bjStand);
  const doubleFn = useServerFn(bjDouble);
  const resumeFn = useServerFn(bjResume);

  const [bet, setBet] = useState(2000);
  const [phase, setPhase] = useState<Phase>("betting");
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [outcome, setOutcome] = useState<BJOutcome | null>(null);
  const [payout, setPayout] = useState(0);
  const [doubled, setDoubled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server session tracking
  const sessionRef = useRef<{ id: string; nonce: number } | null>(null);
  // Synchronous in-flight lock. `busy` is React state (async) and can't block
  // a second click that lands in the same tick — that races the nonce and
  // makes the server reject the second call with `bj_stale_nonce`.
  const inFlightRef = useRef(false);

  const [muted, setMuted] = useState<boolean>(() => (typeof window === "undefined" ? false : getAudioMuted()));

  // Lounge ambient
  useEffect(() => {
    stopAllGameAudio();
    if (!muted) startBlackjackAmbient();
    return () => { stopBlackjackAmbient(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAudioMuted(muted);
    if (muted) stopBlackjackAmbient();
    else startBlackjackAmbient();
  }, [muted]);

  // Push the server-confirmed balance into the useMe cache so the header
  // updates instantly without waiting for a refetch.
  const applyBalance = useCallback(
    (newBalance: number) => {
      if (!user) return;
      queryClient.setQueryData<MeData | null>(["me", user.id], (prev) =>
        prev ? { ...prev, balance: newBalance } : prev,
      );
    },
    [queryClient, user],
  );

  // Hydrate visible state from a server snapshot.
  const applyServerState = useCallback((view: BJSessionView) => {
    sessionRef.current = { id: view.session_id, nonce: view.nonce };
    const pub = view.public_state;
    setPlayer(pub.player);
    setDealer(pub.dealer);
    setBet(pub.bet);
    setDoubled(pub.doubled);
    if (pub.phase === "result") {
      setOutcome(pub.outcome ?? null);
      setPayout(pub.payout ?? 0);
      setPhase("result");
    } else {
      setOutcome(null);
      setPayout(0);
      setPhase("playing");
    }
    applyBalance(view.new_balance);
  }, [applyBalance]);

  // Animate the dealer turn: reveal the hole card, then deal each card
  // from `dealerSequence` with a 600ms cadence. Returns when the show is
  // over so the caller can flip the phase to "result".
  const animateDealerReveal = useCallback(
    (revealedDealer: Card[], dealerSequence: Card[] | undefined): Promise<void> => {
      return new Promise((resolve) => {
        // Step 1: flip the hole card (replace hidden with the first revealed card)
        const initial: Card[] = revealedDealer.slice(0, 2);
        setDealer(initial);
        playCardDealSound();
        setPhase("dealerTurn");

        const seq = dealerSequence ?? [];
        let idx = 0;
        const tick = () => {
          if (idx >= seq.length) {
            setTimeout(resolve, 400);
            return;
          }
          const nextCards = revealedDealer.slice(0, 2 + idx + 1);
          setDealer(nextCards);
          playCardDealSound();
          idx++;
          setTimeout(tick, 600);
        };
        setTimeout(tick, 700);
      });
    },
    [],
  );

  // Settle: run the dealer animation then show the result card.
  const settleAnimated = useCallback(
    async (view: BJSessionView) => {
      const pub = view.public_state;
      sessionRef.current = { id: view.session_id, nonce: view.nonce };
      setBet(pub.bet);
      setDoubled(pub.doubled);
      setPlayer(pub.player);
      await animateDealerReveal(pub.dealer, pub.dealerSequence);
      setDealer(pub.dealer);
      setOutcome(pub.outcome ?? null);
      setPayout(pub.payout ?? 0);
      setPhase("result");
      applyBalance(view.new_balance);
    },
    [animateDealerReveal, applyBalance],
  );

  // ── Resume on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const view = await resumeFn();
        if (cancelled || !view) return;
        // If the latest open session has phase=result, just close it
        // visually — the user already collected. Better UX: clear it.
        if (view.public_state.phase === "result") return;
        applyServerState(view);
      } catch {
        // ignore — fresh start
      }
    })();
    return () => { cancelled = true; };
  }, [user, resumeFn, applyServerState]);

  // Live "last winners" ticker
  const seedRef = useRef(INITIAL_WINNERS.length);
  const [winnerSlots, setWinnerSlots] = useState<WinnerSlot[]>(() =>
    INITIAL_WINNERS.map((winner, index) => ({ ...winner, slotId: index })),
  );
  const winnerSlotsRef = useRef<WinnerSlot[]>([]);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const slotPositionsRef = useRef<Record<number, number>>(
    Object.fromEntries(
      INITIAL_WINNERS.map((_, index) => [index, index * (TICKER_ITEM_WIDTH + TICKER_GAP)]),
    ),
  );

  useEffect(() => {
    winnerSlotsRef.current = winnerSlots;
  }, [winnerSlots]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const positions = slotPositionsRef.current;
      const slots = winnerSlotsRef.current;
      for (const slot of slots) {
        positions[slot.slotId] -= dt * TICKER_SPEED_PX_PER_MS;
      }
      let rightMostX = Math.max(...slots.map((s) => positions[s.slotId]));
      const recycled: number[] = [];
      for (const slot of [...slots].sort((a, b) => positions[a.slotId] - positions[b.slotId])) {
        if (positions[slot.slotId] + TICKER_ITEM_WIDTH < 0) {
          positions[slot.slotId] = rightMostX + TICKER_ITEM_WIDTH + TICKER_GAP;
          rightMostX = positions[slot.slotId];
          recycled.push(slot.slotId);
        }
      }
      for (const slot of slots) {
        const node = slotRefs.current[slot.slotId];
        if (node) node.style.transform = `translate3d(${positions[slot.slotId]}px, -50%, 0)`;
      }
      if (recycled.length > 0) {
        setWinnerSlots((current) => {
          const latestWinners = [...current]
            .sort((a, b) => positions[a.slotId] - positions[b.slotId])
            .map(({ slotId: _s, ...winner }) => winner);
          return current.map((slot) => {
            if (!recycled.includes(slot.slotId)) return slot;
            const next = makeLiveWinner(++seedRef.current, latestWinners);
            latestWinners.push(next);
            return { ...next, slotId: slot.slotId };
          });
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const playerScore = useMemo(() => handScore(player), [player]);
  const showDealerScore = phase !== "betting" && phase !== "dealing" && phase !== "playing";

  // ── Actions ─────────────────────────────────────────────────────
  const onDeal = async () => {
    if (!user) return;
    if (bet > balance || bet < BJ_MIN_BET || busy) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    setOutcome(null);
    setPayout(0);
    setDoubled(false);
    setPlayer([]);
    setDealer([]);
    setPhase("dealing");
    try {
      const view = await dealFn({ data: { bet, client_action_id: uuid() } });
      // Animate the initial 4-card deal using the cards the server returned.
      const initialPlayer = view.public_state.player;
      const initialDealer = view.public_state.dealer;
      sessionRef.current = { id: view.session_id, nonce: view.nonce };
      applyBalance(view.new_balance);

      // Render cards progressively with the same cadence as before.
      playCardDealSound();
      setPlayer([initialPlayer[0]]);
      setTimeout(() => { setDealer([initialDealer[0]]); playCardDealSound(); }, 220);
      setTimeout(() => { setPlayer(initialPlayer); playCardDealSound(); }, 440);
      setTimeout(() => { setDealer(initialDealer); playCardDealSound(); }, 660);

      setTimeout(() => {
        if (view.public_state.phase === "result") {
          // Natural blackjack — settle with dealer reveal animation.
          void settleAnimated(view);
        } else {
          setPhase("playing");
        }
      }, 900);
    } catch (err) {
      setError(toFriendlyError(err, "No se pudo repartir."));
      setPhase("betting");
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  };

  const onHit = async () => {
    if (phase !== "playing" || busy || !sessionRef.current) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const view = await hitFn({
        data: {
          session_id: sessionRef.current.id,
          nonce: sessionRef.current.nonce,
          client_action_id: uuid(),
        },
      });
      sessionRef.current = { id: view.session_id, nonce: view.nonce };
      // Show the new player card immediately.
      setPlayer(view.public_state.player);
      playCardDealSound();
      if (view.public_state.phase === "result") {
        setTimeout(() => { void settleAnimated(view); }, 500);
      } else {
        applyBalance(view.new_balance);
      }
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  };

  const onStand = async () => {
    if (phase !== "playing" || busy || !sessionRef.current) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const view = await standFn({
        data: {
          session_id: sessionRef.current.id,
          nonce: sessionRef.current.nonce,
          client_action_id: uuid(),
        },
      });
      await settleAnimated(view);
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  };

  const onDouble = async () => {
    if (phase !== "playing" || busy || !sessionRef.current) return;
    if (inFlightRef.current) return;
    if (player.length !== 2 || bet > balance) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const view = await doubleFn({
        data: {
          session_id: sessionRef.current.id,
          nonce: sessionRef.current.nonce,
          client_action_id: uuid(),
        },
      });
      sessionRef.current = { id: view.session_id, nonce: view.nonce };
      setDoubled(true);
      setPlayer(view.public_state.player);
      playCardDealSound();
      setTimeout(() => { void settleAnimated(view); }, 600);
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  };

  const onNewHand = () => {
    sessionRef.current = null;
    setPlayer([]);
    setDealer([]);
    setOutcome(null);
    setPayout(0);
    setDoubled(false);
    setError(null);
    setPhase("betting");
  };

  const adjustBet = (delta: number) => {
    setBet((b) => Math.min(BJ_MAX_BET, Math.max(BJ_MIN_BET, b + delta)));
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#060210] text-white">
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

      <img
        src={bgAsset.url}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "center top" }}
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060210]/60 via-transparent to-[#060210]/30" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-3 sm:max-w-lg sm:px-4">
        <header
          className="flex items-center justify-between border-b border-purple-500/20 bg-[#060210]/80 px-3 pb-3 -mx-3 backdrop-blur-sm"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
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
              <div className="font-display text-[11px] font-bold text-white sm:text-xs">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <AuthControl />
          </div>
        </header>

        <div className="relative flex-1">
          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
            className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <div className="absolute left-1/2 top-[14%] -translate-x-1/2">
            <div className="relative h-[100px] w-[200px]">
              {dealer.map((c, i) => (
                <CardView key={`d-${i}`} card={c} idx={i} total={dealer.length} hidden={c.hidden} />
              ))}
            </div>
            {dealer.length > 0 && (
              <div className="mt-2 text-center">
                <span className="rounded-full border border-purple-400/50 bg-[#1a0b3a]/80 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-purple-100">
                  DEALER: {handScore(dealer)}
                  {!showDealerScore && dealer.some((c) => c.hidden) ? "+" : ""}
                </span>
              </div>
            )}
          </div>

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

          {error && (
            <div className="absolute left-1/2 top-[2%] -translate-x-1/2 z-20 max-w-[90%] rounded-md border border-rose-400/60 bg-rose-950/80 px-3 py-1.5 text-center text-[11px] font-bold text-rose-100 backdrop-blur-md">
              {error}
            </div>
          )}
        </div>

        <div className="relative z-10 mx-auto -mt-3 w-full max-w-md px-1 pt-1">
          {phase === "betting" && (
            <div className="rounded-2xl border border-purple-500/40 bg-[#0c0620]/85 p-3 shadow-[0_0_20px_rgba(168,85,247,0.25)] backdrop-blur-md">
              <div className="text-center text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
                Apuesta
              </div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => adjustBet(-BJ_BET_STEP)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-400/50 bg-purple-900/40 text-purple-100 active:scale-95"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1 h-10 font-display text-2xl font-black text-white">
                  <BetAmount bet={bet} bonusBalance={bonusBalance}>
                    <><span className="neon-green mr-0.5">$</span>{formatCOP(bet)}</>
                  </BetAmount>
                </div>
                <button
                  onClick={() => adjustBet(BJ_BET_STEP)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-400/50 bg-purple-900/40 text-purple-100 active:scale-95"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() =>
                    setBet((b) => {
                      const doubled = Math.min(BJ_MAX_BET, b * 2);
                      const snapped = Math.floor(doubled / BJ_BET_STEP) * BJ_BET_STEP;
                      return Math.max(BJ_MIN_BET, snapped);
                    })
                  }
                  className="rounded-md border border-fuchsia-400/60 bg-fuchsia-900/40 px-2.5 py-1 text-[11px] font-black text-fuchsia-100 active:scale-95"
                >
                  X2
                </button>
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => setBet((b) => Math.min(BJ_MAX_BET, b + q))}
                    className="rounded-md border border-purple-500/40 bg-purple-900/30 px-2.5 py-1 text-[11px] font-bold text-purple-100 active:scale-95"
                  >
                    +{q >= 1000 ? `${q / 1000}K` : q}
                  </button>
                ))}
              </div>
              <button
                onClick={onDeal}
                disabled={!user || bet > balance || busy}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 font-display text-base font-black uppercase tracking-widest text-white shadow-[0_0_18px_rgba(217,70,239,0.55)] transition active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? "..." : "Repartir"}
              </button>
            </div>
          )}

          {(phase === "playing" || phase === "dealing" || phase === "dealerTurn") && (
            <div className="-mt-4 rounded-2xl border border-purple-500/40 bg-[#0c0620]/85 p-3.5 shadow-[0_0_20px_rgba(168,85,247,0.25)] backdrop-blur-md">
              <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-widest text-purple-200/80">
                <span>Apuesta: <span className="text-white">${formatCOP(doubled ? bet * 2 : bet)}</span></span>
                <span>Puntos: <span className="text-white">{playerScore}</span></span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <button
                  onClick={onHit}
                  disabled={phase !== "playing" || busy}
                  className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 px-2 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-md active:scale-95 disabled:opacity-40"
                >
                  Pedir
                </button>
                <button
                  onClick={onStand}
                  disabled={phase !== "playing" || busy}
                  className="rounded-xl bg-gradient-to-b from-fuchsia-600 to-purple-700 px-2 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-md active:scale-95 disabled:opacity-40"
                >
                  Plantarse
                </button>
                <button
                  onClick={onDouble}
                  disabled={phase !== "playing" || busy || player.length !== 2 || bet > balance}
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

        <div
          className="relative z-10 mx-auto mt-1 w-full max-w-md px-1"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        >
          <div className="rounded-xl border border-purple-500/30 bg-[#0c0620]/80 py-1.5 backdrop-blur-md">
            <div className="mb-1 flex items-center gap-1.5 px-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-purple-200/80">
                Últimos ganadores
              </span>
            </div>
            <div
              className="relative h-8 overflow-hidden"
              style={{
                maskImage:
                  "linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)",
              }}
            >
              {winnerSlots.map((w) => (
                <div
                  key={w.slotId}
                  ref={(node) => {
                    slotRefs.current[w.slotId] = node;
                  }}
                  className="absolute left-0 top-1/2 flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-purple-500/30 bg-[#1a0b3a]/70 px-2.5 py-1 text-[11px] will-change-transform"
                  style={{
                    width: `${TICKER_ITEM_WIDTH}px`,
                    transform: `translate3d(${slotPositionsRef.current[w.slotId] ?? 0}px, -50%, 0)`,
                  }}
                >
                  <span className="truncate font-bold text-white">{w.name}</span>
                  <span className="shrink-0 text-[9px] uppercase tracking-wider text-purple-300/70">
                    · {w.game}
                  </span>
                  <span className="ml-auto shrink-0 font-display font-black text-emerald-300">
                    +${formatCOP(w.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlackjackGame;