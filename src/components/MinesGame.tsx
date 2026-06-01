import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { Link } from "@tanstack/react-router";
import { Menu, Settings, Minus, Plus, Volume2, VolumeX, ChevronDown, Bomb, Gem, TrendingUp, User } from "lucide-react";
import { setMuted as setAudioMuted, playCrashSound, playCashoutSound, isMuted, stopAllGameAudio, AUDIO_STOP_ALL_EVENT } from "@/lib/gameAudio";
import coinRevealSfx from "@/assets/sfx/coin-reveal.mp3";
import victorySfx from "@/assets/sfx/victory.mp3";
import gameOverSfx from "@/assets/sfx/game-over.mp3";
import minesBg from "@/assets/mines-page-bg.png";

type Phase = "betting" | "playing" | "lost" | "cashed";

const TILES = 16;
const RTP_BASE = 0.907;
// Las variantes de bajo riesgo (≤3 minas) son las más explotables:
// aplicamos una penalización extra para equilibrar la ganancia temprana.
const RTP_LOW_RISK = 0.887; // mines ≤ 3
function rtpFor(mines: number) {
  // Coeficientes por nº de minas (calibrados para la primera revelación):
  //  1 mina  → 0.95x  (castigo en la primera, obliga a seguir)
  //  2 minas → 1.00x  (mínimo justo)
  //  3 minas → 1.15x  (RTP > 100%, casa en pérdida estadística leve)
  //  4+      → RTP_BASE (0.907)
  if (mines <= 1) return 0.887625; // 0.887625 * 16/15 ≈ 0.95x
  if (mines === 2) return 0.917;
  if (mines === 3) return 0.934375; // 0.934375 * 16/13 = 1.15x primera revelación
  return RTP_BASE;
}
const MIN_MINES = 1;
const MAX_MINES = 15;

const MIN_BET = 500;
const MAX_BET = 100000;
const BET_STEP = 500;
const QUICK_ADDS = [1000, 2000, 5000, 10000];

// Preloaded pool for the reveal SFX — allows rapid overlapping playback.
const REVEAL_POOL_SIZE = 4;
let revealPool: HTMLAudioElement[] | null = null;
let revealIdx = 0;
let revealStreak = 0;
function ensureRevealPool() {
  if (typeof window === "undefined") return;
  if (revealPool) return;
  revealPool = Array.from({ length: REVEAL_POOL_SIZE }, () => {
    const a = new Audio(coinRevealSfx);
    a.preload = "auto";
    a.volume = 0.20;
    return a;
  });
}
function playReveal() {
  if (isMuted()) return;
  ensureRevealPool();
  if (!revealPool) return;
  const a = revealPool[revealIdx % REVEAL_POOL_SIZE];
  revealIdx++;
  try {
    a.currentTime = 0;
    // Slight pitch-like change via playbackRate, escalates with streak for retention
    a.playbackRate = Math.min(1.6, 1.25 + revealStreak * 0.03);
    revealStreak++;
    void a.play();
  } catch {}
}
function resetRevealStreak() { revealStreak = 0; }

let victoryAudio: HTMLAudioElement | null = null;
let gameOverAudio: HTMLAudioElement | null = null;

function stopAllMinesSfx() {
  if (revealPool) {
    revealPool.forEach((a) => {
      try { a.pause(); a.currentTime = 0; } catch {}
    });
  }
  revealStreak = 0;
  if (victoryAudio) { try { victoryAudio.pause(); victoryAudio.currentTime = 0; } catch {} }
  if (gameOverAudio) { try { gameOverAudio.pause(); gameOverAudio.currentTime = 0; } catch {} }
}

