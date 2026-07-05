import { AuthControl } from "@/components/auth/AuthControl";
import { FitText } from "@/components/ui/fit-text";
import { BetAmount } from "@/components/games/BetAmount";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { Link } from "@tanstack/react-router";
import betspaceLogo from "@/assets/betspace-logo.svg";
import pageBg from "@/assets/mines-page-bg.png";
import { Settings, Minus, Plus, Volume2, VolumeX, TrendingUp } from "lucide-react";
import { setMuted as setAudioMuted, playCashoutSound, playCrashSound, playDiceRollSound, isMuted, stopAllGameAudio } from "@/lib/gameAudio";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, type MeData } from "@/hooks/useMe";
import { useOnlineCount } from "@/hooks/useOnlineCount";
import { useAuth } from "@/hooks/useAuth";
import { toFriendlyError } from "@/lib/friendly-error";
import { diceRoll } from "@/lib/games/dice.functions";
import { clampBetToStep } from "@/lib/games/bet-helpers";
import {
  DICE_BET_STEP,
  DICE_MAX_BET,
  DICE_MIN_BET,
  DICE_MULTS,
  DICE_WIN_PROB,
  type DiceRollResult,
} from "@/lib/games/dice.shared";

type Phase = "betting" | "rolling" | "won" | "lost";
type Side = "low" | "high";
import { GameMenuDrawer } from "@/components/GameMenuDrawer";

// Game math + limits live in dice.shared.ts (shared with the server).
const MULTS = DICE_MULTS;
const WIN_PROB = DICE_WIN_PROB;
const MIN_BET = DICE_MIN_BET;
const MAX_BET = DICE_MAX_BET;
const BET_STEP = DICE_BET_STEP;
const QUICK_ADDS = [1000, 2000, 5000, 10000];

/** Lightweight UUID v4 for client_action_id (idempotency anchor). */
function uuid(): string {
  const g = (typeof globalThis !== "undefined" ? (globalThis as unknown as { crypto?: Crypto }).crypto : undefined);
  if (g && typeof g.randomUUID === "function") return g.randomUUID();
  const bytes = new Uint8Array(16);
  if (g && typeof g.getRandomValues === "function") g.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/** Landing animation length (ms) — must match `.dice-cube-rolling` keyframe duration in styles.css. */
const LAND_ANIM_MS = 1300;
/** Minimum free-spin time before we allow the cube to land, even if the server is super fast.
 *  Prevents the dice from "snapping" the moment you click. */
const MIN_SPIN_MS = 250;

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

type HistoryItem = {
  id: number;
  user: string;
  side: Side;
  roll: number;
  multiplier: number;
  amount: number;
  won: boolean;
};

const SEED_USERS = [
  "AstroNova","GalaxyKid","CometRider","MoonPlayer","NebulaQ",
  "PlasmaGirl","StarHunter","VoidWalker","OrbitX","RocketJoe",
  "MeteorMax","LunarFox","NovaKing","PulsarZ","SolarFlare",
];
function pickUser() { return SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)]; }

function seedHistory(): HistoryItem[] {
  let id = 1;
  return [
    { id: id++, user: "GalaxyKid", side: "low",  roll: 2, multiplier: 2,   amount: 12000, won: true  },
    { id: id++, user: "AstroNova", side: "high", roll: 5, multiplier: 3,   amount: 45000, won: true  },
    { id: id++, user: "OrbitX",    side: "low",  roll: 6, multiplier: 5,   amount: 8000,  won: false },
    { id: id++, user: "VoidWalker",side: "high", roll: 6, multiplier: 1.5, amount: 22500, won: true  },
    { id: id++, user: "NebulaQ",   side: "low",  roll: 1, multiplier: 10,  amount: 100000,won: true  },
    { id: id++, user: "MoonPlayer",side: "high", roll: 2, multiplier: 2,   amount: 5000,  won: false },
    { id: id++, user: "PulsarZ",   side: "low",  roll: 3, multiplier: 1.3, amount: 19500, won: true  },
    { id: id++, user: "CometRider",side: "high", roll: 4, multiplier: 3,   amount: 30000, won: true  },
  ];
}

function winProbFor(mult: number) {
  return WIN_PROB[mult] ?? 0.01;
}

/** Local-only roll used to populate the fake history sidebar. */
function fakeRollDice(side: Side, mult: number): { roll: number; won: boolean } {
  const winProb = winProbFor(mult);
  const won = Math.random() < winProb;
  const inRange = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
  let roll: number;
  if (side === "low") roll = won ? inRange(1, 3) : inRange(4, 6);
  else roll = won ? inRange(4, 6) : inRange(1, 3);
  return { roll, won };
}

