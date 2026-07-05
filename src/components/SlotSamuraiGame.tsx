import { AuthControl } from "@/components/auth/AuthControl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { FitText } from "@/components/ui/fit-text";
import { BetAmount } from "@/components/games/BetAmount";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { spinSlotSamurai, type SamuraiSpinResult } from "@/lib/games/slot-samurai.functions";
import { useMe } from "@/hooks/useMe";
import { useOnlineCount } from "@/hooks/useOnlineCount";
import { useAuth } from "@/hooks/useAuth";
import { toFriendlyError } from "@/lib/friendly-error";
import { AuthDialog } from "@/components/auth/AuthDialog";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { Settings, Volume2, VolumeX, Minus, Plus, TrendingUp, Trophy } from "lucide-react";
import { setMuted as setAudioMuted, playCashoutSound, playCoinsSound, isMuted, setBackgroundTrack, clearBackgroundTrack, getBackgroundTrack, stopAllGameAudio, getCtx, getMasterGain, AUDIO_STOP_ALL_EVENT } from "@/lib/gameAudio";
import mafiaJazzUrl from "@/assets/mafia-jazz.mp3";
import samuraiBgAsset from "@/assets/samurai/samurai-bg.webp.asset.json";
import samuraiLegendLogoAsset from "@/assets/samurai/samurai-legend-logo.webp.asset.json";
const samuraiBg = samuraiBgAsset.url;
const samuraiLegendLogo = samuraiLegendLogoAsset.url;
import winWinAsset from "@/assets/samurai/win-win.webp.asset.json";
import winBigAsset from "@/assets/samurai/win-big.webp.asset.json";
import winMegaAsset from "@/assets/samurai/win-mega.webp.asset.json";
import winSuperAsset from "@/assets/samurai/win-super.webp.asset.json";
const WIN_LOGOS: Record<"win" | "big" | "mega" | "super" | "jackpot", string> = {
  win: winWinAsset.url,
  big: winBigAsset.url,
  mega: winMegaAsset.url,
  super: winSuperAsset.url,
  jackpot: winSuperAsset.url,
};

import bossAsset from "@/assets/samurai/sym-boss.png.asset.json";
import carAsset from "@/assets/samurai/sym-car.png.asset.json";
import briefAsset from "@/assets/samurai/sym-brief.png.asset.json";
import goldAsset from "@/assets/samurai/sym-gold.png.asset.json";
import watchAsset from "@/assets/samurai/sym-watch.png.asset.json";
import chipAsset from "@/assets/samurai/sym-chip.png.asset.json";
import hatAsset from "@/assets/samurai/sym-hat.png.asset.json";
import cardAsset from "@/assets/samurai/sym-card.png.asset.json";

import bonusMegaAsset from "@/assets/audio/slot-win/bonus-1.mp3.asset.json";
import bonusBigAsset from "@/assets/audio/slot-win/bonus-2.mp3.asset.json";
import bonusNiceAsset from "@/assets/audio/slot-win/bonus-3.mp3.asset.json";
import { GameMenuDrawer } from "@/components/GameMenuDrawer";

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
  { id: "boss",  img: bossAsset.url,  label: "KABUTO",       pay: [55, 240, 1100], weight: 2,  glow: "236,72,153"  },
  { id: "car",   img: carAsset.url,   label: "DRAGÓN",       pay: [34, 130, 440],  weight: 3,  glow: "168,85,247"  },
  { id: "brief", img: briefAsset.url, label: "GEISHA",       pay: [24, 72, 240],   weight: 4,  glow: "244,63,94"   },
  { id: "gold",  img: goldAsset.url,  label: "KANJI 侍",      pay: [19, 50, 165],   weight: 5,  glow: "255,180,40"  },
  { id: "watch", img: watchAsset.url, label: "KATANA",       pay: [13, 32, 95],    weight: 6,  glow: "255,80,80"   },
  { id: "chip",  img: chipAsset.url,  label: "A",            pay: [10, 24, 68],    weight: 8,  glow: "255,140,60"  },
  { id: "hat",   img: hatAsset.url,   label: "K",            pay: [8, 18, 50],     weight: 10, glow: "255,120,80"  },
  { id: "card",  img: cardAsset.url,  label: "Q",            pay: [7, 14, 32],     weight: 12, glow: "200,80,220"  },
];

