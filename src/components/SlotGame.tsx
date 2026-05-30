import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { Menu, Settings, Volume2, VolumeX, Minus, Plus, TrendingUp, Trophy } from "lucide-react";
import { setMuted as setAudioMuted, playCashoutSound, isMuted } from "@/lib/gameAudio";

import bossImg from "@/assets/slot/boss.png";
import hatImg from "@/assets/slot/hat.png";
import briefcaseImg from "@/assets/slot/briefcase.png";
import watchImg from "@/assets/slot/watch.png";
import goldImg from "@/assets/slot/gold.png";
import carImg from "@/assets/slot/car.png";
import chipImg from "@/assets/slot/chip.png";
import cardImg from "@/assets/slot/card.png";

/* ============================================================
   Symbols — Mafia Royale (Peaky Blinders theme)
   Index 0 = highest-paying.
   ============================================================ */
type SymbolDef = {
  id: string;
  img: string;
  label: string;
  pay: [number, number, number]; // 3 / 4 / 5 of a kind, multiplier of LINE BET
  weight: number;
  glow: string; // rgb for highlight glow
};

const SYMBOLS: SymbolDef[] = [
  { id: "boss",  img: bossImg,      label: "EL PADRINO", pay: [25, 150, 750], weight: 2,  glow: "168,85,247"  },
  { id: "car",   img: carImg,       label: "CADILLAC",   pay: [15, 75, 300],  weight: 3,  glow: "180,180,255" },
  { id: "brief", img: briefcaseImg, label: "MALETÍN $",  pay: [10, 40, 180],  weight: 4,  glow: "46,255,161"  },
  { id: "gold",  img: goldImg,      label: "LINGOTE",    pay: [8, 25, 120],   weight: 5,  glow: "255,210,80"  },
  { id: "watch", img: watchImg,     label: "RELOJ ORO",  pay: [5, 18, 75],    weight: 6,  glow: "255,200,80"  },
  { id: "chip",  img: chipImg,      label: "FICHA",      pay: [4, 12, 50],    weight: 7,  glow: "168,85,247"  },
  { id: "hat",   img: hatImg,       label: "SOMBRERO",   pay: [3, 8, 30],     weight: 8,  glow: "200,120,255" },
  { id: "card",  img: cardImg,      label: "AS",         pay: [2, 5, 15],     weight: 10, glow: "255,180,80"  },
];

const SYMBOL_INDEX = new Map(SYMBOLS.map((s, i) => [s.id, i]));

/* Weighted random fillers for the spinning strip */
const SPIN_FILLER_COUNT = 18; // tiles above the final 3
function pickRandomFillers(n: number): string[] {
  const totalWeight = SYMBOLS.reduce((a, s) => a + s.weight, 0);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * totalWeight;
    for (const s of SYMBOLS) {
      r -= s.weight;
      if (r <= 0) { out.push(s.id); break; }
    }
  }
  return out;
}

const REELS = 5;
const ROWS = 3;

/* 10 paylines on 5x3 grid (row index per reel) */
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // middle
  [0, 0, 0, 0, 0], // top
  [2, 2, 2, 2, 2], // bottom
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // ^
  [0, 0, 1, 2, 2], // diag down
  [2, 2, 1, 0, 0], // diag up
  [1, 0, 0, 0, 1], // U top
  [1, 2, 2, 2, 1], // U bottom
  [0, 1, 1, 1, 0], // arch
];

const MIN_BET = 500;
const MAX_BET = 100000;
const BET_STEP = 500;
const QUICK_BETS = [1000, 2000, 5000, 10000];

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function rand(max: number) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pickWeightedSymbol(): string {
  const total = SYMBOLS.reduce((a, s) => a + s.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    r -= s.weight;
    if (r <= 0) return s.id;
  }
  return SYMBOLS[SYMBOLS.length - 1].id;
}

function generateGrid(): string[][] {
  // grid[reel][row]
  return Array.from({ length: REELS }, () =>
    Array.from({ length: ROWS }, () => pickWeightedSymbol())
  );
}