if (typeof window !== "undefined") {
  window.addEventListener(AUDIO_STOP_ALL_EVENT, stopAllMinesSfx);
}
function playVictory() {
  if (isMuted() || typeof window === "undefined") return;
  if (!victoryAudio) { victoryAudio = new Audio(victorySfx); victoryAudio.volume = 0.7; }
  try { victoryAudio.currentTime = 0; void victoryAudio.play(); } catch {}
}
function playGameOver() {
  if (isMuted() || typeof window === "undefined") return;
  if (!gameOverAudio) { gameOverAudio = new Audio(gameOverSfx); gameOverAudio.volume = 0.32; }
  try { gameOverAudio.currentTime = 0; void gameOverAudio.play(); } catch {}
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

/**
 * Multiplier after `picks` safe tiles opened, with `mines` mines, RTP 97%.
 * Formula: RTP * C(N,k) / C(N-M, k)  with N = TILES, M = mines, k = picks
 * Equivalent product: RTP * prod_{i=0..k-1} (N - i) / (N - M - i)
 */
function multiplierFor(mines: number, picks: number): number {
  if (picks <= 0) return 1;
  const safeTotal = TILES - mines;
  if (picks > safeTotal) return 0;
  let m = rtpFor(mines);
  for (let i = 0; i < picks; i++) {
    m *= (TILES - i) / (safeTotal - i);
  }
  return Math.round(m * 100) / 100;
}

function nextMultiplier(mines: number, picks: number): number {
  return multiplierFor(mines, picks + 1);
}

/** secure RNG-backed shuffle to place mines */
function placeMines(mines: number): Set<number> {
  const indices = Array.from({ length: TILES }, (_, i) => i);
  const rand = (max: number) => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
  };
  for (let i = indices.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return new Set(indices.slice(0, mines));
}

type HistoryItem = {
  id: number;
  user: string;
  mines: number;
  multiplier: number;
  amount: number;
  exploded: boolean;
  ts: number;
};

const SEED_USERS = [
  "AstroNova", "GalaxyKid", "CometRider", "MoonPlayer", "NebulaQ",
  "PlasmaGirl", "StarHunter", "VoidWalker", "OrbitX", "RocketJoe",
  "MeteorMax", "LunarFox", "NovaKing", "PulsarZ", "SolarFlare",
];
function pickUser() {
  return SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)];
}
function seedHistory(): HistoryItem[] {
  let id = 1;
  const now = Date.now();
  const items: HistoryItem[] = [
    { id: id++, user: "GalaxyKid",   mines: 3, multiplier: 8.45,  amount: 152300, exploded: false, ts: now - 12_000 },
    { id: id++, user: "AstroNova",   mines: 2, multiplier: 12.72, amount: 341000, exploded: false, ts: now - 25_000 },
    { id: id++, user: "CometRider",  mines: 7, multiplier: 0,     amount: 98800,  exploded: true,  ts: now - 41_000 },
    { id: id++, user: "OrbitX",      mines: 3, multiplier: 18.90, amount: 672000, exploded: false, ts: now - 58_000 },
    { id: id++, user: "MoonPlayer",  mines: 1, multiplier: 4.21,  amount: 75500,  exploded: false, ts: now - 90_000 },
    { id: id++, user: "VoidWalker",  mines: 5, multiplier: 24.30, amount: 412500, exploded: false, ts: now - 140_000 },
  ];
  return items;
}
function relativeTime(ts: number, now: number): string {
  const s = Math.max(1, Math.floor((now - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  return `hace ${h}h`;
}

export function MinesGame() {
  const [balance, setBalance] = useState(100000);
  const [bet, setBet] = useState(2000);
  const [mines, setMines] = useState(3);
  const [minesPickerOpen, setMinesPickerOpen] = useState(false);

  const [phase, setPhase] = useState<Phase>("betting");
  const [mineSet, setMineSet] = useState<Set<number>>(() => new Set());
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [explodedTile, setExplodedTile] = useState<number | null>(null);
  const [picks, setPicks] = useState(0);

  const [muted, setMuted] = useState(false);
  const [online] = useState(263);
  const [history, setHistory] = useState<HistoryItem[]>(() => seedHistory());
  const [now, setNow] = useState(() => Date.now());
  const [shake, setShake] = useState(false);
  const historyId = useRef(1000);

  // Cierra cualquier audio de otro juego al entrar, y para SFX propios al salir.
  useEffect(() => {
    stopAllGameAudio();
    return () => { stopAllMinesSfx(); };
  }, []);

  // tick for relative times + auto fake wins
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      // One entry at a time so it visually empuja a los demás
      const exploded = Math.random() < 0.18;
      const mn = 1 + Math.floor(Math.random() * 8);
      const pk = exploded ? 0 : 1 + Math.floor(Math.random() * Math.min(6, TILES - mn));
      const mult = exploded ? 0 : multiplierFor(mn, pk);
      const stake = [500, 1000, 2000, 5000, 10000][Math.floor(Math.random() * 5)];
      const amount = exploded ? stake : Math.floor(stake * mult);
      setHistory((h) => [
        { id: ++historyId.current, user: pickUser(), mines: mn, multiplier: mult, amount, exploded, ts: Date.now() },
        ...h,
      ].slice(0, 30));
    }, 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setAudioMuted(muted); }, [muted]);

  const currentMult = useMemo(() => multiplierFor(mines, picks), [mines, picks]);
  const nextMult    = useMemo(() => nextMultiplier(mines, picks), [mines, picks]);
  const cashoutAmount = Math.floor(bet * currentMult);

  const startGame = useCallback(() => {
    if (phase !== "betting") return;
    if (bet < MIN_BET || bet > balance) return;
    setBalance((b) => b - bet);
    setMineSet(placeMines(mines));
    setRevealed(new Set());
    setPicks(0);
    setExplodedTile(null);
    resetRevealStreak();
    setPhase("playing");
  }, [phase, bet, balance, mines]);

  const cashout = useCallback(() => {
    if (phase !== "playing" || picks === 0) return;
    const win = Math.floor(bet * currentMult);
    setBalance((b) => b + win);
    playCashoutSound();
    setHistory((h) => [
      { id: ++historyId.current, user: "Tú", mines, multiplier: currentMult, amount: win, exploded: false, ts: Date.now() },
      ...h,
    ].slice(0, 20));
    setPhase("cashed");
    setTimeout(() => resetRound(), 1750);
  }, [phase, picks, bet, currentMult, mines]);

  const resetRound = useCallback(() => {
    setPhase("betting");
    setRevealed(new Set());
    setMineSet(new Set());
    setExplodedTile(null);
    setPicks(0);
  }, []);

  const handleTile = useCallback((idx: number) => {
    if (phase !== "playing") return;
    if (revealed.has(idx)) return;
    const isMine = mineSet.has(idx);
    const nextRev = new Set(revealed);
    nextRev.add(idx);
    setRevealed(nextRev);
    if (isMine) {
      playGameOver();
      setExplodedTile(idx);
      playCrashSound();
      setShake(true);
      setTimeout(() => setShake(false), 400);
      // reveal all mines
      setTimeout(() => {
        setRevealed((prev) => {
          const all = new Set(prev);
          mineSet.forEach((m) => all.add(m));
          return all;
        });
      }, 250);
      setHistory((h) => [
        { id: ++historyId.current, user: "Tú", mines, multiplier: 0, amount: bet, exploded: true, ts: Date.now() },
        ...h,
      ].slice(0, 20));
      setPhase("lost");
      setTimeout(() => resetRound(), 2400);
    } else {
      setPicks((p) => p + 1);
      playReveal();
      // auto cashout if all safes opened
      const safeOpened = nextRev.size; // includes this safe pick
      const safeTotal = TILES - mines;
      if (safeOpened >= safeTotal) {
        const mult = multiplierFor(mines, safeTotal);
        const win = Math.floor(bet * mult);
        setBalance((b) => b + win);
        playCashoutSound();
        playVictory();
        setHistory((h) => [
          { id: ++historyId.current, user: "Tú", mines, multiplier: mult, amount: win, exploded: false, ts: Date.now() },
          ...h,
        ].slice(0, 20));
        setPhase("cashed");
        setTimeout(() => resetRound(), 1800);
      }
    }
  }, [phase, revealed, mineSet, mines, bet, resetRound]);

  const canStart = phase === "betting" && bet >= MIN_BET && bet <= balance;
  const canCashout = phase === "playing" && picks > 0;
  const safeTilesTotal = Math.max(1, TILES - mines);
  const revealProgress = revealed.size / safeTilesTotal;
  const showRedOverlay = revealProgress >= 0.30 && phase === "playing";
  // Intensidad sutil: arranca en 0.6 al cruzar 30% y sube hasta 1 al 100%
  const redIntensity = showRedOverlay
    ? 0.6 + 0.4 * Math.min(1, (revealProgress - 0.3) / 0.7)
    : 0;

  return (
    <div
      className="relative min-h-screen text-white"
      style={{
        backgroundColor: "#060210",
        backgroundImage: `url(${minesBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Red tension overlay sobre el fondo de la página (multiply, tiñe lo existente) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
        style={{
          opacity: redIntensity,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(220,0,0,0.55) 0%, rgba(150,0,0,0.45) 55%, rgba(80,0,0,0.55) 100%)",
          mixBlendMode: "multiply",
        }}
      />
      {/* Capa aditiva sutil para que el rojo se perciba también en la zona oscura superior */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
        style={{
          opacity: redIntensity * 0.55,
          background:
            "linear-gradient(to bottom, rgba(60,5,5,0.85) 0%, rgba(45,4,4,0.55) 30%, rgba(30,2,2,0.25) 60%, rgba(15,0,0,0) 100%)",
          mixBlendMode: "normal",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6 pt-4 sm:max-w-lg sm:px-4">
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
              <img
                src={betspaceLogo}
                alt="BETSPACE"
                className="h-6 w-auto sm:h-7"
              />
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

        {/* Online */}
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

        {/* HUD */}
        <section className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-purple-500/30 glass-panel p-2 sm:p-2.5">
          {/* Mines selector */}
          <div className="relative">
            <div className="text-[9px] uppercase tracking-widest text-purple-200/70 text-center">Minas</div>
            <button
              type="button"
              disabled={phase !== "betting"}
              onClick={() => setMinesPickerOpen((o) => !o)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-purple-500/40 bg-[#160830]/60 py-1.5 font-display text-base font-bold text-white disabled:opacity-60"
            >
              <Bomb className="h-4 w-4 text-rose-400" />
              <span>{mines}</span>
              <ChevronDown className="h-4 w-4 text-purple-300" />
            </button>
            {minesPickerOpen && (
              <div
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-purple-500/40 bg-[#0c0620] p-1 shadow-xl shadow-black/60 hide-scrollbar"
              >
                {Array.from({ length: MAX_MINES - MIN_MINES + 1 }, (_, i) => i + MIN_MINES).map((n) => (
                  <button
                    key={n}
                    onClick={() => { setMines(n); setMinesPickerOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-bold transition ${
                      n === mines ? "bg-purple-600/40 text-white" : "text-purple-200 hover:bg-purple-600/20"
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><Bomb className="h-3.5 w-3.5 text-rose-400" /> {n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Next pay */}
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-widest text-purple-200/70">Siguiente pago</div>
            <div className="mt-1 rounded-lg border border-emerald-500/30 bg-emerald-950/30 py-1.5">
              <span className="font-display text-base font-bold neon-green">
                {nextMult > 0 ? `${nextMult.toFixed(2)}x` : "—"}
              </span>
            </div>
          </div>
          {/* Cashout */}
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-widest text-purple-200/70">Retirar</div>
            <div className="mt-1 rounded-lg border border-purple-500/40 bg-purple-950/30 py-1.5">
              <span className="font-display text-base font-bold text-purple-200">
                {picks > 0 ? `${currentMult.toFixed(2)}x` : "—"}
              </span>
            </div>
          </div>
        </section>

        {/* Board */}
        <section
          className={`relative mt-2 rounded-2xl border border-purple-500/30 overflow-hidden p-2 sm:p-2.5 backdrop-blur-sm ${shake ? "mines-shake" : ""}`}
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(80,30,150,0.25), transparent 65%), rgba(12,4,32,0.45)",
          }}
        >
          <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
            {Array.from({ length: TILES }).map((_, i) => {
              const isRevealed = revealed.has(i);
              const isMine = mineSet.has(i);
              const isExploded = explodedTile === i;
              const isDimMine = isRevealed && isMine && !isExploded && (phase === "lost" || phase === "cashed");
              return (
                <button
                  key={i}
                  type="button"
                  disabled={phase !== "playing" || isRevealed}
                  onClick={() => handleTile(i)}
                  className={`mines-tile aspect-square ${
                    isRevealed ? "mines-tile-revealed" : ""
                  } ${isRevealed && !isMine ? "mines-tile-safe" : ""} ${
                    isRevealed && isMine ? "mines-tile-mine" : ""
                  } ${isDimMine ? "mines-tile-mine-dim" : ""}`}
                  aria-label={`Casilla ${i + 1}`}
                >
                  {isRevealed && !isMine && (
                    <>
                      <Shards />
                      <Gem className="mines-gem absolute inset-0 m-auto h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" strokeWidth={2.2} />
                    </>
                  )}
                  {isRevealed && isMine && (
                    <>
                      {isExploded && <span className="mines-explosion" />}
                      <Shards mine />
                      <Bomb className={`mines-bomb absolute inset-0 m-auto h-7 w-7 sm:h-8 sm:w-8 text-rose-500`} strokeWidth={2.2} />
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Win/Lose overlay */}
          {phase === "lost" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="result-pop-lose rounded-xl border border-rose-500/60 bg-[#0c0620]/85 px-5 py-3 text-center">
                <div className="font-display text-2xl font-black neon-red">¡EXPLOTÓ!</div>
                <div className="text-xs font-bold text-rose-300">{mines} minas en el campo</div>
              </div>
            </div>
          )}
        </section>

        {/* Bet panel */}
        <section className="mt-2 rounded-2xl border border-purple-500/30 glass-panel p-2.5">
          <div className="text-center text-[10px] uppercase tracking-widest text-purple-200/70">Apuesta (COP)</div>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
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
              type="button"
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
              type="button"
              onClick={() => setBet((b) => Math.min(Math.min(balance, MAX_BET), b * 2))}
              disabled={phase !== "betting"}
              className="btn-bet flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold disabled:opacity-50"
            >
              X2
            </button>
            {QUICK_ADDS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBet((b) => Math.min(Math.min(balance, MAX_BET), b + amt))}
                disabled={phase !== "betting"}
                className="btn-bet flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold disabled:opacity-50"
              >
                +{formatCOP(amt)}
              </button>
            ))}
          </div>
          <div className="mt-1 text-center text-[10px] text-purple-300/70">
            MÍNIMO: {formatCOP(MIN_BET)} COP · PASO: {formatCOP(BET_STEP)}
          </div>

          {/* Action button */}
          <div className="mt-3">
            {phase === "betting" || phase === "cashed" || phase === "lost" ? (
              <button
                type="button"
                onClick={startGame}
                disabled={!canStart}
                className="btn-primary-green btn-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-black uppercase tracking-widest disabled:opacity-50"
              >
                APOSTAR
              </button>
            ) : (
              <button
                type="button"
                onClick={cashout}
                disabled={!canCashout}
                className="btn-primary-red btn-primary-action btn-pop-in flex h-12 w-full flex-col items-center justify-center rounded-xl font-display font-black uppercase tracking-widest disabled:opacity-50"
              >
                <span className="text-xs leading-none">RETIRAR</span>
                <span className="text-base leading-tight">{formatCOP(cashoutAmount)} COP</span>
              </button>
            )}
          </div>
        </section>

        {/* History (compact) */}
        <section className="mt-2 rounded-xl border border-purple-500/30 glass-panel px-2 py-1.5">
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="font-display text-[9px] font-bold uppercase tracking-widest text-white/80">
                Últimas
              </span>
            </div>
            <div className="flex flex-1 gap-1 overflow-x-auto hide-scrollbar">
              {history.slice(0, 14).map((h) => (
                <div
                  key={h.id}
                  title={`${h.user} · ${h.mines} minas · ${h.exploded ? "Explotó" : formatCOP(h.amount) + " COP"} · ${relativeTime(h.ts, now)}`}
                  className={`flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 ${
                    h.exploded
                      ? "border-rose-500/40 bg-rose-950/30"
                      : "border-emerald-500/30 bg-emerald-950/20"
                  }`}
                >
                  {h.exploded ? (
                    <Bomb className="h-3 w-3 text-rose-400" />
                  ) : (
                    <Gem className="h-3 w-3 text-emerald-400" />
                  )}
                  <span className={`font-display text-[10px] font-bold ${h.exploded ? "neon-red" : "neon-green"}`}>
                    {h.exploded ? "X" : `${h.multiplier.toFixed(2)}x`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-3" />
      </div>

      {phase === "cashed" && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
          <div className="relative">
            <WinCoins />
            <div className="result-pop-win rounded-xl border border-emerald-500/60 bg-[#0c0620]/90 px-5 py-3 text-center shadow-2xl">
              <div className="text-[10px] uppercase tracking-widest text-emerald-200/80">¡Ganaste!</div>
              <div className="font-display text-2xl font-black neon-green">+{formatCOP(cashoutAmount)} COP</div>
              <div className="text-xs font-bold text-emerald-300">{currentMult.toFixed(2)}x</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small burst of fragments when a tile is opened */
function Shards({ mine = false }: { mine?: boolean }) {
  const shards = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const ang = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
      const dist = 22 + Math.random() * 14;
      return {
        mx: Math.cos(ang) * dist,
        my: Math.sin(ang) * dist,
        mr: (Math.random() * 360 - 180),
        delay: Math.random() * 60,
      };
    });
  }, []);
  return (
    <>
      {shards.map((s, i) => (
        <span
          key={i}
          className={`mines-shard ${mine ? "mines-shard-mine" : ""}`}
          style={{
            // @ts-ignore CSS vars
            "--mx": `${s.mx}px`,
            "--my": `${s.my}px`,
            "--mr": `${s.mr}deg`,
            animationDelay: `${s.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

/** Neon coin burst shown briefly on cashout. */
function WinCoins() {
  const coins = useMemo(() => {
    return Array.from({ length: 14 }).map(() => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 80;
      return {
        cx: Math.cos(ang) * dist,
        cy: Math.sin(ang) * dist - 40, // bias upward
        delay: Math.random() * 180,
        size: 6 + Math.random() * 8,
      };
    });
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {coins.map((c, i) => (
        <span
          key={i}
          className="win-coin"
          style={{
            // @ts-ignore CSS vars
            "--cx": `${c.cx}px`,
            "--cy": `${c.cy}px`,
            width: `${c.size}px`,
            height: `${c.size}px`,
            animationDelay: `${c.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}