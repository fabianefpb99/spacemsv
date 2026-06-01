import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { Menu, Settings, Volume2, VolumeX, Minus, Plus, TrendingUp, Trophy } from "lucide-react";
import { setMuted as setAudioMuted, playCashoutSound, playCoinsSound, isMuted } from "@/lib/gameAudio";
import pageBg from "@/assets/mines-page-bg.png";
import mafiaJazzUrl from "@/assets/mafia-jazz.mp3";

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
  { id: "boss",  img: bossImg,      label: "EL PADRINO", pay: [55, 240, 1100], weight: 2,  glow: "168,85,247"  },
  { id: "car",   img: carImg,       label: "CADILLAC",   pay: [34, 130, 440],  weight: 3,  glow: "180,180,255" },
  { id: "brief", img: briefcaseImg, label: "MALETÍN $",  pay: [24, 72, 240],   weight: 4,  glow: "46,255,161"  },
  { id: "gold",  img: goldImg,      label: "LINGOTE",    pay: [19, 50, 165],   weight: 5,  glow: "255,210,80"  },
  { id: "watch", img: watchImg,     label: "RELOJ ORO",  pay: [13, 32, 95],    weight: 6,  glow: "255,200,80"  },
  { id: "chip",  img: chipImg,      label: "FICHA",      pay: [10, 24, 68],    weight: 8,  glow: "168,85,247"  },
  { id: "hat",   img: hatImg,       label: "SOMBRERO",   pay: [8, 18, 50],     weight: 10, glow: "200,120,255" },
  { id: "card",  img: cardImg,      label: "AS",         pay: [7, 14, 32],     weight: 12, glow: "255,180,80"  },
];

const SYMBOL_INDEX = new Map(SYMBOLS.map((s, i) => [s.id, i]));

/* Win tiers — visual + sonoro según qué tan grande es la victoria de cada línea */
export type WinTier = "normal" | "fire" | "mega";
function getWinTier(payout: number, totalBet: number): WinTier {
  if (totalBet <= 0) return "normal";
  const mult = payout / totalBet;
  if (mult >= 10) return "mega";
  if (mult >= 1) return "fire";
  return "normal";
}

/* Colores de marco por tier (rgb sin alpha para inyectar en gradients) */
const TIER_GLOW: Record<WinTier, string> = {
  normal: "46,255,161", // verde neón (el actual)
  fire:   "255,120,30",  // naranja-rojo fuego
  mega:   "255,215,0",   // dorado mega
};

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
const ROWS = 4;