type WinLine = {
  lineIdx: number;
  symbolId: string;
  count: number;
  payout: number;
  cells: [number, number][]; // [reel, row]
};

function evaluateGrid(grid: string[][], lineBet: number): { wins: WinLine[]; total: number } {
  const wins: WinLine[] = [];
  PAYLINES.forEach((line, lineIdx) => {
    const firstSym = grid[0][line[0]];
    let count = 1;
    for (let r = 1; r < REELS; r++) {
      if (grid[r][line[r]] === firstSym) count++;
      else break;
    }
    if (count >= 3) {
      const sym = SYMBOLS[SYMBOL_INDEX.get(firstSym)!];
      const payout = sym.pay[count - 3] * lineBet;
      if (payout > 0) {
        const cells: [number, number][] = [];
        for (let r = 0; r < count; r++) cells.push([r, line[r]]);
        wins.push({ lineIdx, symbolId: firstSym, count, payout, cells });
      }
    }
  });
  const total = wins.reduce((a, w) => a + w.payout, 0);
  return { wins, total };
}

/* ============================================================
   History
   ============================================================ */
type HistoryItem = {
  id: number;
  user: string;
  symbol: string;
  multiplier: number;
  amount: number;
  ts: number;
};
const SEED_USERS = [
  "TommyGun", "VitoC", "AlCapone", "PeakyB", "DonLuca", "MissFox",
  "GoldieM", "ScarfaceX", "NickyB", "MrSinatra", "LadyLuck", "BigBoss",
];
function pickUser() { return SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)]; }