export function DiceGame() {
  const { user } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();
  const realBalance = me.data?.balance ?? 0;
  const bonusBalance = me.data?.bonus_balance ?? 0;
  const balance = realBalance + bonusBalance;

  const rollFn = useServerFn(diceRoll);

  const [bet, setBet] = useState(2000);
  const [side, setSide] = useState<Side>("low");
  const [mult, setMult] = useState<number>(MULTS[0]);
  const [phase, setPhase] = useState<Phase>("betting");
  const [face, setFace] = useState<number>(1); // currently displayed face when settled
  const [targetFace, setTargetFace] = useState<number>(1); // face we'll land on during a roll
  /** "idle" = no roll in progress.
   *  "spinning" = waiting for server response; cube free-spins, no face committed.
   *  "landing" = server result in hand; cube animates to land on `targetFace`. */
  const [rollPhase, setRollPhase] = useState<"idle" | "spinning" | "landing">("idle");
  const rolling = rollPhase !== "idle";
  const [resultAmount, setResultAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs used to coordinate the roll animation with the server response.
  const inFlightRef = useRef(false);
  const landTimerRef = useRef<number | null>(null);

  const [muted, setMuted] = useState<boolean>(() => (typeof window === "undefined" ? false : isMuted()));
  const online = useOnlineCount();
  const [history, setHistory] = useState<HistoryItem[]>(() => seedHistory());
  const historyId = useRef(1000);

  // Push server-confirmed balance into the useMe cache for instant header update.
  const applyBalance = useCallback(
    (newBalance: number, opts?: { invalidate?: boolean }) => {
      if (!user) return;
      queryClient.setQueryData<MeData | null>(["me", user.id], (prev) =>
        prev ? { ...prev, balance: newBalance } : prev,
      );
      // Solo revalidamos contra el servidor cuando la ronda ya terminó.
      // Si invalidáramos durante la animación, el refetch traería el saldo
      // final (ya liquidado en la BD) y el header "delataría" el resultado
      // antes de que caiga el dado.
      if (opts?.invalidate) {
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    },
    [queryClient, user],
  );

  useEffect(() => { setAudioMuted(muted); }, [muted]);

  // Cierra cualquier audio de un juego previo al entrar.
  useEffect(() => { stopAllGameAudio(); }, []);

  // Ambient fake history (pausado en background)
  useVisibleInterval(() => {
    const m = MULTS[Math.floor(Math.random() * MULTS.length)];
    const s: Side = Math.random() < 0.5 ? "low" : "high";
    const { roll, won } = fakeRollDice(s, m);
    const stake = [500, 1000, 2000, 5000, 10000][Math.floor(Math.random() * 5)];
    const amount = won ? Math.floor(stake * m) : stake;
    setHistory((h) => [
      { id: ++historyId.current, user: pickUser(), side: s, roll, multiplier: m, amount, won },
      ...h,
    ].slice(0, 30));
  }, 3200);

  // Clean up the animation timer if the component unmounts mid-roll.
  useEffect(() => () => {
    if (landTimerRef.current) {
      window.clearTimeout(landTimerRef.current);
      landTimerRef.current = null;
    }
  }, []);

  const canRoll = phase === "betting" && bet >= MIN_BET && bet <= balance && !!user;
  const potentialWin = Math.floor(bet * mult);
  const winProbPct = winProbFor(mult) * 100;

  /**
   * Settle the round visually once both the animation has ended AND the
   * server result is in hand. Either may finish first — we land here from
   * whichever resolves last.
   */
  const settle = useCallback((result: DiceRollResult, snapshotBet: number, snapshotSide: Side, snapshotMult: number) => {
    setRollPhase("idle");
    setFace(result.roll);
    setResultAmount(result.payout);
    applyBalance(result.new_balance, { invalidate: true });
    if (result.won) {
      playCashoutSound();
      setPhase("won");
    } else {
      playCrashSound();
      setPhase("lost");
    }
    setHistory((h) => [
      {
        id: ++historyId.current,
        user: "Tú",
        side: snapshotSide,
        roll: result.roll,
        multiplier: snapshotMult,
        amount: result.won ? result.payout : snapshotBet,
        won: result.won,
      },
      ...h,
    ].slice(0, 30));
    window.setTimeout(() => setPhase("betting"), 1800);
  }, [applyBalance]);

  const handleRoll = useCallback(async () => {
    if (!canRoll || inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);

    // Snapshot the round parameters — bet / side / mult are still bound to
    // the betting state during the animation, but the user can adjust them
    // for the *next* round. We use the snapshot to settle the current one.
    const snapshotBet = bet;
    const snapshotSide = side;
    const snapshotMult = mult;
    const clientActionId = uuid();

    // ── Optimistic UI ──────────────────────────────────────────────────
    // 1) Debit the balance instantly in the header cache.
    // 2) Switch to "rolling" phase and start the cube animation.
    // Both happen BEFORE the network call so the button feels instant.
    const prevBalance = balance;
    applyBalance(Math.max(0, balance - snapshotBet));
    setPhase("rolling");
    // Start in free-spin mode — NO face is committed until the server confirms.
    // This prevents the visible "placeholder face → real face" swap that
    // makes the game look like it's cheating.
    setRollPhase("spinning");
    const spinStartedAt = Date.now();
    playDiceRollSound(LAND_ANIM_MS + MIN_SPIN_MS);

    // ── Server call (runs in parallel with the animation) ───────────────
    try {
      const result = await rollFn({
        data: {
          bet: snapshotBet,
          side: snapshotSide,
          mult: snapshotMult,
          client_action_id: clientActionId,
        },
      });

      // Enforce a tiny minimum spin so super-fast responses still look like a roll.
      const elapsed = Date.now() - spinStartedAt;
      const beforeLand = Math.max(0, MIN_SPIN_MS - elapsed);
      window.setTimeout(() => {
        // Commit the real face and switch to the landing animation in the same paint.
        setTargetFace(result.roll);
        setRollPhase("landing");
        landTimerRef.current = window.setTimeout(() => {
          landTimerRef.current = null;
          settle(result, snapshotBet, snapshotSide, snapshotMult);
        }, LAND_ANIM_MS);
      }, beforeLand);
    } catch (e) {
      // Rollback the optimistic debit, cancel the spin, surface the message.
      if (landTimerRef.current) {
        window.clearTimeout(landTimerRef.current);
        landTimerRef.current = null;
      }
      applyBalance(prevBalance, { invalidate: true });
      setRollPhase("idle");
      setPhase("betting");
      setError(toFriendlyError(e, "No se pudo lanzar."));
    } finally {
      inFlightRef.current = false;
    }
  }, [canRoll, bet, side, mult, balance, rollFn, applyBalance, settle, queryClient]);

  const recent = useMemo(() => history.slice(0, 10), [history]);

  return (
    <div
      className="min-h-screen text-white"
      style={{
        backgroundColor: "#060210",
        backgroundImage: `url(${pageBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-2 pt-3 sm:max-w-lg sm:px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between bg-[#060210]/80 backdrop-blur-sm border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <div className="flex items-center gap-1">
            <GameMenuDrawer />
            <Link to="/">
              <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7 translate-y-px" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="font-display text-[11px] font-bold sm:text-xs text-white">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <AuthControl />
          </div>
        </header>

        {/* Online / mute */}
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-semibold text-white/90">{online} ONLINE</span>
          </div>
          <button
            onClick={() => setMuted((m) => !m)}
            className="rounded-md p-1 text-purple-200/80 hover:bg-white/5"
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Stats HUD */}
        <section className="mt-1.5 grid grid-cols-4 gap-1.5 rounded-xl border border-purple-500/30 glass-panel p-1.5">
          <Stat label="Límite Mín" value={`${formatCOP(MIN_BET)}`} />
          <Stat label="Límite Máx" value={`${formatCOP(MAX_BET)}`} />
          <Stat label="Multiplicador" value={`X${mult.toFixed(2)}`} accent />
          <Stat label="Probabilidad" value={`${winProbPct.toFixed(2)}%`} accent />
        </section>

        {/* Main dice panel — neon frame igual al de Slot */}
        <section
          className="relative mt-3"
        >
          <div className="absolute left-5 -top-3 z-30">
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1"
              style={{
                background: "linear-gradient(180deg, rgba(20,8,42,0.95), rgba(8,2,18,0.95))",
                border: "1px solid rgba(168,85,247,0.65)",
                boxShadow: "0 0 18px rgba(168,85,247,0.55), inset 0 0 8px rgba(168,85,247,0.25)",
              }}
            >
              <span
                className="font-display text-sm font-black tracking-[0.18em]"
                style={{
                  background: "linear-gradient(180deg,#c084fc 0%,#7c3aed 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 8px rgba(168,85,247,0.7))",
                }}
              >DADOS</span>
            </div>
          </div>
          <div
            className="relative"
            style={{
              clipPath:
                "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
              background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #c084fc 100%)",
              padding: "2px",
              filter:
                "drop-shadow(0 0 10px rgba(168,85,247,0.55)) drop-shadow(0 0 22px rgba(168,85,247,0.28))",
            }}
          >
            <div
              className="relative overflow-hidden p-2"
              style={{
                clipPath:
                  "polygon(15px 0, calc(100% - 15px) 0, 100% 15px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 15px 100%, 0 calc(100% - 15px), 0 15px)",
                background: "#0a041c",
              }}
            >

          <div className="relative z-0 mx-auto flex h-72 w-full items-center justify-center sm:h-80">
            {/* energy halo */}
            <div className="dice-halo" />
            <div className="dice-rings" />

            {/* 3D dice */}
            <div className={`dice-stage ${rolling ? "dice-stage-rolling" : ""}`}>
              <div
                className={
                  rollPhase === "spinning"
                    ? "dice-cube dice-cube-spinning"
                    : rollPhase === "landing"
                      ? `dice-cube dice-cube-rolling dice-face-${targetFace}`
                      : `dice-cube dice-cube-idle dice-face-${face}`
                }
              >
                <DiceFace n={1} className="dice-front" />
                <DiceFace n={6} className="dice-back" />
                <DiceFace n={3} className="dice-right" />
                <DiceFace n={4} className="dice-left" />
                <DiceFace n={5} className="dice-top" />
                <DiceFace n={2} className="dice-bottom" />
              </div>
            </div>

            {/* particles on roll */}
            {rolling && <DiceParticles />}

            {/* result flash */}
            {(phase === "won" || phase === "lost") && (
              <div className={`pointer-events-none absolute inset-0 ${phase === "won" ? "dice-flash-win" : "dice-flash-lose"}`} />
            )}
          </div>

          {/* Multiplier picker */}
          <div className="relative z-20 mt-2 flex items-center justify-between gap-1 overflow-x-auto hide-scrollbar">
            {MULTS.map((m) => (
              <button
                key={m}
                disabled={phase !== "betting"}
                onClick={() => setMult(m)}
                className={`shrink-0 rounded-md px-2 py-0.5 font-display text-[10px] font-bold transition disabled:opacity-50 ${
                  m === mult
                    ? "border border-emerald-400/70 bg-emerald-500/15 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
                    : "border border-purple-500/30 bg-[#160830]/50 text-purple-100 hover:border-purple-400/60"
                }`}
              >
                {m.toFixed(2)}X
              </button>
            ))}
          </div>
            </div>
          </div>
        </section>

        {/* BAJO / ALTO */}
        <section className="mt-1.5 grid grid-cols-2 gap-2">
          <button
            disabled={phase !== "betting"}
            onClick={() => setSide("low")}
            className={`flex flex-col items-center justify-center rounded-xl border py-2 transition disabled:opacity-60 ${
              side === "low"
                ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                : "border-purple-500/30 bg-[#160830]/60 hover:border-purple-400/60"
            }`}
          >
            <span className="font-display text-base font-black tracking-widest text-white">BAJO</span>
            <span className="text-[10px] font-bold text-purple-200/80">1 — 3</span>
          </button>
          <button
            disabled={phase !== "betting"}
            onClick={() => setSide("high")}
            className={`flex flex-col items-center justify-center rounded-xl border py-2 transition disabled:opacity-60 ${
              side === "high"
                ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                : "border-purple-500/30 bg-[#160830]/60 hover:border-purple-400/60"
            }`}
          >
            <span className="font-display text-base font-black tracking-widest text-white">ALTO</span>
            <span className="text-[10px] font-bold text-purple-200/80">4 — 6</span>
          </button>
        </section>

        {/* Recent dice */}
        <section className="mt-2 rounded-xl border border-purple-500/30 glass-panel px-2.5 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-display text-[11px] font-bold uppercase tracking-widest text-white/80">
              Últimos resultados
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            {recent.map((h) => (
              <div
                key={h.id}
                title={`${h.user} · ${h.roll} · ${h.won ? formatCOP(h.amount) + " COP" : "Perdió"}`}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
                  h.won
                    ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                    : "border-purple-500/30 bg-[#160830]/60 text-purple-200"
                }`}
              >
                <MiniDie n={h.roll} />
              </div>
            ))}
          </div>
        </section>

        {/* Bet panel */}
        <section className="mt-1.5 rounded-2xl border border-purple-500/30 glass-panel p-2">
          <div className="flex gap-2.5">
            {/* Left: bet controls */}
            <div className="flex-1">
              <div className="text-center text-[9px] uppercase tracking-widest text-purple-200/70">
                Apuesta (COP)
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => setBet((b) => Math.max(MIN_BET, b - BET_STEP))}
                  disabled={phase !== "betting"}
                  className="btn-bet flex h-10 w-11 items-center justify-center rounded-lg disabled:opacity-50"
                  aria-label="Disminuir apuesta"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <div
                  className="h-10 w-full min-w-0 flex-1 cursor-default rounded-lg border border-purple-500/30 bg-[#160830]/60 px-2 font-display text-lg font-bold text-white"
                  aria-label="Apuesta"
                >
                  <BetAmount bet={bet} bonusBalance={bonusBalance} />
                </div>
                <button
                  onClick={() => setBet((b) => clampBetToStep(b + BET_STEP, balance, MAX_BET, BET_STEP, MIN_BET))}
                  disabled={phase !== "betting"}
                  className="btn-bet flex h-10 w-11 items-center justify-center rounded-lg disabled:opacity-50"
                  aria-label="Aumentar apuesta"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <button
                  onClick={() => setBet((b) => clampBetToStep(b * 2, balance, MAX_BET, BET_STEP, MIN_BET))}
                  disabled={phase !== "betting"}
                  className="btn-bet flex h-7 flex-1 items-center justify-center rounded-md text-[11px] font-bold disabled:opacity-50"
                >
                  X2
                </button>
                {QUICK_ADDS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBet((b) => clampBetToStep(b + amt, balance, MAX_BET, BET_STEP, MIN_BET))}
                    disabled={phase !== "betting"}
                    className="btn-bet flex h-7 flex-1 items-center justify-center rounded-md text-[11px] font-bold disabled:opacity-50"
                  >
                    +{amt >= 1000 ? `${amt / 1000}K` : amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: TIRAR DADOS */}
            <div className="flex w-[42%] flex-col" style={{ minHeight: 90 }}>
              <button
                onClick={handleRoll}
                disabled={!canRoll}
                className="btn-primary-green btn-primary-action flex flex-1 flex-col items-center justify-center rounded-2xl font-display font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm leading-none">TIRAR DADOS</span>
                <span className="mt-0.5 flex flex-col items-center text-[9px] leading-tight opacity-90">
                  <span>Ganarías</span>
                  <span>{formatCOP(potentialWin)} COP</span>
                </span>
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-1.5 rounded-md border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-center text-[11px] font-semibold text-rose-200">
              {error}
            </div>
          )}
        </section>

        <div className="h-1" />
      </div>

      {/* Win popup */}
      {phase === "won" && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
          <div className="result-pop-win rounded-xl border border-emerald-500/60 bg-[#0c0620]/90 px-6 py-3 text-center shadow-2xl">
            <div className="text-[10px] uppercase tracking-widest text-emerald-200/80">¡Ganaste!</div>
            <div className="font-display text-2xl font-black neon-green">+{formatCOP(resultAmount)} COP</div>
            <div className="text-xs font-bold text-emerald-300">{mult.toFixed(2)}x</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-purple-500/30 bg-[#160830]/60 px-1.5 py-1 text-center">
      <div className="text-[8px] font-bold uppercase tracking-widest text-purple-200/70">{label}</div>
      <div className={`font-display text-[12px] font-bold ${accent ? "neon-green" : "text-white"}`}>{value}</div>
    </div>
  );
}

