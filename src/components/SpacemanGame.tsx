import { useEffect, useRef, useState, useCallback } from "react";
import { Menu, Settings, Clock, ArrowRight, Minus, Plus, Volume2, VolumeX } from "lucide-react";
import bgImage from "@/assets/space-bg.png";
import astronautIdlePng from "@/assets/astronaut-idle.svg";
import astronautFlyingSrc from "@/assets/astronaut-flying.png";
import { startAmbient, startFlight, stopFlight, setMuted as setAudioMuted, playCrashSound, playCashoutSound } from "@/lib/gameAudio";

type Phase = "betting" | "running" | "crashed";
type HistoryItem = { id: number; value: number };

const MIN_BET = 500;
const BET_STEP = 500;
const QUICK_ADDS = [1000, 2000, 5000, 10000];
const BETTING_MS = 5000;
const CRASH_HOLD_MS = 2200;

const IDLE_MESSAGES = [
  "Esta vez iré más lejos",
  "¿Tendrás el valor de esperar?",
  "Hoy desayuné combustible premium",
  "Si exploto, fue con estilo",
  "Houston, tenemos ganancias",
  "Hoy no pienso aterrizar",
  "Esta salida se siente diferente",
  "El miedo hace retirar temprano",
  "Voy a romper mi récord",
  "No pestañees esta ronda",
  "No puedo prometer un aterrizaje seguro",
  "¡Esta es la buena!",
  "Hoy pagamos grande",
];

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function colorFor(mult: number) {
  if (mult < 2) return "text-rose-400 border-rose-500/50 bg-rose-950/40";
  if (mult < 3) return "text-purple-300 border-purple-500/50 bg-purple-950/40";
  return "text-emerald-300 border-emerald-500/50 bg-emerald-950/40";
}

// Crash distribution: heavily weighted toward early crashes
function generateCrashPoint(): number {
  const r = Math.random();
  // ~15% instant crashes at 1.00 - 1.03
  if (r < 0.15) return +(1 + Math.random() * 0.03).toFixed(2);
  // ~62% low crashes 1.03 - 2.50
  if (r < 0.77) return +(1.03 + Math.random() * 1.47).toFixed(2);
  // ~15% mid 2.50 - 7.50
  if (r < 0.92) return +(2.5 + Math.random() * 5).toFixed(2);
  // ~5% high 7.5 - 27
  if (r < 0.97) return +(7.5 + Math.random() * 20).toFixed(2);
  // ~3% jackpot 27 - 107
  return +(27 + Math.random() * 80).toFixed(2);
}

function Stars() {
  const [data, setData] = useState<{
    stars: { id: number; top: number; left: number; size: number; delay: number; dur: number }[];
    shooters: { id: number; top: number; left: number; delay: number }[];
  } | null>(null);
  useEffect(() => {
    setData({
      stars: Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        top: Math.random() * 80,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        dur: 2 + Math.random() * 3,
      })),
      shooters: Array.from({ length: 3 }).map((_, i) => ({
        id: i,
        top: Math.random() * 40,
        left: 50 + Math.random() * 50,
        delay: i * 3 + Math.random() * 4,
      })),
    });
  }, []);
  if (!data) return <div className="pointer-events-none absolute inset-0 overflow-hidden" />;
  const { stars, shooters } = data;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            boxShadow: "0 0 6px rgba(255,255,255,0.9)",
          }}
        />
      ))}
      {shooters.map((s) => (
        <div
          key={`sh-${s.id}`}
          className="absolute h-px w-24 bg-gradient-to-r from-white to-transparent"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            animation: `shooting 6s linear ${s.delay}s infinite`,
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.9))",
          }}
        />
      ))}
    </div>
  );
}