const SYMBOL_INDEX = new Map(SYMBOLS.map((s, i) => [s.id, i]));

/* Win tiers — visual + sonoro según qué tan grande es la victoria de cada línea */
export type WinTier = "normal" | "nice" | "fire" | "mega";
function getWinTier(payout: number, totalBet: number): WinTier {
  if (totalBet <= 0) return "normal";
  const mult = payout / totalBet;
  if (mult >= 20) return "mega";
  if (mult >= 4.5) return "fire";
  if (mult >= 1.3) return "nice";
  return "normal";
}

/* Colores de marco por tier (rgb sin alpha para inyectar en gradients) */
const TIER_GLOW: Record<WinTier, string> = {
  normal: "46,255,161", // verde neón (el actual)
  nice:   "120,200,255", // cian suave para "nice win"
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
const ROWS = 3;

/* 20 paylines on 5x3 grid — mirror of SAMURAI_PAYLINES in slot-samurai.shared.ts */
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 1, 2, 2, 2],
  [2, 1, 0, 0, 0],
  [1, 0, 2, 0, 1],
];

const MIN_BET = 500;
const MAX_BET = 50000;
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
function ctx() {
  return getCtx();
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
  const dest = getMasterGain() || c.destination;
  o.connect(g).connect(dest);
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
  const dest = getMasterGain() || c.destination;
  src.connect(bp).connect(g).connect(dest);
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
    const dest = getMasterGain() || cc.destination;
    o.connect(og).connect(dest);
    o.start(t); o.stop(t + 0.05);
  };
  const tickTimer = window.setInterval(tick, 70);
  reelLoopNodes = { whirSrc: src, whirGain: g, tickTimer };
}

function stopReelLoop() {
  const c = getCtx();
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
    const dest = getMasterGain() || c.destination;
  o.connect(g).connect(dest);
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
    const dest = getMasterGain() || c.destination;
  o.connect(g).connect(dest);
    o.start(t0 + 0.1 + i * 0.07); o.stop(t0 + 0.1 + i * 0.07 + 0.4);
  });
}

/* ============================================================
   Reel component — continuous translateY strip (no flicker)
   ============================================================ */