/* ---------- Dice faces (pips) ---------- */

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function DiceFace({ n, className }: { n: number; className: string }) {
  const pips = PIP_LAYOUT[n];
  return (
    <div className={`dice-face ${className}`}>
      <div className="dice-face-inner">
        <div className="dice-face-grid">
          {Array.from({ length: 9 }).map((_, i) => {
            const r = Math.floor(i / 3);
            const c = i % 3;
            const on = pips.some(([pr, pc]) => pr === r && pc === c);
            return <span key={i} className={on ? "dice-pip" : "dice-pip-off"} />;
          })}
        </div>
      </div>
    </div>
  );
}

function MiniDie({ n }: { n: number }) {
  const pips = PIP_LAYOUT[n] ?? [];
  return (
    <div className="mini-die-grid">
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const on = pips.some(([pr, pc]) => pr === r && pc === c);
        return <span key={i} className={on ? "mini-pip" : "mini-pip-off"} />;
      })}
    </div>
  );
}

function DiceParticles() {
  const parts = useMemo(() => {
    return Array.from({ length: 18 }).map(() => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 70;
      return {
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        delay: Math.random() * 400,
        size: 4 + Math.random() * 6,
      };
    });
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {parts.map((p, i) => (
        <span
          key={i}
          className="dice-particle"
          style={{
            // @ts-ignore CSS vars
            "--px": `${p.x}px`,
            "--py": `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}