/* 20 paylines on 5x4 grid (row index per reel, 0=top, 3=bottom) */
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // row 2
  [2, 2, 2, 2, 2], // row 3
  [0, 0, 0, 0, 0], // row 1 (top)
  [3, 3, 3, 3, 3], // row 4 (bottom)
  [0, 1, 2, 1, 0], // V top
  [3, 2, 1, 2, 3], // ^ bottom
  [1, 2, 3, 2, 1], // V mid
  [2, 1, 0, 1, 2], // ^ mid
  [0, 0, 1, 2, 2], // diag down upper
  [3, 3, 2, 1, 1], // diag up lower
  [1, 0, 0, 0, 1], // U upper
  [2, 3, 3, 3, 2], // U lower
  [0, 1, 1, 1, 0], // arch upper
  [3, 2, 2, 2, 3], // arch lower
  [1, 2, 1, 2, 1], // zigzag mid
  [2, 1, 2, 1, 2], // zigzag mid 2
  [0, 1, 2, 3, 3], // staircase down
  [3, 2, 1, 0, 0], // staircase up
  [1, 1, 2, 3, 3], // step down
  [2, 2, 1, 0, 0], // step up
  [0, 2, 0, 2, 0], // big zigzag top
  [3, 1, 3, 1, 3], // big zigzag bottom
  [1, 0, 1, 0, 1], // zigzag upper
  [2, 3, 2, 3, 2], // zigzag lower
  [0, 3, 0, 3, 0], // deep zigzag
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
    // --- Left → Right (starts at reel 0) ---
    const firstSym = grid[0][line[0]];
    let countL = 1;
    for (let r = 1; r < REELS; r++) {
      if (grid[r][line[r]] === firstSym) countL++;
      else break;
    }
    if (countL >= 3) {
      const sym = SYMBOLS[SYMBOL_INDEX.get(firstSym)!];
      const payout = sym.pay[countL - 3] * lineBet;
      if (payout > 0) {
        const cells: [number, number][] = [];
        for (let r = 0; r < countL; r++) cells.push([r, line[r]]);
        wins.push({ lineIdx, symbolId: firstSym, count: countL, payout, cells });
      }
    }

    // --- Right → Left (starts at reel 4) — Pay Both Ways ---
    // Skip if the L→R already covered all 5 reels (would double-count the same combo).
    if (countL >= REELS) return;
    const lastSym = grid[REELS - 1][line[REELS - 1]];
    let countR = 1;
    for (let r = REELS - 2; r >= 0; r--) {
      if (grid[r][line[r]] === lastSym) countR++;
      else break;
    }
    if (countR >= 3) {
      // Avoid overlap with the L→R win on the same line+symbol
      // (e.g. all 5 are "ficha" → already paid above; but countL===5 was skipped).
      // If both directions hit with different symbols, both pay independently.
      const sym = SYMBOLS[SYMBOL_INDEX.get(lastSym)!];
      const payout = sym.pay[countR - 3] * lineBet;
      if (payout > 0) {
        const cells: [number, number][] = [];
        for (let i = 0; i < countR; i++) {
          const r = REELS - 1 - i;
          cells.push([r, line[r]]);
        }
        // 20 paylines L→R + 20 R→L = lineIdx + LINES so highlight cycler treats them as distinct
        wins.push({ lineIdx: lineIdx + PAYLINES.length, symbolId: lastSym, count: countR, payout, cells });
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

/* ---- Sonidos por tier de premio ---- */
function playFireWinSound() {
  if (isMuted()) return;
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime;
  // Triple campana ascendente naranja
  [880, 1175, 1568].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t0 + i * 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0 + i * 0.08);
    g.gain.linearRampToValueAtTime(0.12, t0 + i * 0.08 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.08 + 0.45);
    o.connect(g).connect(c.destination);
    o.start(t0 + i * 0.08); o.stop(t0 + i * 0.08 + 0.5);
  });
}
function playMegaWinSound() {
  if (isMuted()) return;
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime;
  // Fanfarria dorada: acorde + arpeggio brillante
  const chord = [523.25, 659.25, 783.99, 1046.5];
  chord.forEach((f) => {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.06, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 3500;
    o.connect(lp).connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + 1.15);
  });
  // Sparkle arpeggio
  [1318, 1568, 1976, 2349, 2637].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t0 + 0.1 + i * 0.07);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0 + 0.1 + i * 0.07);
    g.gain.linearRampToValueAtTime(0.08, t0 + 0.1 + i * 0.07 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1 + i * 0.07 + 0.35);
    o.connect(g).connect(c.destination);
    o.start(t0 + 0.1 + i * 0.07); o.stop(t0 + 0.1 + i * 0.07 + 0.4);
  });
}

/* ============================================================
   Reel component — continuous translateY strip (no flicker)
   ============================================================ */
const TILE_H = 66; // px per tile (4 rows visible = 264px tall window, same as before)
const SPIN_BASE_MS = 1400;
const SPIN_STAGGER_MS = 220;

