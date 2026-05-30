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
  symbolId: string;
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

/* Reels spinning loop — soft whirring + rhythmic ticks */
let reelLoopNodes: {
  whirSrc: AudioBufferSourceNode;
  whirGain: GainNode;
  tickTimer: number;
} | null = null;

function startReelLoop() {
  if (isMuted()) return;
  const c = ctx(); if (!c || reelLoopNodes) return;
  // Whirring noise bed
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.03 * w) / 1.03;
    d[i] = last * 2.5;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 850;
  bp.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.08);
  src.connect(bp).connect(g).connect(c.destination);
  src.start();

  // Rhythmic high tick like reel pegs
  const tick = () => {
    const cc = ctx(); if (!cc) return;
    const t = cc.currentTime;
    const o = cc.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(2200, t);
    const og = cc.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.025, t + 0.002);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(og).connect(cc.destination);
    o.start(t); o.stop(t + 0.05);
  };
  const tickTimer = window.setInterval(tick, 70);
  reelLoopNodes = { whirSrc: src, whirGain: g, tickTimer };
}

function stopReelLoop() {
  const c = actx;
  if (!c || !reelLoopNodes) return;
  const { whirSrc, whirGain, tickTimer } = reelLoopNodes;
  clearInterval(tickTimer);
  const t = c.currentTime;
  whirGain.gain.cancelScheduledValues(t);
  whirGain.gain.setValueAtTime(whirGain.gain.value, t);
  whirGain.gain.linearRampToValueAtTime(0, t + 0.15);
  setTimeout(() => { try { whirSrc.stop(); } catch {} }, 200);
  reelLoopNodes = null;
}

/* ============================================================
   Reel component — continuous translateY strip (no flicker)
   ============================================================ */