export function SpacemanGame() {
  const [phase, setPhase] = useState<Phase>("betting");
  const [multiplier, setMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState<number>(1.5);
  const [countdown, setCountdown] = useState(BETTING_MS / 1000);
  const [history, setHistory] = useState<HistoryItem[]>([
    { id: 1, value: 1.22 },
    { id: 2, value: 3.11 },
    { id: 3, value: 19.4 },
    { id: 4, value: 1.3 },
    { id: 5, value: 7.02 },
    { id: 6, value: 54.35 },
    { id: 7, value: 1.78 },
  ]);

  const [balance, setBalance] = useState(100000);
  const [bet, setBet] = useState(2000);
  const [activeBet, setActiveBet] = useState<number | null>(null);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [online, setOnline] = useState(150);
  const [messageIdx, setMessageIdx] = useState(0);
  const [muted, setMuted] = useState(false);

  // Start ambient music on first user interaction (browsers require a gesture)
  useEffect(() => {
    const onFirst = () => {
      startAmbient();
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst);
    window.addEventListener("keydown", onFirst);
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, []);

  // Flight whoosh while running
  useEffect(() => {
    if (phase === "running") startFlight();
    else stopFlight();
  }, [phase]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      setAudioMuted(next);
      return next;
    });
  };

  // Show up to 2 idle messages per betting phase
  useEffect(() => {
    if (phase !== "betting") return;
    setMessageIdx(Math.floor(Math.random() * IDLE_MESSAGES.length));
    const id = setTimeout(() => {
      setMessageIdx((i) => (i + 1 + Math.floor(Math.random() * (IDLE_MESSAGES.length - 1))) % IDLE_MESSAGES.length);
    }, 2500);
    return () => clearTimeout(id);
  }, [phase]);

  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Game loop ----
  const startBetting = useCallback(() => {
    setPhase("betting");
    setMultiplier(1);
    setCashedOutAt(null);
    setActiveBet(null);
    setLastWin(null);
    setCrashPoint(generateCrashPoint());
    setCountdown(BETTING_MS / 1000);

    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, BETTING_MS - elapsed);
      setCountdown(+(remaining / 1000).toFixed(1));
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startRunning();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startRunning = useCallback(() => {
    setPhase("running");
    startRef.current = performance.now();
    const tick = () => {
      const t = (performance.now() - startRef.current) / 1000;
      // Exponential-ish growth, feels like crash games
      const m = +Math.pow(Math.E, 0.09 * t).toFixed(2);
      setMultiplier((prev) => {
        const next = m;
        // crash check using crashPoint via state read in closure -> use ref
        return next;
      });
      // crash check
      if (m >= crashPointRef.current) {
        triggerCrash();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // keep crash point in ref so the rAF closure sees fresh value
  const crashPointRef = useRef(crashPoint);
  useEffect(() => {
    crashPointRef.current = crashPoint;
  }, [crashPoint]);

  const triggerCrash = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase("crashed");
    setMultiplier(crashPointRef.current);
    setHistory((h) => [{ id: Date.now(), value: crashPointRef.current }, ...h].slice(0, 12));
    playCrashSound();
    phaseTimer.current = setTimeout(() => {
      startBetting();
    }, CRASH_HOLD_MS);
  }, [startBetting]);

  // bootstrap
  useEffect(() => {
    setCrashPoint(generateCrashPoint());
    setOnline(80 + Math.floor(Math.random() * 200));
    startBetting();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (phaseTimer.current) clearTimeout(phaseTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Actions ----
  const handleBetClick = () => {
    if (phase === "betting") {
      if (bet < MIN_BET || bet > balance) return;
      setActiveBet(bet);
      setBalance((b) => b - bet);
    } else if (phase === "running" && activeBet != null && cashedOutAt == null) {
      // cash out: devolver apuesta + ganancia neta = apuesta * multiplicador
      const payout = activeBet * multiplier;
      const profit = activeBet * (multiplier - 1);
      playCashoutSound();
      setCashedOutAt(multiplier);
      setLastWin(profit);
      setBalance((b) => b + payout);
    }
  };

  const addToBet = (amount: number) => {
    setBet((b) => Math.min(balance, b + amount));
  };

  const progressPct = phase === "betting" ? (1 - countdown / (BETTING_MS / 1000)) * 100 : 100;

  // ---- Render ----
  const buttonState = (() => {
    if (phase === "running" && activeBet != null && cashedOutAt == null) {
      const profit = activeBet * (multiplier - 1);
      return { label: `RETIRAR  +${formatCOP(profit)}`, cls: "btn-primary-red", disabled: false };
    }
    if (phase === "betting") {
      return { label: activeBet ? "APUESTA REGISTRADA" : "APOSTAR", cls: "btn-primary-green", disabled: !!activeBet || bet < MIN_BET || bet > balance };
    }
    return { label: "ESPERANDO RONDA", cls: "btn-primary-green opacity-60", disabled: true };
  })();

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* dark overlay for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1a0833]/40 via-[#160730]/30 to-[#0d0420]/80" />
      <Stars />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-4 pt-4 sm:max-w-lg sm:px-4">
        {/* Header */}
        <header className="flex items-center justify-between bg-[#060210]/90 backdrop-blur-sm border-b border-purple-500/20 pb-3 px-3 -mx-3">
          <button className="rounded-md p-2 text-white hover:bg-white/10">
            <Menu className="h-7 w-7" strokeWidth={3} />
          </button>
          <h1 className="font-display text-base font-black leading-tight tracking-widest sm:text-lg">
            SPACE
            <br className="-mt-1" />
            <span className="block -mt-1">MAN MSV</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="neon-green font-display text-xs font-bold sm:text-sm">
                {formatCOP(balance)} COP
              </div>
            </div>
            <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </header>

        {/* Stage */}
        <section className="relative mt-3 flex-1">
          {/* online + mute */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-semibold text-emerald-300/90">{online} ONLINE</span>
            </div>
            <button
              onClick={toggleMute}
              aria-label={muted ? "Activar sonido" : "Silenciar"}
              className="rounded-md p-1 text-purple-200/80 hover:bg-white/5"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Multiplier */}
          <div className="relative mt-8 flex flex-col items-center justify-center">
            <div
              className={`font-display select-none text-6xl font-black sm:text-7xl md:text-8xl ${
                phase === "crashed" ? "neon-red animate-[crash-shake_.4s_ease-in-out]" : "neon-red"
              }`}
              style={{ transition: "transform .2s" }}
            >
              {multiplier.toFixed(2)}x
            </div>

            {/* Reserved-height slot so the "Crash" label never pushes layout */}
            <div className="h-6 mt-2 flex items-center justify-center">
              {phase === "crashed" && (
                <div className="font-display text-lg font-black uppercase tracking-widest text-rose-400 leading-none animate-[crash-pop_.35s_ease-out]">
                  Crash
                </div>
              )}
            </div>

            {/* Astronaut: reserves layout space, sprite floats in an isolated layer */}
            <div className="relative mt-4 h-56 w-full sm:h-72">
              {/* Rotating idle message to the right of astronaut */}
              <div
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 left-[55%] right-3 sm:left-[52%] sm:right-6 flex items-center justify-start transition-opacity duration-300 ${
                  phase === "betting" ? "opacity-100" : "opacity-0"
                }`}
              >
                <div key={messageIdx} className="relative animate-[msg-in_.45s_ease-out]">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-2 rounded-xl bg-fuchsia-500/20 blur-xl animate-[msg-pulse_2.2s_ease-in-out_infinite]"
                  />
                  <p
                    className="relative font-display text-sm sm:text-base font-bold italic leading-tight text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] animate-[msg-beat_2.2s_ease-in-out_infinite]"
                    style={{ textShadow: "0 0 12px rgba(180,140,255,0.55)" }}
                  >
                    {IDLE_MESSAGES[messageIdx]}
                  </p>
                </div>
              </div>
              {/* Flash burst on crash */}
              {phase === "crashed" && (
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,210,80,0.8) 25%, rgba(255,90,40,0.6) 50%, rgba(255,40,40,0.3) 70%, transparent 85%)",
                    filter: "blur(4px)",
                    animation: "flash-burst 0.9s ease-out forwards",
                    mixBlendMode: "screen",
                  }}
                />
              )}
              {/* Speed lines (only in running) */}
              {phase === "running" && (
                <div className="pointer-events-none absolute inset-0">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-8 w-px bg-gradient-to-b from-transparent via-white/70 to-transparent"
                      style={{
                        left: `${15 + i * 10}%`,
                        top: 0,
                        animation: `speed-line ${0.5 + (i % 3) * 0.15}s linear ${i * 0.08}s infinite`,
                        opacity: 0.6,
                      }}
                    />
                  ))}
                </div>
              )}
              <div
                className={`pointer-events-none absolute left-1/2 will-change-transform ${
                  phase === "crashed"
                    ? "astro-crash"
                    : phase === "running"
                      ? "astro-flying"
                      : "astro-idle"
                }`}
                style={{ bottom: 0, width: 180, marginLeft: -90 }}
              >
                <div className={`relative ${phase === "running" ? "astro-wobble" : ""}`}>
                  {/* Flame (only in running) */}
                  {phase === "running" && (
                    <>
                      <div
                        className="pointer-events-none absolute"
                        style={{
                          left: "38%",
                          top: "77%",
                          width: 42,
                          height: 92,
                          transform: "translate(-50%, -10%) rotate(50deg)",
                          transformOrigin: "top center",
                        }}
                      >
                        <div
                          className="flame absolute inset-0 rounded-full"
                          style={{
                            background:
                              "radial-gradient(ellipse at 50% 14%, rgba(255,249,210,0.98) 0%, rgba(255,216,98,0.95) 20%, rgba(255,130,32,0.88) 52%, rgba(255,56,32,0.55) 76%, transparent 88%)",
                            filter: "blur(1.8px)",
                            transformOrigin: "top center",
                          }}
                        />
                        <div
                          className="absolute inset-x-[22%] top-0 h-[82%] rounded-full"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(255,235,160,0.95) 0%, rgba(255,140,60,0.5) 55%, transparent 100%)",
                            filter: "blur(8px)",
                            opacity: 0.9,
                          }}
                        />
                      </div>
                      <div
                        className="pointer-events-none absolute"
                        style={{
                          left: "35%",
                          top: "79%",
                          width: 58,
                          height: 58,
                          transform: "translate(-50%, -50%)",
                          background:
                            "radial-gradient(circle, rgba(255,216,98,0.45) 0%, rgba(255,92,36,0.28) 38%, transparent 72%)",
                          filter: "blur(12px)",
                          mixBlendMode: "screen",
                        }}
                      />
                    </>
                  )}
                  <div className="relative w-full">
                    <img
                      src={astronautIdlePng}
                      alt="Astronauta"
                      className={`block w-full transition-all duration-500 ease-out ${
                        phase === "running"
                          ? "opacity-0 scale-90 blur-md -translate-y-2"
                          : "opacity-100 scale-100 blur-0 translate-y-0 drop-shadow-[0_0_12px_rgba(120,120,255,0.25)]"
                      }`}
                    />
                    <img
                      src={astronautFlyingSrc}
                      alt=""
                      aria-hidden="true"
                      className={`absolute inset-0 w-full transition-all duration-500 ease-out ${
                        phase === "running"
                          ? "opacity-100 scale-100 blur-0 translate-y-0 drop-shadow-[0_0_24px_rgba(255,80,80,0.55)]"
                          : "opacity-0 scale-110 blur-md translate-y-3"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {cashedOutAt != null && lastWin != null && phase !== "crashed" && (
              <div className="absolute right-2 top-0 rounded-lg border border-emerald-400/50 bg-emerald-950/60 px-3 py-2 text-right shadow-lg">
                <div className="text-[10px] uppercase tracking-wider text-emerald-200">
                  Retirado a {cashedOutAt.toFixed(2)}x
                </div>
                <div className="neon-green font-display text-lg font-bold">
                  +{formatCOP(lastWin)} COP
                </div>
              </div>
            )}

            {phase === "crashed" && activeBet != null && cashedOutAt == null && (
              <div className="absolute right-2 top-0 rounded-lg border border-rose-500/60 bg-rose-950/70 px-3 py-2 text-right">
                <div className="text-[10px] uppercase tracking-wider text-rose-200">Resultado</div>
                <div className="font-display text-lg font-bold text-rose-300">PERDISTE</div>
              </div>
            )}
          </div>
        </section>

        {/* Round status (fixed height to prevent layout shifts) */}
        <div className="mt-4 px-1 h-[42px]">
          <div className="flex h-5 items-center justify-between gap-3 text-xs sm:text-sm whitespace-nowrap">
            <div className="flex items-center gap-2 font-semibold min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${phase === "running" ? "bg-emerald-400" : "bg-rose-500"}`}
              />
              <span className="truncate uppercase tracking-wider text-purple-100/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                {phase === "betting" ? "Preparando ronda" : phase === "running" ? "En vuelo" : "Crash"}
              </span>
            </div>
            <span className="neon-red font-display text-base font-bold shrink-0 tabular-nums w-12 text-right">
              {phase === "betting" ? `${countdown.toFixed(1)}s` : ""}
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-purple-950/40 backdrop-blur-sm">
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${progressPct}%`,
                background:
                  "repeating-linear-gradient(45deg,#ff4d4d,#ff4d4d 10px,#c91f1f 10px,#c91f1f 20px)",
                boxShadow: "0 0 16px rgba(255,80,80,0.55)",
                transitionDuration: phase === "betting" ? "100ms" : "0ms",
              }}
            />
          </div>
        </div>

        {/* Bet panel */}
        <div className="mt-3 glass-panel rounded-xl p-3 sm:p-4">
          <div className="text-center text-[11px] uppercase tracking-[0.2em] text-purple-200/70">
            Apuesta (COP)
          </div>
          <div className="mt-2 flex items-stretch gap-2">
            <button
              className="btn-bet flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-2xl font-black sm:h-16 sm:w-16"
              onClick={() => setBet((b) => Math.max(MIN_BET, b - BET_STEP))}
              disabled={!!activeBet}
              aria-label="Restar 500"
            >
              <Minus className="h-6 w-6" strokeWidth={3} />
            </button>
            <input
              type="number"
              value={bet}
              min={MIN_BET}
              onChange={(e) => setBet(Math.max(0, parseInt(e.target.value || "0", 10)))}
              disabled={!!activeBet}
              inputMode="numeric"
              className="no-spinner min-w-0 flex-1 rounded-lg border border-purple-500/30 bg-black/40 px-2 text-center font-display text-2xl font-bold text-white outline-none focus:border-purple-400/60 disabled:opacity-70 sm:text-3xl"
            />
            <button
              className="btn-bet flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-2xl font-black sm:h-16 sm:w-16"
              onClick={() => setBet((b) => Math.min(balance, b + BET_STEP))}
              disabled={!!activeBet}
              aria-label="Sumar 500"
            >
              <Plus className="h-6 w-6" strokeWidth={3} />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            {QUICK_ADDS.map((amt) => (
              <button
                key={amt}
                className="btn-bet rounded-md px-3 py-1.5 text-xs font-bold"
                onClick={() => addToBet(amt)}
                disabled={!!activeBet}
              >
                +{amt}
              </button>
            ))}
          </div>
          <div className="mt-2 text-center text-[11px] uppercase tracking-wider text-purple-200/60">
            Mínimo: {MIN_BET} COP · Paso: {BET_STEP}
          </div>

          <button
            onClick={handleBetClick}
            disabled={buttonState.disabled}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-lg font-black uppercase sm:py-3.5 sm:text-xl ${buttonState.cls} disabled:cursor-not-allowed`}
          >
            <span>{buttonState.label}</span>
            <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-white/80">
              <ArrowRight className="h-3 w-3" />
            </span>
          </button>
        </div>

        {/* History (compact) */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto hide-scrollbar px-1">
          <Clock className="h-3 w-3 shrink-0 text-purple-200/70" />
          {history.map((h) => (
            <div
              key={h.id}
              className={`shrink-0 rounded border px-1.5 py-0.5 font-display text-[10px] font-bold leading-none ${colorFor(h.value)}`}
            >
              {h.value.toFixed(2)}x
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}