function Reel({
  finalSyms,
  spinning,
  reelIndex,
  onStop,
  winRows,
  winTier,
}: {
  finalSyms: string[];
  spinning: boolean;
  reelIndex: number;
  onStop: () => void;
  winRows: Set<number>;
  winTier: WinTier;
}) {
  // Strip: [fillers..., finalSyms[0], finalSyms[1], finalSyms[2]]
  // When idle: strip = finalSyms (3 tiles), translateY = 0.
  const [strip, setStrip] = useState<string[]>(finalSyms);
  const innerRef = useRef<HTMLDivElement>(null);
  const spinTokenRef = useRef(0);
  // Tracks the symbols currently shown in the visible window, so a new spin
  // can start from them (no visual jump when fillers get inserted).
  const displayedRef = useRef<string[]>(finalSyms);

  // Sync strip with finalSyms when not spinning (e.g. initial render).
  useEffect(() => {
    if (spinning) return;
    setStrip(finalSyms);
    displayedRef.current = finalSyms;
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
    // Start the strip with what's already on screen so the swap is invisible,
    // then fillers, then the new landing symbols.
    const startSyms = displayedRef.current;
    const longStrip = [...startSyms, ...fillers, ...finalSyms];
    // CRITICAL: flushSync forces React to commit the new (longer) strip to the
    // DOM synchronously BEFORE we touch transforms. Without this, iOS Safari's
    // requestAnimationFrame can fire before React commits the new tree, so the
    // transition starts on the old 3-tile DOM and the new tiles "pop in" mid
    // animation, giving the impression that icons disappear at spin start.
    flushSync(() => setStrip(longStrip));

    const el = innerRef.current;
    if (!el) return;

    // 1) Position at top (showing the previously-visible symbols) — no jump.
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
      displayedRef.current = finalSyms;
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
          return <SymbolTile key={`${i}-${sid}`} sym={s} highlight={highlight} tier={winTier} />;
        })}
      </div>
    </div>
  );
}

function SymbolTile({ sym, highlight, tier }: { sym: SymbolDef; highlight: boolean; tier: WinTier }) {
  const scale = (sym.id === "hat" ? 1.18 : sym.id === "boss" ? 1.12 : 1) * 1.04;
  // El color del marco lo dicta el tier (no el símbolo) para que el jugador
  // identifique de un vistazo cuán bueno fue el premio.
  const glow = highlight ? TIER_GLOW[tier] : sym.glow;
  const ringWidth = tier === "mega" ? 3 : tier === "fire" ? 2.5 : 2;
  const outerShadow =
    tier === "mega"
      ? `0 0 30px rgba(${glow},0.85), 0 0 60px rgba(${glow},0.55), 0 0 90px rgba(255,255,255,0.35)`
      : tier === "fire"
        ? `0 0 22px rgba(${glow},0.85), 0 0 44px rgba(255,60,0,0.55)`
        : `0 0 20px rgba(${glow},0.55)`;
  const animName =
    !highlight ? undefined
    : tier === "mega" ? "slot-win-mega 0.7s ease-in-out infinite"
    : tier === "fire" ? "slot-win-fire 0.55s ease-in-out infinite"
    : "slot-win-pulse 0.9s ease-in-out infinite";
  const showFlames = highlight && (tier === "fire" || tier === "mega");
  const showGreenAura = highlight && tier === "normal";
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        height: TILE_H,
        background: "transparent",
        boxShadow: highlight
          ? `inset 0 0 0 ${ringWidth}px rgba(${glow},0.95), ${outerShadow}`
          : undefined,
        transition: "box-shadow 200ms ease, background 200ms ease",
        overflow: "hidden",
      }}
    >
      {/* Llamas realistas detrás del símbolo */}
      {showFlames && <FlameBackdrop tier={tier} />}
      {/* Aura/humo verde luminoso emanando del icono */}
      {showGreenAura && <GreenAuraBackdrop />}
      {/* Marco decorativo */}
      {highlight && tier === "fire" && <FireOrnament />}
      {highlight && tier === "mega" && <MegaOrnament />}
      <img
        src={sym.img}
        alt={sym.label}
        draggable={false}
        loading="eager"
        decoding="sync"
        className="select-none pointer-events-none relative z-10"
        style={{
          width: "96%",
          height: "96%",
          objectFit: "contain",
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          filter: highlight
            ? `drop-shadow(0 0 10px rgba(${glow},0.95)) drop-shadow(0 0 20px rgba(${glow},0.7))`
            : `drop-shadow(0 4px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 8px rgba(${sym.glow},0.25))`,
          animation: animName,
        }}
      />
    </div>
  );
}

/* ============================================================
   Main game
   ============================================================ */
/* ----- Ornamentos de premio (SVG profesionales) ----- */
/* Aura verde luminosa que emana del icono — varias volutas de "humo" verde
   neón que ascienden desde el centro del símbolo, no del marco. */
