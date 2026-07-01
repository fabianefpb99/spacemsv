import { AuthControl } from "@/components/auth/AuthControl";
import { FitText } from "@/components/ui/fit-text";
import { BetAmount } from "@/components/games/BetAmount";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { Link } from "@tanstack/react-router";
import { Menu, Minus, Plus, Volume2, VolumeX, ChevronDown, Bomb, Gem, TrendingUp } from "lucide-react";
import { setMuted as setAudioMuted, playCrashSound, playCashoutSound, isMuted, stopAllGameAudio, AUDIO_STOP_ALL_EVENT } from "@/lib/gameAudio";
import coinRevealSfx from "@/assets/sfx/coin-reveal.mp3";
import victorySfx from "@/assets/sfx/victory.mp3";
import gameOverSfx from "@/assets/sfx/game-over.mp3";
import minesBg from "@/assets/mines-page-bg.png";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, type MeData } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { toFriendlyError } from "@/lib/friendly-error";
import { withTimeout } from "@/lib/async/with-timeout";
import { minesDeal, minesReveal, minesCashout, minesResume, type MinesSessionView } from "@/lib/games/mines.functions";
import { clampBetToStep } from "@/lib/games/bet-helpers";
import {
import { GameMenuDrawer } from "@/components/GameMenuDrawer";
  MINES_TILES,
  MINES_MIN, MINES_MAX,
  MINES_MIN_BET, MINES_MAX_BET, MINES_BET_STEP,
  multiplierFor,
} from "@/lib/games/mines.shared";

/** Lightweight UUID v4 for client_action_id. */
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

type Phase = "betting" | "playing" | "lost" | "cashed";

// Alias to keep the existing JSX/limits unchanged.
const TILES = MINES_TILES;
const MIN_MINES = MINES_MIN;
const MAX_MINES = MINES_MAX;
const MIN_BET = MINES_MIN_BET;
const MAX_BET = MINES_MAX_BET;
const BET_STEP = MINES_BET_STEP;
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