function relativeTime(ts: number, now: number): string {
  const s = Math.max(1, Math.floor((now - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  return `hace ${Math.floor(m / 60)}h`;
}

/* ============================================================
   Audio: simple spin tick + win chime via Web Audio
   ============================================================ */
let actx: AudioContext | null = null;
function ctx() {
  if (typeof window === "undefined") return null;
  if (!actx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === "suspended") actx.resume().catch(() => {});
  return actx;
}
function playReelStop() {
  if (isMuted()) return;
  const c = ctx(); if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(180, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.08);
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
  o.connect(g).connect(c.destination);
  o.start(); o.stop(c.currentTime + 0.13);
}

/* ============================================================
   Reel component — continuous translateY strip (no flicker)
   ============================================================ */
const TILE_H = 76; // px per tile (3 rows visible = 228px tall window)
const SPIN_BASE_MS = 1400;
const SPIN_STAGGER_MS = 220;

function Reel({
  finalSyms,
  spinning,
  reelIndex,
  onStop,
  winRows,
}: {
  finalSyms: string[];
  spinning: boolean;
  reelIndex: number;
  onStop: () => void;
  winRows: Set<number>;
}) {
  // Strip: [fillers..., finalSyms[0], finalSyms[1], finalSyms[2]]
  // When idle: strip = finalSyms (3 tiles), translateY = 0.
  const [strip, setStrip] = useState<string[]>(finalSyms);
  const innerRef = useRef<HTMLDivElement>(null);
  const spinTokenRef = useRef(0);

  // Sync strip with finalSyms when not spinning (e.g. initial render).
  useEffect(() => {
    if (spinning) return;
    setStrip(finalSyms);
    const el = innerRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = "translateY(0)";
    }
  }, [finalSyms, spinning]);

  useEffect(() => {
    if (!spinning) return;
    const token = ++spinTokenRef.current;
    const fillers = pickRandomFillers(SPIN_FILLER_COUNT);
    const longStrip = [...fillers, ...finalSyms];
    setStrip(longStrip);

    const el = innerRef.current;
    if (!el) return;

    // 1) Position at top (showing fillers[0..2]) without animation.
    el.style.transition = "none";
    el.style.transform = "translateY(0)";
    // force reflow so the next frame sees the new transform
    void el.offsetHeight;

    // 2) Next frame: animate to landing position.
    const dur = SPIN_BASE_MS + reelIndex * SPIN_STAGGER_MS;
    const targetY = (longStrip.length - ROWS) * TILE_H;

    const raf = requestAnimationFrame(() => {
      if (spinTokenRef.current !== token) return;
      el.style.transition = `transform ${dur}ms cubic-bezier(.16,.84,.32,1)`;
      el.style.transform = `translateY(-${targetY}px)`;
    });

    // Fallback: ensure onStop fires even if transitionend is missed.
    const fallback = setTimeout(() => {
      if (spinTokenRef.current !== token) return;
      finishSpin();
    }, dur + 250);

    function finishSpin() {
      const e = innerRef.current;
      if (!e) return;
      e.style.transition = "none";
      e.style.transform = "translateY(0)";
      setStrip(finalSyms);
      playReelStop();
      onStop();
    }

    const handleEnd = (ev: TransitionEvent) => {
      if (ev.propertyName !== "transform") return;
      if (spinTokenRef.current !== token) return;
      clearTimeout(fallback);
      el.removeEventListener("transitionend", handleEnd);
      finishSpin();
    };
    el.addEventListener("transitionend", handleEnd);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      el.removeEventListener("transitionend", handleEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  const visibleRows = ROWS;
  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        height: TILE_H * visibleRows,
        background:
          "linear-gradient(180deg, rgba(8,3,22,0.92) 0%, rgba(18,8,42,0.85) 50%, rgba(8,3,22,0.92) 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(168,85,247,0.25), inset 0 8px 14px rgba(0,0,0,0.55), inset 0 -8px 14px rgba(0,0,0,0.55)",
      }}
    >
      {/* top + bottom inner shadow for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-5 z-10"
           style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.85), transparent)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 z-10"
           style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.85), transparent)" }} />
      {/* vertical reflection sheen */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[2px] z-10"
           style={{ background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.18), transparent)" }} />

      <div
        ref={innerRef}
        className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
        style={{ transform: "translateY(0)" }}
      >
        {strip.map((sid, i) => {
          const s = SYMBOLS[SYMBOL_INDEX.get(sid)!];
          // Highlight only when not spinning and tile is in visible row range.
          const isVisibleTile = !spinning && i < ROWS;
          const highlight = isVisibleTile && winRows.has(i);
          return <SymbolTile key={`${i}-${sid}`} sym={s} highlight={highlight} />;
        })}
      </div>
    </div>
  );
}

function SymbolTile({ sym, highlight }: { sym: SymbolDef; highlight: boolean }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        height: TILE_H,
        background: highlight
          ? `radial-gradient(70% 60% at 50% 50%, rgba(${sym.glow},0.30) 0%, rgba(${sym.glow},0.08) 60%, transparent 100%)`
          : "transparent",
        boxShadow: highlight
          ? `inset 0 0 0 2px rgba(${sym.glow},0.85), 0 0 20px rgba(${sym.glow},0.55)`
          : undefined,
        transition: "box-shadow 200ms ease, background 200ms ease",
      }}
    >
      <img
        src={sym.img}
        alt={sym.label}
        draggable={false}
        loading="lazy"
        className="select-none pointer-events-none"
        style={{
          width: "78%",
          height: "78%",
          objectFit: "contain",
          filter: highlight
            ? `drop-shadow(0 0 10px rgba(${sym.glow},0.95)) drop-shadow(0 0 20px rgba(${sym.glow},0.6))`
            : `drop-shadow(0 4px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 8px rgba(${sym.glow},0.25))`,
          animation: highlight ? "slot-win-pulse 0.9s ease-in-out infinite" : undefined,
        }}
      />
    </div>
  );
}

/* ============================================================
   Main game
   ============================================================ */
const LINES = PAYLINES.length;