function GreenAuraBackdrop() {
  // Volutas dispersas alrededor del icono. Cada una sube, se expande y desvanece.
  const wisps = [
    { left: "50%", size: 70, delay: "0ms",    dur: "2.4s", drift: "-6px" },
    { left: "32%", size: 50, delay: "350ms",  dur: "2.1s", drift: "-14px" },
    { left: "68%", size: 50, delay: "600ms",  dur: "2.3s", drift: "10px" },
    { left: "42%", size: 38, delay: "1100ms", dur: "1.9s", drift: "-4px" },
    { left: "60%", size: 42, delay: "850ms",  dur: "2.0s", drift: "6px" },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Halo base suave detrás del icono */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "85%",
          height: "85%",
          background:
            "radial-gradient(circle at 50% 55%, rgba(46,255,161,0.55) 0%, rgba(46,255,161,0.18) 45%, transparent 75%)",
          filter: "blur(6px)",
          animation: "slot-aura-breathe 1.6s ease-in-out infinite",
        }}
      />
      {/* Volutas / humo verde ascendente */}
      {wisps.map((w, i) => (
        <span
          key={i}
          className="absolute -translate-x-1/2"
          style={{
            left: w.left,
            top: "55%",
            width: w.size,
            height: w.size,
            borderRadius: "9999px",
            background:
              "radial-gradient(circle at 50% 50%, rgba(180,255,210,0.85) 0%, rgba(46,255,161,0.55) 35%, rgba(20,180,120,0.25) 70%, transparent 100%)",
            filter: "blur(7px)",
            opacity: 0,
            // @ts-ignore -- CSS custom property
            "--aura-drift": w.drift,
            animation: `slot-aura-rise ${w.dur} cubic-bezier(.4,.0,.6,1) ${w.delay} infinite`,
            mixBlendMode: "screen",
          }}
        />
      ))}
      {/* Destellos / partículas pequeñas */}
      <span
        className="absolute"
        style={{
          left: "40%", top: "40%", width: 3, height: 3, borderRadius: 9999,
          background: "#d8ffe9",
          boxShadow: "0 0 8px rgba(46,255,161,0.95)",
          animation: "slot-aura-spark 1.4s ease-out infinite",
        }}
      />
      <span
        className="absolute"
        style={{
          right: "30%", top: "50%", width: 2.5, height: 2.5, borderRadius: 9999,
          background: "#b8ffd6",
          boxShadow: "0 0 6px rgba(46,255,161,0.9)",
          animation: "slot-aura-spark 1.7s ease-out 0.5s infinite",
        }}
      />
      <span
        className="absolute"
        style={{
          left: "55%", top: "30%", width: 2, height: 2, borderRadius: 9999,
          background: "#ffffff",
          boxShadow: "0 0 7px rgba(46,255,161,1)",
          animation: "slot-aura-spark 1.2s ease-out 0.3s infinite",
        }}
      />
    </div>
  );
}

/* Llamas reales detrás del símbolo ganador. Varias lenguas de fuego
   independientes que oscilan con timings desfasados para sentirse vivas. */
