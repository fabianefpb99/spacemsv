import { useEffect, useRef, useState, useCallback } from "react";
import { Menu, Settings, Clock, ArrowRight, Minus, Plus } from "lucide-react";
import bgImage from "@/assets/space-bg.png";
import astronautSvg from "@/assets/astronaut.svg";

type Phase = "betting" | "running" | "crashed";
type HistoryItem = { id: number; value: number };

const MIN_BET = 500;
const BET_STEP = 500;
const QUICK_ADDS = [1000, 2000, 5000, 10000];
const BETTING_MS = 4000;
const CRASH_HOLD_MS = 2200;

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function colorFor(mult: number) {
  if (mult < 2) return "text-rose-400 border-rose-500/50 bg-rose-950/40";
  if (mult < 10) return "text-amber-300 border-amber-500/50 bg-amber-950/40";
  return "text-emerald-300 border-emerald-500/50 bg-emerald-950/40";
}

// Crash distribution: many low, some mid, rare high
function generateCrashPoint(): number {
  const r = Math.random();
  if (r < 0.45) return +(1 + Math.random() * 1.5).toFixed(2); // 1.00 - 2.50
  if (r < 0.8) return +(2.5 + Math.random() * 5).toFixed(2); // 2.50 - 7.50
  if (r < 0.97) return +(7.5 + Math.random() * 20).toFixed(2); // 7.5 - 27
  return +(27 + Math.random() * 80).toFixed(2); // 27 - 107
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
      // cash out
      const win = activeBet * multiplier;
      setCashedOutAt(multiplier);
      setLastWin(win);
      setBalance((b) => b + win);
    }
  };

  const addToBet = (amount: number) => {
    setBet((b) => Math.min(balance, b + amount));
  };

  const progressPct = phase === "betting" ? (1 - countdown / (BETTING_MS / 1000)) * 100 : 100;

  // ---- Render ----
  const buttonState = (() => {
    if (phase === "running" && activeBet != null && cashedOutAt == null) {
      return { label: `RETIRAR  ${(activeBet * multiplier).toFixed(0)}`, cls: "btn-primary-red", disabled: false };
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
        <header className="flex items-center justify-between border-b border-purple-500/20 pb-3">
          <button className="rounded-md p-2 text-rose-400 hover:bg-white/5">
            <Menu className="h-7 w-7" strokeWidth={3} />
          </button>
          <h1 className="font-display text-lg font-black leading-tight tracking-widest sm:text-xl">
            SPACE
            <br className="-mt-1" />
            <span className="block -mt-1">MAN MSV</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="neon-green font-display text-sm font-bold sm:text-base">
                {formatCOP(balance)} COP
              </div>
            </div>
            <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
              <Settings className="h-6 w-6" />
            </button>
          </div>
        </header>

        {/* Stage */}
        <section className="relative mt-3 flex-1">
          {/* online */}
          <div className="flex items-center gap-2 text-sm">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-semibold text-emerald-300/90">{online} ONLINE</span>
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

            {phase === "crashed" && (
              <div className="mt-2 font-display text-lg font-black uppercase tracking-widest text-rose-400">
                Crash
              </div>
            )}

            {/* Astronaut */}
            <div className="relative mt-4 h-56 w-full sm:h-72">
              <div
                className="absolute left-1/2"
                style={{
                  bottom: 0,
                  width: 200,
                  marginLeft: -100,
                  animation:
                    phase === "crashed"
                      ? "fly-away 1.2s ease-in forwards"
                      : "float-up 3.2s ease-in-out infinite",
                }}
              >
                <div className="relative">
                  {/* Flame */}
                  <div
                    className="flame absolute"
                    style={{ left: 22, bottom: -8, width: 70, height: 90 }}
                  >
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background:
                          "radial-gradient(ellipse at 50% 20%, #fff6c8 0%, #ffd24a 20%, #ff7a1a 45%, #ff2a2a 70%, transparent 80%)",
                        filter: "blur(2px)",
                      }}
                    />
                  </div>
                  {/* glow halo */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 55%, rgba(255,80,80,0.45) 0%, transparent 60%)",
                      filter: "blur(8px)",
                    }}
                  />
                  <img
                    src={astronautSvg}
                    alt="Astronauta"
                    className="relative w-full drop-shadow-[0_0_24px_rgba(255,80,80,0.55)]"
                  />
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

        {/* Round status (floating, single line) */}
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm whitespace-nowrap">
            <div className="flex items-center gap-2 font-semibold min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${phase === "running" ? "bg-emerald-400" : "bg-rose-500"}`}
              />
              <span className="truncate uppercase tracking-wider text-purple-100/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                {phase === "betting" ? "Preparando ronda" : phase === "running" ? "En vuelo" : "Crash"}
              </span>
            </div>
            <span className="neon-red font-display text-base font-bold shrink-0">
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
              className="min-w-0 flex-1 rounded-lg border border-purple-500/30 bg-black/40 px-2 text-center font-display text-2xl font-bold text-white outline-none focus:border-purple-400/60 disabled:opacity-70 sm:text-3xl"
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

        {/* History */}
        <div className="mt-3 glass-panel rounded-xl p-3">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-purple-200/80">
            <Clock className="h-3.5 w-3.5" />
            Últimos Resultados
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {history.map((h) => (
              <div
                key={h.id}
                className={`shrink-0 rounded-md border px-3 py-1.5 font-display text-sm font-bold ${colorFor(h.value)}`}
              >
                {h.value.toFixed(2)}x
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}