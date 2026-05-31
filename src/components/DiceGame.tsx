import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { Menu, Settings, Minus, Plus, Volume2, VolumeX, TrendingUp, Crown } from "lucide-react";
import { setMuted as setAudioMuted, playCashoutSound, playCrashSound, isMuted } from "@/lib/gameAudio";

type Phase = "betting" | "rolling" | "won" | "lost";
type Side = "low" | "high";

const MULTS = [1.1, 1.3, 1.5, 2, 3, 5, 10];
const MIN_BET = 500;
const MAX_BET = 100000;
const BET_STEP = 500;
const QUICK_ADDS = [1000, 2000, 5000, 10000];

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

function rollDice(side: Side, mult: number): { roll: number; won: boolean } {
  // Base win prob is 0.495 (slight house edge at 2x). Scale by 2/mult so higher
  // multipliers are rarer. Visual roll lands in the picked half on win.
  const winProb = Math.min(0.495, 0.495 * (2 / mult));
  const won = Math.random() < winProb;
  const inRange = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
  let roll: number;
  if (side === "low") roll = won ? inRange(1, 3) : inRange(4, 6);
  else roll = won ? inRange(4, 6) : inRange(1, 3);
  return { roll, won };
}

export function DiceGame() {
  const [balance, setBalance] = useState(100000);
  const [bet, setBet] = useState(2000);
  const [side, setSide] = useState<Side>("low");
  const [mult, setMult] = useState<number>(2);
  const [phase, setPhase] = useState<Phase>("betting");
  const [face, setFace] = useState<number>(1); // currently displayed face when settled
  const [rolling, setRolling] = useState(false);
  const [resultAmount, setResultAmount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [online] = useState(263);
  const [history, setHistory] = useState<HistoryItem[]>(() => seedHistory());
  const historyId = useRef(1000);

  useEffect(() => { setAudioMuted(muted); }, [muted]);

  // Ambient fake history
  useEffect(() => {
    const t = setInterval(() => {
      const m = MULTS[Math.floor(Math.random() * MULTS.length)];
      const s: Side = Math.random() < 0.5 ? "low" : "high";
      const { roll, won } = rollDice(s, m);
      const stake = [500, 1000, 2000, 5000, 10000][Math.floor(Math.random() * 5)];
      const amount = won ? Math.floor(stake * m) : stake;
      setHistory((h) => [
        { id: ++historyId.current, user: pickUser(), side: s, roll, multiplier: m, amount, won },
        ...h,
      ].slice(0, 30));
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const canRoll = phase === "betting" && bet >= MIN_BET && bet <= balance;
  const potentialWin = Math.floor(bet * mult);
  const winProbPct = Math.min(49.5, 49.5 * (2 / mult));

  const handleRoll = useCallback(() => {
    if (!canRoll) return;
    setBalance((b) => b - bet);
    setPhase("rolling");
    setRolling(true);
    const { roll, won } = rollDice(side, mult);
    const win = won ? Math.floor(bet * mult) : 0;
    // Settle after the rolling animation
    setTimeout(() => {
      setRolling(false);
      setFace(roll);
      setResultAmount(win);
      if (won) {
        setBalance((b) => b + win);
        playCashoutSound();
        setPhase("won");
      } else {
        playCrashSound();
        setPhase("lost");
      }
      setHistory((h) => [
        { id: ++historyId.current, user: "Tú", side, roll, multiplier: mult, amount: won ? win : bet, won },
        ...h,
      ].slice(0, 30));
      setTimeout(() => setPhase("betting"), 2200);
    }, 2200);
  }, [canRoll, bet, side, mult]);

  const recent = useMemo(() => history.slice(0, 10), [history]);

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div
        className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-4 pt-4 sm:max-w-lg sm:px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between bg-[#060210]/80 backdrop-blur-sm border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-1">
            <button className="rounded-md p-2 text-white hover:bg-white/10">
              <Menu className="h-7 w-7" strokeWidth={3} />
            </button>
            <Link to="/home">
              <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="font-display text-xs font-bold sm:text-sm text-white">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </header>

        {/* Online / mute */}
        <div className="mt-2 flex items-center justify-between">
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
        <section className="mt-2 grid grid-cols-4 gap-2 rounded-2xl border border-purple-500/30 glass-panel p-2">
          <Stat label="Límite Mín" value={`${formatCOP(MIN_BET)}`} />
          <Stat label="Límite Máx" value={`${formatCOP(MAX_BET)}`} />
          <Stat label="Multiplicador" value={`X${mult.toFixed(2)}`} accent />
          <Stat label="Probabilidad" value={`${winProbPct.toFixed(2)}%`} accent />
        </section>

        {/* Main dice panel */}
        <section className="relative mt-2 overflow-hidden rounded-2xl border border-purple-500/30 glass-panel p-3">
          <div className="mx-auto mb-2 w-fit rounded-full border border-purple-500/40 bg-[#160830]/70 px-6 py-1.5">
            <span className="font-display text-base font-black uppercase tracking-[0.3em] neon-purple">DICE</span>
          </div>

          <div className="relative mx-auto flex h-56 w-full items-center justify-center sm:h-64">
            {/* energy halo */}
            <div className="dice-halo" />
            <div className="dice-rings" />

            {/* 3D dice */}
            <div className={`dice-stage ${rolling ? "dice-stage-rolling" : ""}`}>
              <div
                className={`dice-cube ${rolling ? "dice-cube-rolling" : "dice-cube-idle"} dice-face-${face}`}
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
          <div className="mt-2 flex items-center justify-between gap-1 overflow-x-auto hide-scrollbar">
            {MULTS.map((m) => (
              <button
                key={m}
                disabled={phase !== "betting"}
                onClick={() => setMult(m)}
                className={`shrink-0 rounded-md px-2.5 py-1 font-display text-[11px] font-bold transition disabled:opacity-50 ${
                  m === mult
                    ? "border border-emerald-400/70 bg-emerald-500/15 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
                    : "border border-purple-500/30 bg-[#160830]/50 text-purple-100 hover:border-purple-400/60"
                }`}
              >
                {m.toFixed(2)}X
              </button>
            ))}
          </div>
        </section>

        {/* BAJO / ALTO */}
        <section className="mt-2 grid grid-cols-2 gap-2">
          <button
            disabled={phase !== "betting"}
            onClick={() => setSide("low")}
            className={`flex flex-col items-center justify-center rounded-2xl border py-3 transition disabled:opacity-60 ${
              side === "low"
                ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                : "border-purple-500/30 bg-[#160830]/60 hover:border-purple-400/60"
            }`}
          >
            <span className="font-display text-xl font-black tracking-widest text-white">BAJO</span>
            <span className="text-[11px] font-bold text-purple-200/80">1 — 3</span>
          </button>
          <button
            disabled={phase !== "betting"}
            onClick={() => setSide("high")}
            className={`flex flex-col items-center justify-center rounded-2xl border py-3 transition disabled:opacity-60 ${
              side === "high"
                ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                : "border-purple-500/30 bg-[#160830]/60 hover:border-purple-400/60"
            }`}
          >
            <span className="font-display text-xl font-black tracking-widest text-white">ALTO</span>
            <span className="text-[11px] font-bold text-purple-200/80">4 — 6</span>
          </button>
        </section>

        {/* Recent dice */}
        <section className="mt-2 rounded-xl border border-purple-500/30 glass-panel px-2 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
            <span className="font-display text-[9px] font-bold uppercase tracking-widest text-white/80">
              Últimos resultados
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            {recent.map((h) => (
              <div
                key={h.id}
                title={`${h.user} · ${h.roll} · ${h.won ? formatCOP(h.amount) + " COP" : "Perdió"}`}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
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
        <section className="mt-2 rounded-2xl border border-purple-500/30 glass-panel p-2.5">
          <div className="text-center text-[10px] uppercase tracking-widest text-purple-200/70">Apuesta (COP)</div>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              onClick={() => setBet((b) => Math.max(MIN_BET, b - BET_STEP))}
              disabled={phase !== "betting"}
              className="btn-bet flex h-11 w-12 items-center justify-center rounded-lg disabled:opacity-50"
              aria-label="Disminuir apuesta"
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              readOnly
              value={formatCOP(bet)}
              className="no-spinner h-11 w-full cursor-default rounded-lg border border-purple-500/30 bg-[#160830]/60 text-center font-display text-xl font-bold text-white outline-none"
            />
            <button
              onClick={() => setBet((b) => Math.min(Math.min(balance, MAX_BET), b + BET_STEP))}
              disabled={phase !== "betting"}
              className="btn-bet flex h-11 w-12 items-center justify-center rounded-lg disabled:opacity-50"
              aria-label="Aumentar apuesta"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <button
              onClick={() => setBet((b) => Math.min(Math.min(balance, MAX_BET), b * 2))}
              disabled={phase !== "betting"}
              className="btn-bet flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold disabled:opacity-50"
            >
              X2
            </button>
            {QUICK_ADDS.map((amt) => (
              <button
                key={amt}
                onClick={() => setBet((b) => Math.min(Math.min(balance, MAX_BET), b + amt))}
                disabled={phase !== "betting"}
                className="btn-bet flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold disabled:opacity-50"
              >
                +{amt >= 1000 ? `${amt / 1000}K` : amt}
              </button>
            ))}
          </div>

          <div className="mt-1 text-center text-[10px] text-purple-300/70">
            MÍNIMO: {formatCOP(MIN_BET)} COP · MÁXIMO: {formatCOP(MAX_BET)} COP
          </div>

          <div className="mt-3">
            <button
              onClick={handleRoll}
              disabled={!canRoll}
              className="btn-primary-green btn-primary-action flex h-12 w-full flex-col items-center justify-center rounded-xl font-display font-black uppercase tracking-widest disabled:opacity-50"
            >
              <span className="text-base leading-none">TIRAR DADOS</span>
              <span className="text-[10px] leading-tight opacity-90">Ganarías {formatCOP(potentialWin)} COP</span>
            </button>
          </div>
        </section>

        {/* Top wins */}
        <section className="mt-2 rounded-2xl border border-purple-500/30 glass-panel p-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white/80">
              Top tiradas
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {history.filter((h) => h.won).slice(0, 3).map((h) => (
              <div
                key={h.id}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-purple-500/30 bg-[#160830]/60 p-1.5"
              >
                <div className="truncate text-[10px] font-semibold text-white/90">{h.user}</div>
                <div className="font-display text-sm font-black neon-green">{h.multiplier.toFixed(2)}x</div>
                <div className="text-[9px] text-purple-200/70">{formatCOP(h.amount)} COP</div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-3" />
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