const TILE_H = 88; // px per tile (3 rows visible = 264px tall window)
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
      className="relative overflow-hidden"
      style={{
        height: TILE_H * visibleRows,
        background:
          "linear-gradient(180deg, rgba(8,3,22,0.92) 0%, rgba(18,8,42,0.85) 50%, rgba(8,3,22,0.92) 100%)",
        boxShadow:
          "inset 0 8px 14px rgba(0,0,0,0.55), inset 0 -8px 14px rgba(0,0,0,0.55)",
      }}
    >
      {/* top + bottom inner shadow for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-5 z-10"
           style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.85), transparent)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 z-10"
           style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.85), transparent)" }} />

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
  const scale = sym.id === "hat" ? 1.18 : sym.id === "boss" ? 1.12 : 1;
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
          width: "96%",
          height: "96%",
          objectFit: "contain",
          transform: scale !== 1 ? `scale(${scale})` : undefined,
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
  const [autoSpin, setAutoSpin] = useState(false);
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
        [{ id: ++historyId.current, user: pickUser(), symbolId: sym.id, multiplier: mult, amount, ts: Date.now() }, ...h].slice(0, 30)
      );
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const lineBet = useMemo(() => Math.max(1, Math.floor(bet / LINES)), [bet]);

  const spin = useCallback(() => {
    if (spinning) return;
    if (bet < MIN_BET || bet > balance) return;
    startReelLoop();
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
    stopReelLoop();
    const { wins: w, total } = evaluateGrid(grid, lineBet);
    setWins(w);
    setLastWin(total);
    setTotalWonRound(total);
    if (total > 0) {
      setBalance((b) => b + total);
      playCashoutSound();
      const best = [...w].sort((a, b) => b.payout - a.payout)[0];
      setHistory((h) =>
        [{ id: ++historyId.current, user: "Tú", symbolId: best.symbolId, multiplier: total / bet, amount: total, ts: Date.now() }, ...h].slice(0, 30)
      );
    }
    setSpinning(false);
    setReelsStopped(0);
  }, [reelsStopped, spinning, grid, lineBet, bet]);

  // Auto-spin: re-trigger spin after each round when enabled
  useEffect(() => {
    if (!autoSpin || spinning) return;
    if (bet < MIN_BET || bet > balance) {
      setAutoSpin(false);
      return;
    }
    const t = setTimeout(() => spin(), 900);
    return () => clearTimeout(t);
  }, [autoSpin, spinning, bet, balance, spin]);

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
  const winMult = lastWin > 0 ? lastWin / bet : 1;

  return (
    <div className="relative min-h-screen text-white" style={{ backgroundColor: "#060210" }}>
      <div className="pointer-events-none fixed inset-0 bg-stars opacity-40" aria-hidden />
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(120,40,200,0.28) 0%, transparent 60%), radial-gradient(40% 30% at 50% 100%, rgba(46,255,161,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-4 pt-4 sm:max-w-lg sm:px-4">
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

        {/* Online + mute */}
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

        {/* HUD (matches reference) */}
        <section className="mt-2 grid grid-cols-4 gap-1.5 rounded-2xl glass-panel p-1.5 sm:p-2">
          <HudCell label="LÍNEAS" value={String(LINES)} />
          <HudCell label="PREMIO TOTAL" value={lastWin > 0 ? `${formatCOP(lastWin)} COP` : "—"} accent="green" wide />
          <HudCell label="TIRADAS GRATIS" value="--" accent="muted" />
          <HudCell label="MULTIPLICADOR" value={`x${winMult >= 10 ? winMult.toFixed(1) : winMult.toFixed(2).replace(/\.?0+$/, "")}`} accent="purple" />
        </section>

        {/* Reels frame wrapper — labels sit on the neon border edge */}
        <section className="relative mt-3">
          {/* Title badge on frame — OUTSIDE clip so it isn't cut */}
          <div className="absolute left-1/2 -top-3 z-30 -translate-x-1/2">
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1"
              style={{
                background: "linear-gradient(180deg, rgba(20,8,42,0.95), rgba(8,2,18,0.95))",
                border: "1px solid rgba(168,85,247,0.65)",
                boxShadow: "0 0 18px rgba(168,85,247,0.55), inset 0 0 8px rgba(168,85,247,0.25)",
              }}
            >
              <span className="text-[10px]">✦</span>
              <span
                className="font-display text-sm font-black tracking-[0.18em]"
                style={{
                  background: "linear-gradient(180deg,#c084fc 0%,#7c3aed 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 8px rgba(168,85,247,0.7))",
                }}
              >MAFIA</span>
              <span className="font-display text-sm font-black tracking-[0.18em] neon-green">ROYALE</span>
              <span className="text-[10px]">✦</span>
            </div>
          </div>

          {/* Lines side labels — OUTSIDE the frame, in the gutter */}
          <div className="pointer-events-none absolute left-0 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 -rotate-90">
            <span className="font-display text-[9px] font-bold tracking-[0.32em] neon-green whitespace-nowrap">
              {LINES} LÍNEAS
            </span>
          </div>
          <div className="pointer-events-none absolute right-0 top-1/2 z-30 translate-x-1/2 -translate-y-1/2 rotate-90">
            <span className="font-display text-[9px] font-bold tracking-[0.32em] neon-green whitespace-nowrap">
              {LINES} LÍNEAS
            </span>
          </div>

          {/* Neon 2D frame with clipped (notched) corners */}
          <div
            className="relative"
            style={{
              clipPath:
                "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
              background:
                "linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #c084fc 100%)",
              padding: "2px",
              filter:
                "drop-shadow(0 0 10px rgba(168,85,247,0.55)) drop-shadow(0 0 22px rgba(168,85,247,0.28))",
            }}
          >
            <div
              className="relative p-2 sm:p-2.5"
              style={{
                clipPath:
                  "polygon(15px 0, calc(100% - 15px) 0, 100% 15px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 15px 100%, 0 calc(100% - 15px), 0 15px)",
                background: "#0a041c",
              }}
            >
          <div className="relative pt-3">
            <div className="grid grid-cols-5 gap-0">
              {grid.map((reel, ri) => (
                <Reel
                  key={ri}
                  finalSyms={reel}
                  spinning={spinning}
                  reelIndex={ri}
                  onStop={handleReelStop}
                  winRows={highlightedCells.get(ri) ?? new Set()}
                />
              ))}
              {/* Single neon vertical dividers between reels */}
              <div className="pointer-events-none absolute inset-y-3 left-0 z-20 grid w-full grid-cols-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="relative">
                    {i < 4 && (
                      <div
                        className="absolute right-0 top-0 h-full w-px"
                        style={{
                          background:
                            "linear-gradient(180deg, transparent 0%, rgba(168,85,247,0.85) 15%, rgba(192,132,252,0.95) 50%, rgba(168,85,247,0.85) 85%, transparent 100%)",
                          boxShadow:
                            "0 0 6px rgba(168,85,247,0.85), 0 0 12px rgba(168,85,247,0.5)",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

            </div>
          </div>

          {/* Big win banner — OUTSIDE clip so it isn't cut */}
          {lastWin > 0 && !spinning && (
            <div
              className="absolute inset-x-0 -bottom-3 z-30 mx-auto w-fit rounded-full border border-emerald-400/60 bg-[#062014]/95 px-4 py-1 backdrop-blur"
              style={{ boxShadow: "0 0 24px rgba(46,255,161,0.55)", animation: "scale-in 0.3s ease-out" }}
            >
              <span className="font-display text-xs font-bold uppercase tracking-widest text-emerald-300">
                ¡Ganaste! <span className="neon-green ml-1">${formatCOP(lastWin)}</span>
              </span>
            </div>
          )}
        </section>

        {/* Pay table preview (top 5 symbols) */}
        <section className="mt-4 grid grid-cols-5 gap-1.5">
          {SYMBOLS.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex flex-col items-center rounded-lg border border-purple-500/25 bg-[#0c0620]/70 px-1 py-1.5"
            >
              <div className="flex items-center gap-0.5">
                {[0, 1, 2].map((i) => (
                  <img
                    key={i}
                    src={s.img}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-5 w-5 object-contain"
                    style={{ filter: `drop-shadow(0 0 4px rgba(${s.glow},0.45))` }}
                  />
                ))}
              </div>
              <span className="mt-1 font-display text-[10px] font-bold neon-green">{s.pay[2]}.00x</span>
            </div>
          ))}
        </section>

        {/* Bet panel */}
        <section className="mt-3 rounded-2xl glass-panel p-3">
          <div className="flex gap-2.5">
            {/* Left: bet controls */}
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-purple-200/70 text-center">APUESTA (COP)</div>
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  onClick={() => setBet((b) => Math.max(MIN_BET, b - BET_STEP))}
                  disabled={spinning}
                  className="flex h-11 w-11 items-center justify-center rounded-xl btn-bet disabled:opacity-40"
                ><Minus className="h-5 w-5" /></button>
                <div className="flex-1 rounded-xl border border-purple-500/40 bg-[#0c0620] py-2.5 text-center font-display text-lg font-bold text-white">
                  {formatCOP(bet)}
                </div>
                <button
                  onClick={() => setBet((b) => Math.min(MAX_BET, b + BET_STEP))}
                  disabled={spinning}
                  className="flex h-11 w-11 items-center justify-center rounded-xl btn-bet disabled:opacity-40"
                ><Plus className="h-5 w-5" /></button>
              </div>
              <div className="mt-1.5 grid grid-cols-5 gap-1">
                <button
                  onClick={() => setBet((b) => Math.min(MAX_BET, Math.max(MIN_BET, b * 2)))}
                  disabled={spinning}
                  className="rounded-md btn-bet py-1 text-[11px] font-bold disabled:opacity-40"
                >x2</button>
                {QUICK_BETS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setBet((b) => Math.min(MAX_BET, b + q))}
                    disabled={spinning}
                    className="rounded-md btn-bet py-1 text-[10px] font-bold disabled:opacity-40"
                  >+{q >= 1000 ? `${q / 1000}k` : q}</button>
                ))}
              </div>
            </div>

            {/* Right: GIRAR + AUTO */}
            <div className="flex w-[42%] flex-col gap-1.5" style={{ minHeight: 102 }}>
              <button
                onClick={spin}
                disabled={!canSpin}
                className="flex-1 rounded-2xl btn-primary-green btn-primary-action flex items-center justify-center font-display font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xl tracking-[0.15em]">{spinning ? "GIRANDO…" : "GIRAR"}</span>
              </button>
              <button
                onClick={() => setAutoSpin((a) => !a)}
                disabled={bet < MIN_BET || bet > balance}
                aria-pressed={autoSpin}
                className={`h-9 rounded-xl font-display font-black uppercase tracking-[0.2em] text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed border ${
                  autoSpin
                    ? "bg-gradient-to-b from-amber-300 to-amber-500 text-[#1a0a02] border-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
                    : "bg-[#1a0f33] text-purple-100 border-purple-500/50 hover:border-purple-400 hover:bg-[#221347] shadow-[0_0_10px_rgba(168,85,247,0.25)]"
                }`}
              >
                {autoSpin ? "AUTO ON" : "AUTO"}
              </button>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] text-purple-200/60">
            MÍNIMO: {formatCOP(MIN_BET)} COP · MÁXIMO: {formatCOP(MAX_BET)} COP
          </div>
        </section>

        {/* Last wins ticker */}
        <section className="mt-3 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 p-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-300" />
            <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-white">Últimas ganancias</h3>
            <Trophy className="ml-auto h-4 w-4 text-purple-300/70" />
          </div>
          <ul className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {history.slice(0, 8).map((w) => {
              const sym = SYMBOLS[SYMBOL_INDEX.get(w.symbolId)!];
              return (
                <li
                  key={w.id}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/30 bg-[#08221a]/70 px-2.5 py-1"
                  style={{ boxShadow: "0 0 10px rgba(46,255,161,0.18) inset" }}
                >
                  <img src={sym.img} alt="" aria-hidden loading="lazy" className="h-5 w-5 object-contain"
                       style={{ filter: `drop-shadow(0 0 4px rgba(${sym.glow},0.5))` }} />
                  <div className="leading-tight">
                    <div className="font-display text-[11px] font-bold neon-green">{w.multiplier.toFixed(2)}x</div>
                    <div className="text-[9px] font-semibold text-purple-100/80">{formatCOP(w.amount)} COP</div>
                  </div>
                  <span className="text-[8px] uppercase tracking-wider text-purple-300/60 ml-1">
                    {w.user} · {relativeTime(w.ts, now)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <style>{`
        @keyframes slot-win-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.10); }
        }
      `}</style>
    </div>
  );
}

function HudCell({
  label,
  value,
  accent,
  wide,
}: {
  label: string;
  value: string;
  accent?: "green" | "purple" | "muted";
  wide?: boolean;
}) {
  const cls =
    accent === "green"  ? "neon-green" :
    accent === "purple" ? "text-purple-300" :
    accent === "muted"  ? "text-purple-300/50" :
    "text-white";
  return (
    <div className="text-center">
      <div className="text-[8px] uppercase tracking-widest text-purple-200/70">{label}</div>
      <div
        className="mt-1 rounded-lg border border-purple-500/30 bg-[#160830]/70 py-1.5"
        style={{ boxShadow: "inset 0 0 8px rgba(168,85,247,0.18)" }}
      >
        <span className={`font-display ${wide ? "text-[11px]" : "text-xs"} font-bold ${cls}`}>{value}</span>
      </div>
    </div>
  );
}

function seedHistory(): HistoryItem[] {
  const now = Date.now();
  let id = 1;
  return [
    { id: id++, user: "TommyGun",  symbolId: "boss",  multiplier: 12.5, amount: 250000, ts: now - 8_000 },
    { id: id++, user: "VitoC",     symbolId: "car",   multiplier: 4.8,  amount: 96000,  ts: now - 22_000 },
    { id: id++, user: "AlCapone",  symbolId: "brief", multiplier: 3.2,  amount: 64000,  ts: now - 45_000 },
    { id: id++, user: "PeakyB",    symbolId: "gold",  multiplier: 2.1,  amount: 42000,  ts: now - 70_000 },
    { id: id++, user: "DonLuca",   symbolId: "watch", multiplier: 1.6,  amount: 32000,  ts: now - 110_000 },
    { id: id++, user: "MissFox",   symbolId: "chip",  multiplier: 1.2,  amount: 24000,  ts: now - 160_000 },
  ];
}