function FlameBackdrop({ tier }: { tier: "fire" | "mega" }) {
  const id = tier === "mega" ? "mega" : "fire";
  // Paletas: fuego naranja vs fuego dorado/blanco.
  const palette =
    tier === "mega"
      ? { outer: "#b8860b", mid: "#ffd84a", inner: "#fff8d0", base: "rgba(255,200,40,0.55)" }
      : { outer: "#c11d00", mid: "#ff7a1a", inner: "#ffd86b", base: "rgba(255,90,0,0.55)" };
  // 5 lenguas de llama posicionadas a lo ancho de la base.
  const tongues = [
    { cx: 10, w: 22, h: 60, delay: "0ms",   dur: "620ms" },
    { cx: 30, w: 28, h: 78, delay: "140ms", dur: "540ms" },
    { cx: 50, w: 34, h: 92, delay: "60ms",  dur: "700ms" },
    { cx: 70, w: 28, h: 78, delay: "200ms", dur: "580ms" },
    { cx: 90, w: 22, h: 60, delay: "100ms", dur: "640ms" },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Resplandor base radial caliente, simula el calor del fuego */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(80% 60% at 50% 100%, ${palette.base} 0%, transparent 70%)`,
          animation: "slot-flame-heat 380ms ease-in-out infinite alternate",
        }}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        style={{
          filter: tier === "mega"
            ? "drop-shadow(0 0 6px rgba(255,215,0,0.85)) drop-shadow(0 0 14px rgba(255,180,0,0.55))"
            : "drop-shadow(0 0 5px rgba(255,140,30,0.9)) drop-shadow(0 0 12px rgba(255,60,0,0.6))",
        }}
      >
        <defs>
          <linearGradient id={`flameGrad-${id}-outer`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"   stopColor={palette.outer} stopOpacity="0.95" />
            <stop offset="55%"  stopColor={palette.mid}   stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`flameGrad-${id}-inner`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"   stopColor={palette.mid}   stopOpacity="0.95" />
            <stop offset="60%"  stopColor={palette.inner} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff"       stopOpacity="0" />
          </linearGradient>
        </defs>
        {tongues.map((t, i) => {
          // forma de lengua: base ancha, punta fina, curvas Bezier
          const half = t.w / 2;
          const top = 100 - t.h;
          const d = `M ${t.cx - half} 100
                     C ${t.cx - half} ${top + t.h * 0.45},
                       ${t.cx - half * 0.4} ${top + t.h * 0.25},
                       ${t.cx} ${top}
                     C ${t.cx + half * 0.4} ${top + t.h * 0.25},
                       ${t.cx + half} ${top + t.h * 0.45},
                       ${t.cx + half} 100 Z`;
          const innerHalf = half * 0.55;
          const innerTop = top + t.h * 0.25;
          const dIn = `M ${t.cx - innerHalf} 100
                       C ${t.cx - innerHalf} ${innerTop + (100 - innerTop) * 0.45},
                         ${t.cx - innerHalf * 0.3} ${innerTop + (100 - innerTop) * 0.2},
                         ${t.cx} ${innerTop}
                       C ${t.cx + innerHalf * 0.3} ${innerTop + (100 - innerTop) * 0.2},
                         ${t.cx + innerHalf} ${innerTop + (100 - innerTop) * 0.45},
                         ${t.cx + innerHalf} 100 Z`;
          return (
            <g key={i} style={{ transformOrigin: `${t.cx}% 100%`, transformBox: "fill-box" as const }}>
              <path
                d={d}
                fill={`url(#flameGrad-${id}-outer)`}
                style={{
                  transformOrigin: `${t.cx}px 100px`,
                  transformBox: "view-box" as const,
                  animation: `slot-flame-tongue ${t.dur} ease-in-out ${t.delay} infinite alternate`,
                }}
              />
              <path
                d={dIn}
                fill={`url(#flameGrad-${id}-inner)`}
                style={{
                  transformOrigin: `${t.cx}px 100px`,
                  transformBox: "view-box" as const,
                  animation: `slot-flame-tongue ${parseInt(t.dur) - 80}ms ease-in-out ${t.delay} infinite alternate-reverse`,
                }}
              />
            </g>
          );
        })}
      </svg>
      {/* Brasas flotando hacia arriba */}
      <span className="absolute left-[18%] bottom-[20%]" style={{ width: 2.5, height: 2.5, borderRadius: 9999, background: palette.inner, boxShadow: `0 0 6px ${palette.mid}`, animation: "slot-ember 1.4s ease-out infinite" }} />
      <span className="absolute left-[52%] bottom-[15%]" style={{ width: 2, height: 2, borderRadius: 9999, background: palette.mid, boxShadow: `0 0 5px ${palette.outer}`, animation: "slot-ember 1.6s ease-out 0.35s infinite" }} />
      <span className="absolute right-[20%] bottom-[22%]" style={{ width: 2.5, height: 2.5, borderRadius: 9999, background: palette.inner, boxShadow: `0 0 6px ${palette.mid}`, animation: "slot-ember 1.3s ease-out 0.2s infinite" }} />
    </div>
  );
}