function nextMultiplier(mines: number, picks: number): number {
  return multiplierFor(mines, picks + 1);
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
  const { user, refreshSession } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();
  const realBalance = me.data?.balance ?? 0;
  const bonusBalance = me.data?.bonus_balance ?? 0;
  const balance = realBalance + bonusBalance;

  const dealFn = useServerFn(minesDeal);
  const revealFn = useServerFn(minesReveal);
  const cashoutFn = useServerFn(minesCashout);
  const resumeFn = useServerFn(minesResume);

  const [bet, setBet] = useState(2000);
  const [mines, setMines] = useState(3);
  const [minesPickerOpen, setMinesPickerOpen] = useState(false);

  const [phase, setPhase] = useState<Phase>("betting");
  const [mineSet, setMineSet] = useState<Set<number>>(() => new Set());
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [explodedTile, setExplodedTile] = useState<number | null>(null);
  const [picks, setPicks] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** Live session reference (id + nonce). */
  const sessionRef = useRef<{ id: string; nonce: number } | null>(null);
  /** Per-action UUID used for idempotency of the current click. */
  const actionIdRef = useRef<string | null>(null);
  /** Tiles the user has clicked but the server hasn't confirmed yet. */
  const [pendingTiles, setPendingTiles] = useState<Set<number>>(() => new Set());
  const pendingQueueRef = useRef<number[]>([]);
  /** Mirror of `revealed` for the async queue worker. */
  const revealedRef = useRef<Set<number>>(new Set());
  /** True while the deal RPC is in flight. */
  const dealInFlightRef = useRef(false);
  /** True while a reveal/cashout RPC is in flight. */
  const actionInFlightRef = useRef(false);
  /** True while we're optimistically in "playing" but waiting for the deal. */
  const startingRef = useRef(false);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);

  const [muted, setMuted] = useState(false);
  const [online] = useState(263);
  const [history, setHistory] = useState<HistoryItem[]>(() => seedHistory());
  const [now, setNow] = useState(() => Date.now());
  const [shake, setShake] = useState(false);
  const historyId = useRef(1000);

  // Push server-confirmed balance into the useMe cache for instant header update.
  const applyBalance = useCallback(
    (newBalance: number) => {
      if (!user) return;
      queryClient.setQueryData<MeData | null>(["me", user.id], (prev) =>
        prev ? { ...prev, balance: newBalance } : prev,
      );
      // Refetch en background para sincronizar `bonus_balance`
      // (el servidor sólo devuelve el saldo real tras `adjust_balance`).
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    [queryClient, user],
  );

  const resetRound = useCallback(() => {
    setPhase("betting");
    setRevealed(new Set());
    setMineSet(new Set());
    setExplodedTile(null);
    setPicks(0);
    sessionRef.current = null;
    actionIdRef.current = null;
    pendingQueueRef.current = [];
    setPendingTiles(new Set());
    startingRef.current = false;
  }, []);

  /** Sync local UI state with a server-returned session view. */
  const applyServerView = useCallback((view: MinesSessionView) => {
    sessionRef.current = { id: view.session_id, nonce: view.nonce };
    const pub = view.public_state;
    setRevealed(new Set(pub.revealed));
    setPicks(pub.picks);
    applyBalance(view.new_balance);
    // Whatever tiles came back as revealed/closed are no longer pending.
    setPendingTiles((prev) => {
      if (prev.size === 0 && pub.phase === "playing") return prev;
      const next = new Set<number>();
      if (pub.phase === "playing") {
        prev.forEach((i) => { if (!pub.revealed.includes(i)) next.add(i); });
      }
      return next;
    });

    if (pub.phase === "result") {
      pendingQueueRef.current = [];
      const allMines = new Set<number>(pub.mineSetReveal ?? []);
      setMineSet(allMines);
      if (pub.outcome === "lost") {
        const last = pub.explodedTile ?? null;
        setExplodedTile(last);
        playGameOver();
        playCrashSound();
        setShake(true);
        setTimeout(() => setShake(false), 400);
        // Reveal all mines slightly after the explosion frame.
        setTimeout(() => {
          setRevealed((prev) => {
            const all = new Set(prev);
            allMines.forEach((m) => all.add(m));
            return all;
          });
        }, 250);
        setHistory((h) => [
          { id: ++historyId.current, user: "Tú", mines: pub.mines, multiplier: 0, amount: pub.bet, exploded: true, ts: Date.now() },
          ...h,
        ].slice(0, 20));
        setPhase("lost");
        setTimeout(() => resetRound(), 2400);
      } else {
        // Won (manual cashout OR auto-cashout when every safe tile is opened).
        playCashoutSound();
        if ((pub.picks ?? 0) >= MINES_TILES - pub.mines) playVictory();
        setHistory((h) => [
          { id: ++historyId.current, user: "Tú", mines: pub.mines, multiplier: pub.multiplier, amount: pub.payout ?? 0, exploded: false, ts: Date.now() },
          ...h,
        ].slice(0, 20));
        setPhase("cashed");
        setTimeout(() => resetRound(), 1800);
      }
    } else {
      setMineSet(new Set());
      setExplodedTile(null);
      setPhase("playing");
    }
  }, [applyBalance, resetRound]);

  const syncFromServer = useCallback(async () => {
    if (!user) {
      resetRound();
      return false;
    }

    try {
      const view = await withTimeout(resumeFn(), 5000, "mines_resume_timeout");
      if (!view) {
        resetRound();
        await queryClient.invalidateQueries({ queryKey: ["me", user.id] });
        return false;
      }

      setBet(view.public_state.bet);
      setMines(view.public_state.mines);
      applyServerView(view);
      return true;
    } catch (error) {
      console.warn("[mines] syncFromServer failed", error);
      resetRound();
      await queryClient.invalidateQueries({ queryKey: ["me", user.id] });
      return false;
    }
  }, [applyServerView, queryClient, resetRound, resumeFn, user]);

  const recoverAfterActionError = useCallback(async (error: unknown) => {
    const raw = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const looksAuthError =
      raw.includes("unauthorized") ||
      raw.includes("not authenticated") ||
      raw.includes("auth_get_session_timeout") ||
      raw.includes("auth_get_user_timeout");

    if (looksAuthError) {
      await refreshSession().catch((refreshError) => {
        console.warn("[mines] auth refresh failed", refreshError);
        return null;
      });
    }

    const shouldResync =
      looksAuthError ||
      raw.includes("stale_nonce") ||
      raw.includes("session_closed") ||
      raw.includes("session_not_found") ||
      raw.includes("not_playing") ||
      raw.includes("already_revealed") ||
      raw.includes("timeout") ||
      raw.includes("failed to fetch") ||
      raw.includes("load failed");

    return shouldResync ? syncFromServer() : false;
  }, [refreshSession, syncFromServer]);

  // Resume any open server-side session on mount.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const view = await withTimeout(resumeFn(), 5000, "mines_resume_timeout");
        if (cancelled || !view) return;
        setBet(view.public_state.bet);
        setMines(view.public_state.mines);
        applyServerView(view);
      } catch (error) {
        console.warn("[mines] initial resume failed", error);
        // best-effort; ignore
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Cierra cualquier audio de otro juego al entrar, y para SFX propios al salir.
  useEffect(() => {
    stopAllGameAudio();
    return () => { stopAllMinesSfx(); };
  }, []);

  // tick for relative times + auto fake wins (pausados en background)
  useVisibleInterval(() => setNow(Date.now()), 1000);
  useVisibleInterval(() => {
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

  useEffect(() => { setAudioMuted(muted); }, [muted]);

  const currentMult = useMemo(() => multiplierFor(mines, picks), [mines, picks]);
  const nextMult    = useMemo(() => nextMultiplier(mines, picks), [mines, picks]);
  const cashoutAmount = Math.floor(bet * currentMult);

  const startGame = useCallback(async () => {
    if (phase !== "betting" || startingRef.current || dealInFlightRef.current) return;
    if (bet < MIN_BET || bet > balance) return;
    startingRef.current = true;
    dealInFlightRef.current = true;
    setError(null);
    // Optimistic UI: switch board to "playing" + debit balance instantly so
    // APOSTAR responds without waiting for the network roundtrip.
    const prevBalance = balance;
    applyBalance(Math.max(0, balance - bet));
    setRevealed(new Set());
    setMineSet(new Set());
    setExplodedTile(null);
    setPicks(0);
    setPendingTiles(new Set());
    pendingQueueRef.current = [];
    setPhase("playing");
    resetRevealStreak();
    try {
      const actionId = uuid();
      actionIdRef.current = actionId;
      const view = await withTimeout(
        dealFn({ data: { bet, mines, client_action_id: actionId } }),
        7000,
        "mines_deal_timeout",
      );
      applyServerView(view);
      // Drain any clicks the user made between APOSTAR and the deal response.
      void processQueue();
    } catch (e) {
      const recovered = await recoverAfterActionError(e);
      if (!recovered) {
        setError(toFriendlyError(e, "No se pudo iniciar la partida."));
        applyBalance(prevBalance);
        pendingQueueRef.current = [];
        setPendingTiles(new Set());
        setPhase("betting");
      }
    } finally {
      dealInFlightRef.current = false;
      startingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bet, balance, mines, dealFn, applyServerView, applyBalance, recoverAfterActionError]);

  const cashout = useCallback(async () => {
    if (phase !== "playing" || picks === 0 || actionInFlightRef.current) return;
    const sess = sessionRef.current;
    if (!sess) return;
    actionInFlightRef.current = true;
    setError(null);
    try {
      const view = await withTimeout(
        cashoutFn({
          data: { session_id: sess.id, nonce: sess.nonce, client_action_id: uuid() },
        }),
        7000,
        "mines_cashout_timeout",
      );
      applyServerView(view);
    } catch (e) {
      const recovered = await recoverAfterActionError(e);
      if (!recovered) {
        setError(toFriendlyError(e, "No se pudo cobrar."));
      }
    } finally {
      actionInFlightRef.current = false;
    }
  }, [phase, picks, cashoutFn, applyServerView, recoverAfterActionError]);

  /**
   * Drain queued tile clicks one at a time. Runs only one network call in
   * flight so the server's nonce stays in sync, but the user can click as
   * fast as they want — each click flips its tile to a "pending" press and
   * the worker reconciles with the server in order.
   */
  const processQueue = useCallback(async () => {
    if (actionInFlightRef.current) return;
    while (pendingQueueRef.current.length > 0) {
      const sess = sessionRef.current;
      if (!sess) return; // wait for deal to complete; will be re-kicked
      const idx = pendingQueueRef.current.shift()!;
      if (revealedRef.current.has(idx)) {
        setPendingTiles((prev) => {
          if (!prev.has(idx)) return prev;
          const n = new Set(prev); n.delete(idx); return n;
        });
        continue;
      }
      actionInFlightRef.current = true;
      try {
        const view = await withTimeout(
          revealFn({
            data: {
              session_id: sess.id,
              nonce: sess.nonce,
              tile_idx: idx,
              client_action_id: uuid(),
            },
          }),
          7000,
          "mines_reveal_timeout",
        );
        // Sound matches the confirmed outcome — no diamond-then-bomb flash.
        if (view.public_state.phase === "playing") playReveal();
        applyServerView(view);
        if (view.public_state.phase === "result") {
          pendingQueueRef.current = [];
          break;
        }
      } catch (e) {
        setPendingTiles((prev) => {
          if (!prev.has(idx)) return prev;
          const n = new Set(prev); n.delete(idx); return n;
        });
        const recovered = await recoverAfterActionError(e);
        if (!recovered) {
          setError(toFriendlyError(e, "No se pudo realizar la jugada."));
        }
        // Drop the rest of the queue — the nonce likely drifted.
        pendingQueueRef.current = [];
        break;
      } finally {
        actionInFlightRef.current = false;
      }
    }
  }, [revealFn, applyServerView, recoverAfterActionError]);

  const handleTile = useCallback((idx: number) => {
    if (phase !== "playing") return;
    if (revealed.has(idx)) return;
    if (pendingTiles.has(idx)) return;
    // Queue + flip the tile visually to a "pressed" state. We DON'T paint a
    // diamond here: the icon (gem or bomb) is committed only after the server
    // confirms, so the user never sees a tile flip from gem → bomb.
    pendingQueueRef.current.push(idx);
    setPendingTiles((prev) => { const n = new Set(prev); n.add(idx); return n; });
    void processQueue();
  }, [phase, revealed, pendingTiles, processQueue]);

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
            <GameMenuDrawer />
            <Link to="/home">
              <img
                src={betspaceLogo}
                alt="BETSPACE"
                className="h-6 w-auto sm:h-7 translate-y-px"
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
            <AuthControl />
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
              const isPending = !isRevealed && pendingTiles.has(i);
              const isMine = mineSet.has(i);
              const isExploded = explodedTile === i;
              const isDimMine = isRevealed && isMine && !isExploded && (phase === "lost" || phase === "cashed");
              return (
                <button
                  key={i}
                  type="button"
                  disabled={phase !== "playing" || isRevealed || isPending}
                  onClick={() => handleTile(i)}
                  className={`mines-tile aspect-square ${
                    isRevealed ? "mines-tile-revealed" : ""
                  } ${isRevealed && !isMine ? "mines-tile-safe" : ""} ${
                    isRevealed && isMine ? "mines-tile-mine" : ""
                  } ${isDimMine ? "mines-tile-mine-dim" : ""} ${isPending ? "mines-tile-pending" : ""}`}
                  aria-label={`Casilla ${i + 1}`}
                >
                  {isPending && (
                    <span className="mines-tile-crack" aria-hidden="true">
                      <i />
                      <i />
                    </span>
                  )}
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
            <div
              className="h-11 w-full min-w-0 flex-1 cursor-default rounded-lg border border-purple-500/30 bg-[#160830]/60 px-2 font-display text-xl font-bold text-white"
              aria-label="Apuesta"
            >
              <BetAmount bet={bet} bonusBalance={bonusBalance} />
            </div>
            <button
              type="button"
              onClick={() => setBet((b) => clampBetToStep(b + BET_STEP, balance, MAX_BET, BET_STEP, MIN_BET))}
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
              onClick={() => setBet((b) => clampBetToStep(b * 2, balance, MAX_BET, BET_STEP, MIN_BET))}
              disabled={phase !== "betting"}
              className="btn-bet flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold disabled:opacity-50"
            >
              X2
            </button>
            {QUICK_ADDS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBet((b) => clampBetToStep(b + amt, balance, MAX_BET, BET_STEP, MIN_BET))}
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