export function SlotGame() {
  const [balance, setBalance] = useState(100000);
  const [bet, setBet] = useState(2000);
  const [muted, setMuted] = useState(false);
  const [online] = useState(263);

  const [grid, setGrid] = useState<string[][]>(() => generateGrid());
  const [spinning, setSpinning] = useState(false);
  const [reelsStopped, setReelsStopped] = useState(0);
  const [wins, setWins] = useState<WinLine[]>([]);
  const [lastWin, setLastWin] = useState(0);
  const [totalWonRound, setTotalWonRound] = useState(0);
  const [highlightTick, setHighlightTick] = useState(0); // rotates which win is highlighted

  const [history, setHistory] = useState<HistoryItem[]>(() => seedHistory());
  const [now, setNow] = useState(() => Date.now());
  const historyId = useRef(1000);

  useEffect(() => { setAudioMuted(muted); }, [muted]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Fake other players' history
  useEffect(() => {
    const t = setInterval(() => {
      const sid = pickWeightedSymbol();
      const sym = SYMBOLS[SYMBOL_INDEX.get(sid)!];
      const count = 3 + Math.floor(Math.random() * 3);
      const stake = [500, 1000, 2000, 5000, 10000][Math.floor(Math.random() * 5)];
      const mult = sym.pay[count - 3];
      const amount = Math.floor(stake * mult);
      setHistory((h) =>
        [{ id: ++historyId.current, user: pickUser(), symbol: sym.glyph, multiplier: mult, amount, ts: Date.now() }, ...h].slice(0, 30)
      );
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const lineBet = useMemo(() => Math.max(1, Math.floor(bet / LINES)), [bet]);

  const spin = useCallback(() => {
    if (spinning) return;
    if (bet < MIN_BET || bet > balance) return;
    setBalance((b) => b - bet);
    setLastWin(0);
    setTotalWonRound(0);
    setWins([]);
    const newGrid = generateGrid();
    setGrid(newGrid);
    setSpinning(true);
    setReelsStopped(0);
  }, [spinning, bet, balance]);

  // Triggered when last reel reports stop
  const handleReelStop = useCallback(() => {
    setReelsStopped((n) => n + 1);
  }, []);

  // When all reels stopped → evaluate
  useEffect(() => {
    if (!spinning || reelsStopped < REELS) return;
    const { wins: w, total } = evaluateGrid(grid, lineBet);
    setWins(w);
    setLastWin(total);
    setTotalWonRound(total);
    if (total > 0) {
      setBalance((b) => b + total);
      playCashoutSound();
      const best = [...w].sort((a, b) => b.payout - a.payout)[0];
      const bestSym = SYMBOLS[SYMBOL_INDEX.get(best.symbolId)!];
      setHistory((h) =>
        [{ id: ++historyId.current, user: "Tú", symbol: bestSym.glyph, multiplier: total / bet, amount: total, ts: Date.now() }, ...h].slice(0, 30)
      );
    }
    setSpinning(false);
    setReelsStopped(0);
  }, [reelsStopped, spinning, grid, lineBet, bet]);

  // Cycle through wins to highlight one at a time
  useEffect(() => {
    if (wins.length === 0) return;
    const t = setInterval(() => setHighlightTick((x) => x + 1), 1100);
    return () => clearInterval(t);
  }, [wins.length]);

  // Compute which cells are currently highlighted
  const activeWin = wins.length > 0 ? wins[highlightTick % wins.length] : null;
  const highlightedCells = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (let r = 0; r < REELS; r++) map.set(r, new Set());
    if (!activeWin) return map;
    activeWin.cells.forEach(([r, row]) => map.get(r)!.add(row));
    return map;
  }, [activeWin]);

  const canSpin = !spinning && bet >= MIN_BET && bet <= balance;

  return (
    <div className="relative min-h-screen text-white" style={{ backgroundColor: "#060210" }}>
      {/* starfield bg */}
      <div className="pointer-events-none fixed inset-0 bg-stars opacity-40" aria-hidden />
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(120,40,200,0.25) 0%, transparent 60%), radial-gradient(40% 30% at 50% 100%, rgba(46,255,161,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6 pt-4 sm:max-w-lg sm:px-4">
        {/* Header */}
        <header
          className="flex items-center justify-between bg-[#060210]/80 backdrop-blur-sm border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
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
              <div className="font-display text-xs font-bold sm:text-sm text-white">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </header>

        {/* Online */}
        <div className="mt-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-semibold text-emerald-300/90">{online} ONLINE</span>
          </div>
          <button
            onClick={() => setMuted((m) => !m)}
            className="rounded-md p-1 text-purple-200/80 hover:bg-white/5"
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* HUD */}
        <section className="mt-2 grid grid-cols-4 gap-2 rounded-2xl glass-panel p-2 sm:p-2.5">
          <HudCell label="LÍNEAS" value={String(LINES)} />
          <HudCell label="APUESTA" value={`${formatCOP(bet)}`} accent="green" />
          <HudCell label="ÚLTIMA" value={lastWin > 0 ? `${formatCOP(lastWin)}` : "—"} accent={lastWin > 0 ? "green" : "muted"} />
          <HudCell label="x LÍNEA" value={`${formatCOP(lineBet)}`} accent="purple" />
        </section>

        {/* Title */}
        <div className="mt-3 text-center">
          <h1 className="font-display text-2xl font-black tracking-widest"
              style={{
                background: "linear-gradient(180deg,#ffd870 0%,#c4892b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 12px rgba(255,200,80,0.45))",
              }}>
            MAFIA SLOTS
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-purple-200/60">El juego del padrino</p>
        </div>

        {/* Reels */}
        <section
          className="relative mt-3 rounded-2xl p-2 sm:p-2.5"
          style={{
            background: "linear-gradient(160deg,#160830 0%,#0a041c 100%)",
            border: "2px solid rgba(168,85,247,0.45)",
            boxShadow:
              "0 0 0 1px rgba(168,85,247,0.15) inset, 0 0 30px rgba(140,70,220,0.35), 0 12px 30px rgba(0,0,0,0.55)",
          }}
        >
          {/* corner accents */}
          <div className="pointer-events-none absolute -top-px left-3 right-3 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
          <div className="pointer-events-none absolute -bottom-px left-3 right-3 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

          <div className="grid grid-cols-5 gap-1.5 h-[300px] sm:h-[340px]">
            {grid.map((reel, ri) => (
              <Reel
                key={ri}
                finalSyms={reel}
                spinning={spinning}
                delay={ri * 140}
                onStop={handleReelStop}
                winRows={highlightedCells.get(ri) ?? new Set()}
              />
            ))}
          </div>

          {/* Win banner */}
          {lastWin > 0 && !spinning && (
            <div
              className="absolute inset-x-0 -bottom-3 mx-auto w-fit rounded-full border border-emerald-400/60 bg-[#062014]/95 px-4 py-1 backdrop-blur"
              style={{ boxShadow: "0 0 24px rgba(46,255,161,0.55)" }}
            >
              <span className="font-display text-xs font-bold uppercase tracking-widest text-emerald-300">
                ¡Ganaste! <span className="neon-green ml-1">${formatCOP(lastWin)}</span>
              </span>
            </div>
          )}
        </section>

        {/* Pay table preview (top symbols) */}
        <section className="mt-4 grid grid-cols-5 gap-1.5">
          {SYMBOLS.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex flex-col items-center rounded-lg border border-purple-500/20 bg-[#0c0620]/70 p-1.5"
            >
              <span className="text-2xl" style={{ filter: `drop-shadow(0 0 6px rgba(${s.glow},0.4))` }}>{s.glyph}</span>
              <span className="mt-0.5 font-display text-[10px] font-bold neon-green">
                {s.pay[2]}x
              </span>
            </div>
          ))}
        </section>

        {/* Bet controls */}
        <section className="mt-4 rounded-2xl glass-panel p-3">
          <div className="text-[10px] uppercase tracking-widest text-purple-200/70 text-center">APUESTA (COP)</div>
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={() => setBet((b) => Math.max(MIN_BET, b - BET_STEP))}
              disabled={spinning}
              className="flex h-12 w-12 items-center justify-center rounded-xl btn-bet disabled:opacity-40"
            >
              <Minus className="h-5 w-5" />
            </button>
            <div className="flex-1 rounded-xl border border-purple-500/40 bg-[#0c0620] py-2.5 text-center font-display text-xl font-bold text-white">
              {formatCOP(bet)}
            </div>
            <button
              onClick={() => setBet((b) => Math.min(MAX_BET, b + BET_STEP))}
              disabled={spinning}
              className="flex h-12 w-12 items-center justify-center rounded-xl btn-bet disabled:opacity-40"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            <button
              onClick={() => setBet((b) => Math.min(MAX_BET, b * 2))}
              disabled={spinning}
              className="rounded-md btn-bet py-1.5 text-xs font-bold disabled:opacity-40"
            >x2</button>
            {QUICK_BETS.map((q) => (
              <button
                key={q}
                onClick={() => setBet((b) => Math.min(MAX_BET, b + q))}
                disabled={spinning}
                className="rounded-md btn-bet py-1.5 text-[11px] font-bold disabled:opacity-40"
              >+{q >= 1000 ? `${q / 1000}k` : q}</button>
            ))}
          </div>

          <button
            onClick={spin}
            disabled={!canSpin}
            className="mt-3 w-full rounded-xl btn-primary-green btn-primary-action py-4 font-display text-xl font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {spinning ? "GIRANDO…" : "GIRAR"}
          </button>
          <div className="mt-1 text-center text-[10px] text-purple-200/60">
            MÍNIMO: {formatCOP(MIN_BET)} COP · MÁXIMO: {formatCOP(MAX_BET)} COP
          </div>
        </section>

        {/* Last wins (live ticker) */}
        <section className="mt-4 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-300" />
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-white">Últimas ganancias</h3>
          </div>
          <ul className="mt-3 flex max-h-[180px] flex-col gap-2 overflow-hidden">
            {history.slice(0, 6).map((w) => (
              <li
                key={w.id}
                className="flex h-[44px] items-center gap-3 rounded-lg border border-purple-500/20 bg-[#150830]/60 px-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600/30 ring-1 ring-purple-400/30">
                  <User className="h-4 w-4 text-purple-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-white">{w.user}</div>
                  <div className="text-[10px] uppercase tracking-wider text-purple-300/70">
                    {w.symbol} · {relativeTime(w.ts, now)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xs font-bold">
                    <span className="neon-green mr-0.5">$</span>
                    <span className="text-white">{formatCOP(w.amount)} COP</span>
                  </div>
                  <div className="text-[10px] font-bold text-purple-300">{w.multiplier.toFixed(2)}x</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="h-6" />
      </div>

      <style>{`
        @keyframes slot-spin {
          0%   { transform: translateY(0); }
          100% { transform: translateY(calc(-${REEL_LEN * 2} * (100% / ${ROWS}))); }
        }
        @keyframes slot-win-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.18); }
        }
      `}</style>
    </div>
  );
}

function HudCell({ label, value, accent }: { label: string; value: string; accent?: "green" | "purple" | "muted" }) {
  const cls =
    accent === "green"  ? "neon-green" :
    accent === "purple" ? "text-purple-200" :
    accent === "muted"  ? "text-purple-300/50" :
    "text-white";
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-widest text-purple-200/70">{label}</div>
      <div className="mt-1 rounded-lg border border-purple-500/30 bg-[#160830]/60 py-1.5">
        <span className={`font-display text-sm font-bold ${cls}`}>{value}</span>
      </div>
    </div>
  );
}

function seedHistory(): HistoryItem[] {
  const now = Date.now();
  let id = 1;
  return [
    { id: id++, user: "TommyGun",  symbol: "👑", multiplier: 12.5, amount: 250000, ts: now - 8_000 },
    { id: id++, user: "VitoC",     symbol: "🚗", multiplier: 4.8,  amount: 96000,  ts: now - 22_000 },
    { id: id++, user: "AlCapone",  symbol: "💰", multiplier: 3.2,  amount: 64000,  ts: now - 45_000 },
    { id: id++, user: "PeakyB",    symbol: "🪙", multiplier: 2.1,  amount: 42000,  ts: now - 70_000 },
    { id: id++, user: "DonLuca",   symbol: "⌚", multiplier: 1.6,  amount: 32000,  ts: now - 110_000 },
    { id: id++, user: "MissFox",   symbol: "💼", multiplier: 1.2,  amount: 24000,  ts: now - 160_000 },
  ];
}