function FireOrnament() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20"
      style={{ animation: "slot-fire-flicker 280ms ease-in-out infinite alternate" }}
    >
      {/* Marco de brasas en las esquinas */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="fireFrame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd86b" />
            <stop offset="45%" stopColor="#ff7a1a" />
            <stop offset="100%" stopColor="#c11d00" />
          </linearGradient>
        </defs>
        {/* Esquinas en L ardientes */}
        <path d="M2,18 L2,2 L18,2" fill="none" stroke="url(#fireFrame)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M98,18 L98,2 L82,2" fill="none" stroke="url(#fireFrame)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M2,82 L2,98 L18,98" fill="none" stroke="url(#fireFrame)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M98,82 L98,98 L82,98" fill="none" stroke="url(#fireFrame)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function MegaOrnament() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {/* Rayos rotando */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        style={{ animation: "slot-mega-rays 6s linear infinite", opacity: 0.55 }}
      >
        <defs>
          <radialGradient id="rayGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7c2" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#ffd84a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffd84a" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 12 }).map((_, i) => (
          <polygon
            key={i}
            points="50,50 48,5 52,5"
            fill="url(#rayGrad)"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
      </svg>
      {/* Marco ornamentado dorado */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="goldFrame" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff3a8" />
            <stop offset="40%" stopColor="#f5c542" />
            <stop offset="70%" stopColor="#b8860b" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
        </defs>
        {/* esquinas barrocas */}
        {[
          { d: "M2,16 L2,2 L16,2", tx: 0, ty: 0 },
          { d: "M98,16 L98,2 L84,2", tx: 0, ty: 0 },
          { d: "M2,84 L2,98 L16,98", tx: 0, ty: 0 },
          { d: "M98,84 L98,98 L84,98", tx: 0, ty: 0 },
        ].map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke="url(#goldFrame)" strokeWidth="3" strokeLinecap="round" />
        ))}
        {/* florones diamante en cada esquina */}
        {[
          [8, 8], [92, 8], [8, 92], [92, 92],
        ].map(([cx, cy], i) => (
          <g key={i} transform={`translate(${cx} ${cy}) rotate(45)`}>
            <rect x="-2.2" y="-2.2" width="4.4" height="4.4" fill="url(#goldFrame)" stroke="#7a4a00" strokeWidth="0.4" />
          </g>
        ))}
      </svg>
    </div>
  );
}

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
  // Smoothly animated value used in the UI so wins "count up" instead of
  // appearing instantly — mimics real casino slots.
  const [displayedWin, setDisplayedWin] = useState(0);
  const [totalWonRound, setTotalWonRound] = useState(0);
  const [highlightTick, setHighlightTick] = useState(0); // rotates which win is highlighted

  const [history, setHistory] = useState<HistoryItem[]>(() => seedHistory());
  const [now, setNow] = useState(() => Date.now());
  const historyId = useRef(1000);

  useEffect(() => { setAudioMuted(muted); }, [muted]);

  // Música de fondo — jazz suave temática mafia/imperio. Se inicia tras
  // el primer gesto del usuario (requisito de los navegadores) y respeta
  // el botón de mute del HUD.
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio(mafiaJazzUrl);
    audio.loop = true;
    audio.volume = 0.05;
    bgAudioRef.current = audio;
    const onFirst = () => {
      audio.play().catch(() => {});
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst);
    window.addEventListener("keydown", onFirst);
    // Pausar al minimizar la app o cambiar de pestaña.
    const onVis = () => {
      if (document.hidden) {
        audio.pause();
      } else if (!isMuted()) {
        audio.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", () => audio.pause());
    window.addEventListener("blur", () => audio.pause());
    window.addEventListener("focus", () => {
      if (!isMuted() && !document.hidden) audio.play().catch(() => {});
    });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
      document.removeEventListener("visibilitychange", onVis);
      audio.pause();
      bgAudioRef.current = null;
    };
  }, []);
  useEffect(() => {
    const audio = bgAudioRef.current;
    if (!audio) return;
    audio.muted = muted;
    if (muted) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [muted]);
  // Pre-decode todas las imágenes de símbolos al montar para evitar
  // "icono fantasma" durante el primer giro en iOS/Android. Una vez
  // decodificadas, Safari las mantiene en la caché de texturas GPU.
  useEffect(() => {
    SYMBOLS.forEach((s) => {
      const img = new Image();
      img.src = s.img;
      if ("decode" in img) {
        img.decode().catch(() => { /* ignore */ });
      }
    });
  }, []);
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
    setDisplayedWin(0);
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
      const bestPayout = Math.max(...w.map((x) => x.payout));
      const tier = getWinTier(bestPayout, bet);
      if (tier === "mega") playMegaWinSound();
      else if (tier === "fire") playFireWinSound();
      else playCashoutSound();
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

  // Count-up animation for the win amount (with coin cascade sound).
  useEffect(() => {
    if (lastWin <= 0) {
      setDisplayedWin(0);
      return;
    }
    // Duration scales gently with the size of the win, capped so it never drags.
    const duration = Math.min(1400, Math.max(500, 350 + Math.log10(lastWin + 1) * 220));
    playCoinsSound(duration);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic for a quick start that settles softly
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedWin(Math.round(lastWin * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplayedWin(lastWin);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lastWin]);

  // Compute which cells are currently highlighted
  const activeWin = wins.length > 0 ? wins[highlightTick % wins.length] : null;
  const activeTier: WinTier = activeWin ? getWinTier(activeWin.payout, bet) : "normal";
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
    <div
      className="relative min-h-screen text-white"
      style={{
        backgroundColor: "#060210",
        backgroundImage: `url(${pageBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
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
              <div className="font-display text-[11px] font-bold sm:text-xs text-white">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </header>

        {/* Online + mute */}
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

        {/* HUD (matches reference) */}
        <section className="mt-2 grid grid-cols-4 gap-1.5 rounded-2xl glass-panel p-1.5 sm:p-2">
          <HudCell label="LÍNEAS" value={String(LINES)} />
          <HudCell label="PREMIO TOTAL" value={lastWin > 0 ? `${formatCOP(displayedWin)} COP` : "—"} accent="green" wide />
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
              {LINES} LÍNEAS · 2 VÍAS
            </span>
          </div>
          <div className="pointer-events-none absolute right-0 top-1/2 z-30 translate-x-1/2 -translate-y-1/2 rotate-90">
            <span className="font-display text-[9px] font-bold tracking-[0.32em] neon-green whitespace-nowrap">
              {LINES} LÍNEAS · 2 VÍAS
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
                  winTier={activeTier}
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
                ¡Ganaste! <span className="neon-green ml-1">${formatCOP(displayedWin)}</span>
              </span>
            </div>
          )}
        </section>

        {/* Pay table preview — horizontal scroll carousel */}
        <section className="mt-4 -mx-3 px-3 overflow-x-auto hide-scrollbar">
          <div className="flex gap-1.5 w-max">
            {SYMBOLS.map((s) => (
              <div
                key={s.id}
                className="flex flex-col items-center rounded-lg border border-purple-500/25 bg-[#0c0620]/70 px-1.5 py-1.5 shrink-0"
              >
                <div className="flex items-center">
                  <img
                    src={s.img}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-11 w-11 object-contain"
                    style={{
                      filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.7)) drop-shadow(0 0 6px rgba(${s.glow},0.55))`,
                    }}
                  />
                  <span
                    className="-ml-1 font-display text-[11px] font-bold leading-none text-emerald-300"
                    style={{ textShadow: "0 0 6px rgba(46,255,161,0.7), 0 1px 2px rgba(0,0,0,0.8)" }}
                  >
                    x5
                  </span>
                </div>
                <span className="mt-1 font-display text-[11px] font-bold neon-green leading-none">{s.pay[2]}.00x</span>
              </div>
            ))}
          </div>
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
                >X2</button>
                {QUICK_BETS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setBet((b) => Math.min(MAX_BET, b + q))}
                    disabled={spinning}
                    className="rounded-md btn-bet py-1 text-[10px] font-bold disabled:opacity-40"
                  >+{q >= 1000 ? `${q / 1000}K` : q}</button>
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
                <span className={`${spinning ? "text-sm tracking-[0.1em]" : "text-xl tracking-[0.15em]"} whitespace-nowrap leading-none`}>
                  {spinning ? "GIRANDO…" : "GIRAR"}
                </span>
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