// 3 filas visibles → tiles más grandes aprovechando la fila menos.
const TILE_H = 78;
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
  // Latest finalSyms (kept in a ref so finishSpin reads the most recent value,
  // even when the server result arrived after the spin animation started).
  const finalSymsRef = useRef<string[]>(finalSyms);
  useEffect(() => { finalSymsRef.current = finalSyms; }, [finalSyms]);

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
      const latest = finalSymsRef.current;
      setStrip(latest);
      displayedRef.current = latest;
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

  // If the server result arrives AFTER the spin animation has already started,
  // patch the bottom `ROWS` tiles of the strip so the reel lands on the
  // correct (server-decided) symbols. Without this, starting the reels
  // optimistically (before awaiting the server) would land on whatever
  // placeholder symbols we started with.
  useEffect(() => {
    if (!spinning) return;
    setStrip((prev) => {
      if (prev.length < ROWS) return prev;
      const head = prev.slice(0, prev.length - ROWS);
      // already correct → no state update
      let same = true;
      for (let i = 0; i < ROWS; i++) {
        if (prev[prev.length - ROWS + i] !== finalSyms[i]) { same = false; break; }
      }
      if (same) return prev;
      return [...head, ...finalSyms];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalSyms]);

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
  const scale = (sym.id === "hat" ? 1.2 : sym.id === "boss" ? 1.14 : 1) * 1.12;
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
  const showGreenAura = highlight && (tier === "normal" || tier === "nice");
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
          width: "104%",
          height: "104%",
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

export function SlotSamuraiGame() {
  const { user } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();
  const callSpin = useServerFn(spinSlotSamurai);
  const isAuthed = !!user;
  // Source of truth = backend. If it hasn't loaded yet, never pretend the
  // user has 0 because that looks like lost money.
  const realBalance = me.data?.balance ?? 0;
  const bonusBalance = me.data?.bonus_balance ?? 0;
  const balance = realBalance + bonusBalance;
  const balanceReady = !!me.data;
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  // Holds the official outcome returned by the server until the visual
  // animation finishes. Reading it inside the "all reels stopped" effect
  // lets us paint wins exactly as the backend decided.
  const pendingResultRef = useRef<SamuraiSpinResult | null>(null);
  // Bumped whenever a server result lands. Included in the settle effect's
  // deps so it re-runs if the network was slower than the spin animation.
  const [resultTick, setResultTick] = useState(0);
  // Prevents a second spin from racing while the previous round is
  // in-flight (network + reel animation).
  const inFlightRef = useRef(false);
  const [bet, setBet] = useState(2000);
  const [muted, setMuted] = useState<boolean>(() => (typeof window === "undefined" ? false : isMuted()));
  const online = useOnlineCount();

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

  // Sonidos por umbral de premio (HTMLAudio precargado, controlado y silenciable).
  const winSampleRef = useRef<HTMLAudioElement | null>(null);
  const stopWinSample = useCallback(() => {
    const a = winSampleRef.current;
    if (!a) return;
    try { a.pause(); a.currentTime = 0; } catch {}
  }, []);
  const playWinSample = useCallback((url: string, volume: number) => {
    if (isMuted()) return;
    if (typeof window === "undefined") return;
    stopWinSample();
    const audio = new Audio(url);
    audio.volume = volume;
    winSampleRef.current = audio;
    audio.play().catch(() => {});
  }, [stopWinSample]);
  useEffect(() => {
    const onHide = () => stopWinSample();
    const onStopAll = () => stopWinSample();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("blur", onHide);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("blur", onHide);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
      stopWinSample();
    };
  }, [stopWinSample]);
  useEffect(() => { if (muted) stopWinSample(); }, [muted, stopWinSample]);

  // Música de fondo — jazz suave temática mafia/imperio. Se inicia tras
  // el primer gesto del usuario (requisito de los navegadores) y respeta
  // el botón de mute del HUD.
  useEffect(() => {
    // Garantiza que ningún audio de un juego previo siga vivo.
    stopAllGameAudio();
    const onStopAll = () => stopReelLoop();
    const stopOnBackground = () => {
      clearBackgroundTrack();
      stopReelLoop();
    };
    window.addEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
    window.addEventListener("pagehide", stopOnBackground);
    window.addEventListener("blur", stopOnBackground);
    document.addEventListener("visibilitychange", stopOnBackground);
    const audio = setBackgroundTrack(mafiaJazzUrl, { volume: 0.009, loop: true });
    if (!audio) return;
    const onFirst = () => {
      audio.play().catch(() => {});
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst);
    window.addEventListener("keydown", onFirst);
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
      window.removeEventListener("pagehide", stopOnBackground);
      window.removeEventListener("blur", stopOnBackground);
      document.removeEventListener("visibilitychange", stopOnBackground);
      clearBackgroundTrack();
      stopReelLoop();
      window.removeEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
    };
  }, []);
  useEffect(() => {
    const audio = getBackgroundTrack();
    if (!audio) return;
    audio.muted = muted;
    if (muted) audio.pause();
    else audio.play().catch(() => {});
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
  useVisibleInterval(() => setNow(Date.now()), 1000);
  // Fake other players' history
  useVisibleInterval(() => {
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

  const spin = useCallback(async () => {
    if (spinning || inFlightRef.current) return;
    if (!isAuthed) {
      setAuthDialogOpen(true);
      return;
    }
    if (bet < MIN_BET || bet > balance) return;
    inFlightRef.current = true;
    setSpinError(null);
    const clientActionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
    // 1) Kick the reels off IMMEDIATELY so the click feels instant. The
    //    reels spin on a placeholder grid; when the server result lands
    //    (almost always before the animation ends), we swap the target
    //    symbols in-place via the finalSyms patch effect inside <Reel/>.
    pendingResultRef.current = null;
    queryClient.setQueryData(
      ["me", user?.id ?? null],
      (old: { balance: number; bonus_balance: number; profile: unknown } | null | undefined) =>
        old ? { ...old, balance: Math.max(0, Number(old.balance) - bet) } : old,
    );
    startReelLoop();
    setLastWin(0);
    setDisplayedWin(0);
    setTotalWonRound(0);
    setWins([]);
    setReelsStopped(0);
    setSpinning(true);

    // 2) Server call runs in parallel with the reel animation.
    try {
      const result = await callSpin({
        data: { bet_amount: bet, client_action_id: clientActionId },
      });
      pendingResultRef.current = result;
      setGrid(result.grid);
      setResultTick((n) => n + 1);
    } catch (e) {
      setSpinError(toFriendlyError(e, "No se pudo girar."));
      setAutoSpin(false);
      // Revert: abort the visual spin and resync balance with the server.
      pendingResultRef.current = null;
      setSpinning(false);
      setReelsStopped(0);
      stopReelLoop();
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } finally {
      inFlightRef.current = false;
    }
  }, [spinning, bet, balance, isAuthed, callSpin, queryClient, user?.id]);

  // Triggered when last reel reports stop
  const handleReelStop = useCallback(() => {
    setReelsStopped((n) => n + 1);
  }, []);

  // When all reels stopped → apply the server-decided outcome.
  useEffect(() => {
    if (!spinning || reelsStopped < REELS) return;
    // If the network was slower than the spin animation, wait for the server
    // response before finalising. The effect will re-run when pendingResultRef
    // gets set via setGrid → no extra state needed because setGrid changes
    // `grid`, which is already part of the render cycle.
    if (!pendingResultRef.current) return;
    stopReelLoop();
    const result = pendingResultRef.current;
    pendingResultRef.current = null;
    const w: WinLine[] = (result?.wins ?? []) as WinLine[];
    const total = result?.total ?? 0;
    setWins(w);
    setLastWin(total);
    setTotalWonRound(total);
    // Always refresh balance after the reels settle — applies for losses too,
    // so the HUD shows the bet debit even when there is no win.
    queryClient.invalidateQueries({ queryKey: ["me"] });
    if (total > 0) {
      // El tier se calcula sobre el multiplicador TOTAL del giro (lo que el
      // jugador ve en la HUD), no sobre la mejor línea, para que los sonidos
      // coincidan con la magnitud percibida del premio.
      const tier = getWinTier(total, bet);
      if (tier === "mega") playWinSample(bonusMegaAsset.url, 0.3);
      else if (tier === "fire") playWinSample(bonusBigAsset.url, 0.27);
      else if (tier === "nice") playWinSample(bonusNiceAsset.url, 0.24);
      else playCashoutSound();
      const best = [...w].sort((a, b) => b.payout - a.payout)[0];
      setHistory((h) =>
        [{ id: ++historyId.current, user: "Tú", symbolId: best.symbolId, multiplier: total / bet, amount: total, ts: Date.now() }, ...h].slice(0, 30)
      );
    }
    setSpinning(false);
    setReelsStopped(0);
  }, [reelsStopped, spinning, bet, queryClient, resultTick, playWinSample]);

  // Auto-spin: re-trigger spin after each round when enabled
  useEffect(() => {
    if (!autoSpin || spinning) return;
    if (!isAuthed || bet < MIN_BET || bet > balance) {
      setAutoSpin(false);
      return;
    }
    const t = setTimeout(() => spin(), 900);
    return () => clearTimeout(t);
  }, [autoSpin, spinning, bet, balance, spin, isAuthed]);

  // Cycle through wins to highlight one at a time
  useVisibleInterval(
    () => setHighlightTick((x) => x + 1),
    wins.length === 0 ? null : 1100,
  );

  // Count-up animation for the win amount (with coin cascade sound).
  useEffect(() => {
    if (lastWin <= 0) {
      setDisplayedWin(0);
      return;
    }
    // Duration scales gently with the size of the win, capped so it never drags.
    const duration = Math.min(900, Math.max(280, 200 + Math.log10(lastWin + 1) * 140));
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

  // When the user is not authed, the button is still clickable: clicking
  // opens the auth dialog. When authed, we apply the normal balance gate.
  const canSpin =
    !spinning &&
    bet >= MIN_BET &&
    (!isAuthed || (balanceReady && bet <= balance));
  const winMult = lastWin > 0 ? lastWin / bet : 1;

  return (
    <div
      className="relative h-[100dvh] overflow-hidden text-white"
      style={{
        backgroundColor: "#0a0416",
        backgroundImage: `linear-gradient(180deg, rgba(10,4,22,0.15) 0%, rgba(10,4,22,0.35) 45%, rgba(10,4,22,0.75) 100%), url(${samuraiBg})`,
        backgroundSize: "cover, cover",
        backgroundPosition: "center top, center top",
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundAttachment: "fixed, fixed",
      }}
    >
      <div className="relative mx-auto flex h-full max-w-md flex-col px-2.5 pb-1.5 pt-3 sm:max-w-lg sm:px-4">
        {/* Header */}
        <header
          className="flex items-center justify-between bg-[#060210]/80 backdrop-blur-sm border-b border-purple-500/20 pb-2 px-3 -mx-3 -mt-3"
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
                <span className="neon-green mr-0.5">$</span>{balanceReady ? formatCOP(balance) : "—"} COP
              </div>
            </div>
            <AuthControl />
          </div>
        </header>

        {/* Online + mute */}
        <div className="mt-1 flex items-center justify-between">
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

        {/* Logo + evento — integrados sobre el fondo global, sin card */}
        <SamuraiHero
          lastWin={lastWin}
          displayedWin={displayedWin}
          bet={bet}
          spinning={spinning}
        />

        {/* Reels frame wrapper — labels sit on the neon border edge */}
        <section className="relative mt-1">
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
              className="relative p-1.5 sm:p-2"
              style={{
                clipPath:
                  "polygon(15px 0, calc(100% - 15px) 0, 100% 15px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 15px 100%, 0 calc(100% - 15px), 0 15px)",
                background: "#0a041c",
              }}
            >
          <div className="relative pt-0.5">
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

        </section>

        {/* Pay table preview — horizontal scroll carousel */}
        <section className="mt-1.5 -mx-2.5 px-2.5 overflow-x-auto hide-scrollbar">
          <div className="flex gap-1.5 w-max">
            {SYMBOLS.map((s) => (
              <div
                key={s.id}
                className="flex flex-col items-center rounded-lg border border-purple-500/25 bg-[#0c0620]/70 px-1.5 py-1 shrink-0"
              >
                <div className="flex items-center">
                  <img
                    src={s.img}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-9 w-9 object-contain"
                    style={{
                      filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.7)) drop-shadow(0 0 6px rgba(${s.glow},0.55))`,
                    }}
                  />
                  <span
                    className="-ml-1 font-display text-[10px] font-bold leading-none text-emerald-300"
                    style={{ textShadow: "0 0 6px rgba(46,255,161,0.7), 0 1px 2px rgba(0,0,0,0.8)" }}
                  >
                    x5
                  </span>
                </div>
                <span className="mt-0.5 font-display text-[10px] font-bold neon-green leading-none">{s.pay[2]}.00x</span>
              </div>
            ))}
          </div>
        </section>

        {/* Bet panel */}
        <section className="mt-1.5 rounded-2xl glass-panel p-2">
          <div className="flex gap-2">
            {/* Left: bet controls */}
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-widest text-purple-200/70 text-center">APUESTA (COP)</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <button
                  onClick={() => setBet((b) => Math.max(MIN_BET, b - BET_STEP))}
                  disabled={spinning}
                  className="flex h-9 w-10 items-center justify-center rounded-xl btn-bet disabled:opacity-40"
                ><Minus className="h-5 w-5" /></button>
                <div className="flex h-9 min-w-0 flex-1 items-center rounded-xl border border-purple-500/40 bg-[#0c0620] px-2 font-display text-base font-bold tabular-nums text-white">
                  <BetAmount
                    bet={bet}
                    bonusBalance={bonusBalance}
                    className="flex h-full min-h-0 w-full flex-col justify-center py-0.5"
                    amountClassName="w-full pt-0.5 tabular-nums"
                    bonusClassName="mt-px text-center text-[6px] font-bold leading-none text-yellow-300/95"
                    minScale={0.38}
                  />
                </div>
                <button
                  onClick={() => setBet((b) => Math.min(MAX_BET, b + BET_STEP))}
                  disabled={spinning}
                  className="flex h-9 w-10 items-center justify-center rounded-xl btn-bet disabled:opacity-40"
                ><Plus className="h-5 w-5" /></button>
              </div>
              <div className="mt-1 grid grid-cols-5 gap-1">
                <button
                  onClick={() => setBet((b) => Math.min(MAX_BET, Math.max(MIN_BET, b * 2)))}
                  disabled={spinning}
                  className="rounded-md btn-bet py-0.5 text-[10px] font-bold disabled:opacity-40"
                >X2</button>
                {QUICK_BETS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setBet((b) => Math.min(MAX_BET, b + q))}
                    disabled={spinning}
                    className="rounded-md btn-bet py-0.5 text-[10px] font-bold disabled:opacity-40"
                  >+{q >= 1000 ? `${q / 1000}K` : q}</button>
                ))}
              </div>
            </div>

            {/* Right: GIRAR + AUTO */}
            <div className="flex w-[42%] flex-col gap-1" style={{ minHeight: 82 }}>
              <button
                onClick={spin}
                disabled={!canSpin}
                className="flex-1 rounded-2xl btn-primary-green btn-primary-action flex items-center justify-center font-display font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`${spinning ? "text-xs tracking-[0.1em]" : "text-lg tracking-[0.15em]"} whitespace-nowrap leading-none`}>
                  {spinning ? "GIRANDO…" : "GIRAR"}
                </span>
              </button>
              <button
                onClick={() => setAutoSpin((a) => !a)}
                disabled={bet < MIN_BET || bet > balance}
                aria-pressed={autoSpin}
                className={`h-8 rounded-xl font-display font-black uppercase tracking-[0.2em] text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed border ${
                  autoSpin
                    ? "bg-gradient-to-b from-amber-300 to-amber-500 text-[#1a0a02] border-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
                    : "bg-[#1a0f33] text-purple-100 border-purple-500/50 hover:border-purple-400 hover:bg-[#221347] shadow-[0_0_10px_rgba(168,85,247,0.25)]"
                }`}
              >
                {autoSpin ? "AUTO ON" : "AUTO"}
              </button>
            </div>
          </div>
          <div className="mt-1 text-center text-[9px] leading-none text-purple-200/60">
            MÍNIMO: {formatCOP(MIN_BET)} COP · MÁXIMO: {formatCOP(MAX_BET)} COP
          </div>
        </section>

        {/* Last wins ticker */}
        <section className="mt-1.5 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 p-1.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-300" />
            <h3 className="font-display text-[10px] font-bold uppercase tracking-widest text-white">Últimas ganancias</h3>
            <Trophy className="ml-auto h-4 w-4 text-purple-300/70" />
          </div>
          <ul className="mt-1.5 flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
            {history.slice(0, 8).map((w) => {
              const sym = SYMBOLS[SYMBOL_INDEX.get(w.symbolId)!];
              return (
                <li
                  key={w.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-[#08221a]/70 px-2 py-0.5"
                  style={{ boxShadow: "0 0 10px rgba(46,255,161,0.18) inset" }}
                >
                   <img src={sym.img} alt="" aria-hidden loading="lazy" className="h-4 w-4 object-contain"
                       style={{ filter: `drop-shadow(0 0 4px rgba(${sym.glow},0.5))` }} />
                  <div className="leading-tight">
                    <div className="font-display text-[10px] font-bold neon-green">{w.multiplier.toFixed(2)}x</div>
                    <div className="text-[8px] font-semibold text-purple-100/80">{formatCOP(w.amount)} COP</div>
                  </div>
                   <span className="text-[7px] uppercase tracking-wider text-purple-300/60 ml-0.5">
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
      {spinError && (
        <div
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg border border-red-400/60 bg-red-950/95 px-4 py-2 text-sm font-semibold text-red-100 shadow-xl"
          role="alert"
          onClick={() => setSpinError(null)}
        >
          {spinError}
        </div>
      )}
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
}

/* ============================================================
   Samurai banner — reemplaza el HUD superior clásico.
   Muestra la identidad del juego + overlays de eventos.
   Umbrales (múltiplo de la apuesta) inspirados en la clasificación
   estándar de la industria; ajustables en un futuro sin tocar
   el resto del juego.
   ============================================================ */
type SamuraiEventTier = "idle" | "win" | "big" | "mega" | "super" | "jackpot";
function classifySamuraiEvent(total: number, bet: number): SamuraiEventTier {
  if (total <= 0 || bet <= 0) return "idle";
  const m = total / bet;
  if (m >= 100) return "jackpot";
  if (m >= 50)  return "super";
  if (m >= 20)  return "mega";
  if (m >= 8)   return "big";
  return "win";
}
const EVENT_LABEL: Record<SamuraiEventTier, string> = {
  idle: "",
  win: "WIN",
  big: "BIG WIN",
  mega: "MEGA WIN",
  super: "SUPER WIN",
  jackpot: "JACKPOT",
};

function SamuraiHero({
  lastWin,
  displayedWin,
  bet,
  spinning,
}: {
  lastWin: number;
  displayedWin: number;
  bet: number;
  spinning: boolean;
}) {
  const tier = spinning ? "idle" : classifySamuraiEvent(lastWin, bet);
  const showEvent = tier !== "idle" && lastWin > 0;
  return (
    <section
      className="relative mt-0 flex flex-col items-center justify-center"
      aria-label="Samurai Legend"
    >
      {/* Logo integrado sobre el fondo global — sin card, sin borde */}
      <img
        src={samuraiLegendLogo}
        alt="Samurai Legend"
        className="h-[118px] w-auto max-w-[95%] select-none"
        style={{
          filter:
            "drop-shadow(0 6px 14px rgba(0,0,0,0.75)) drop-shadow(0 0 18px rgba(255,90,120,0.35))",
        }}
        draggable={false}
      />
      {/* Espacio reservado bajo el logo — el evento WIN aparece aquí sin empujar el layout */}
      <div
        className="mt-0 flex h-[86px] w-full flex-col items-center justify-start"
        aria-hidden={!showEvent}
      >
        {showEvent && (
          <div
            className="flex flex-col items-center"
            style={{ animation: "scale-in 0.14s cubic-bezier(0.2,0.9,0.3,1.2)" }}
          >
            <img
              src={WIN_LOGOS[tier as "win" | "big" | "mega" | "super" | "jackpot"]}
              alt={EVENT_LABEL[tier]}
              className="h-[64px] w-auto select-none"
              style={{
                filter:
                  "drop-shadow(0 3px 8px rgba(0,0,0,0.85)) drop-shadow(0 0 10px rgba(255,90,30,0.55))",
              }}
              draggable={false}
            />
            <div
              className="-mt-1 font-display text-[20px] font-black tracking-wide leading-none"
              style={{
                color: "#fef08a",
                textShadow:
                  "0 0 10px rgba(253,224,71,0.85), 0 2px 4px rgba(0,0,0,0.95)",
              }}
            >
              +{formatCOP(displayedWin)} COP
            </div>
          </div>
        )}
      </div>
    </section>
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