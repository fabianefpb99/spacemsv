import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Settings, Clock, ArrowRight, Minus, Plus, Volume2, VolumeX, ChevronDown, ChevronUp } from "lucide-react";
import bgImage from "@/assets/space-bg-full.png";
import astronautIdlePng from "@/assets/astronaut-idle.svg";
import astronautFlyingSrc from "@/assets/astronaut-flying.png";
import meteorSrc from "@/assets/asteroid.svg";
import saturnSrc from "@/assets/saturn.svg";
import { startFlight, stopFlight, setMuted as setAudioMuted, playCrashSound, playCashoutSound } from "@/lib/gameAudio";
import bgMusicUrl from "@/assets/bg-music.mp3";

type Phase = "betting" | "running" | "crashed";
type HistoryItem = { id: number; value: number };

const MIN_BET = 500;
const MAX_BET = 100000;
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

const FLIGHT_MESSAGES_1_2X = [
  "¡Boff!",
  "¿Ya se bajaron? El viaje apenas comienza.",
  "¡Abran paso!",
  "Próxima parada: ¡El infinito!",
  "Cruzo el cosmos sin frenos.",
];
const FLIGHT_MESSAGES_2_2X = [
  "Dejé la Tierra atrás hace rato.",
  "¡Boff! ¡Qué vista!",
  "Esquivando satélites como si nada.",
];
const FLIGHT_MESSAGES_3_1X = [
  "Aquí es donde los miedosos empiezan a sudar.",
];
const FLIGHT_MESSAGES_6X = [
  "¡Esto va a estallar, pero en la cara de los que se bajaron!",
  "Los cobardes cobran en 2x, ¡los reales seguimos aquí!",
  "Te dije que no te bajaras.",
];

function getFlightTier(multiplier: number): 0 | 1 | 2 | 3 | 4 {
  if (multiplier >= 6) return 4;
  if (multiplier >= 3.1) return 3;
  if (multiplier >= 2.2) return 2;
  if (multiplier >= 1.2) return 1;
  return 0;
}

function pickFlightMessage(tier: 1 | 2 | 3 | 4): string {
  const pool =
    tier === 4 ? FLIGHT_MESSAGES_6X
    : tier === 3 ? FLIGHT_MESSAGES_3_1X
    : tier === 2 ? FLIGHT_MESSAGES_2_2X
    : FLIGHT_MESSAGES_1_2X;
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function colorFor(mult: number) {
  if (mult < 1.95) return "text-rose-400 border-rose-500/50 bg-rose-950/40";
  if (mult < 2.95) return "text-purple-300 border-purple-500/50 bg-purple-950/40";
  if (mult < 15) return "text-emerald-300 border-emerald-500/50 bg-emerald-950/40";
  return "text-amber-300 border-amber-400/60 bg-amber-950/40 shadow-[0_0_10px_rgba(251,191,36,0.45)]";
}

// Crash distribution: heavily weighted toward early crashes
// Tabla de probabilidades (acordada con el usuario):
//   Exacto 1.00x        -> 3.5%
//   1.00x  - 1.15x      -> 20%
//   1.15x  - 2.50x      -> 55%
//   2.50x  - 7.00x      -> 16%
//   7.00x  - 20.00x     -> 4.5%
//   20.00x - 50.00x     -> 0.8%
//   50.00x - 100.00x    -> 0.18%
//   100.00x (jackpot)   -> 0.02%
function generateCrashPoint(): number {
  const r = Math.random();
  // 3.5% fallo instantaneo exacto en 1.00x
  if (r < 0.035) return 1.0;
  // 20% zona 1.00x - 1.15x
  if (r < 0.235) return +(1.0 + Math.random() * 0.15).toFixed(2);
  // 55% zona 1.15x - 2.50x
  if (r < 0.785) return +(1.15 + Math.random() * 1.35).toFixed(2);
  // 16% zona 2.50x - 7.00x
  if (r < 0.945) return +(2.5 + Math.random() * 4.5).toFixed(2);
  // 4.5% zona 7.00x - 20.00x
  if (r < 0.990) return +(7.0 + Math.random() * 13).toFixed(2);
  // 0.8% zona 20.00x - 50.00x
  if (r < 0.998) return +(20.0 + Math.random() * 30).toFixed(2);
  // 0.18% zona 50.00x - 100.00x
  if (r < 0.9998) return +(50.0 + Math.random() * 50).toFixed(2);
  // 0.02% jackpot exacto 100.00x
  return 100.0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBackgroundShift(multiplier: number) {
  return `${clamp((multiplier - 1) / 9, 0, 1) * 40}%`;
}

function getStarShift(multiplier: number) {
  return `${clamp((multiplier - 1) * 7, 0, 90)}%`;
}

function getDarkOverlayOpacity(multiplier: number) {
  if (multiplier <= 1) return 0;
  if (multiplier <= 2) return ((multiplier - 1) / 1) * 0.35;
  if (multiplier <= 4) return 0.35 + ((multiplier - 2) / 2) * 0.3;
  if (multiplier <= 6) return 0.65 + ((multiplier - 4) / 2) * 0.2;
  if (multiplier <= 10) return 0.85 + ((multiplier - 6) / 4) * 0.13;
  return 0.98;
}

function getRedOverlayOpacity(multiplier: number) {
  return multiplier < 15 ? 0 : Math.min((multiplier - 15) / 5, 0.85);
}

function Stars({ multiplier = 1, phase }: { multiplier?: number; phase: Phase }) {
  const [data, setData] = useState<{
    stars: { id: number; top: number; left: number; size: number; delay: number; dur: number }[];
    shooters: { id: number; top: number; left: number; delay: number }[];
  } | null>(null);
  useEffect(() => {
    setData({
      stars: Array.from({ length: 35 }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        dur: 2 + Math.random() * 3,
      })),
      shooters: Array.from({ length: 2 }).map((_, i) => ({
        id: i,
        top: Math.random() * 40,
        left: 50 + Math.random() * 50,
        delay: i * 3 + Math.random() * 4,
      })),
    });
  }, []);
  if (!data) return <div className="pointer-events-none absolute inset-0 overflow-hidden" />;
  const { stars, shooters } = data;
  // Brightness / glow ramp with multiplier (estrellas más brillantes al subir)
  const bright = clamp((multiplier - 1) / 9, 0, 1); // 0 at 1x → 1 at 10x+
  const starOpacity = 0.75 + bright * 0.25;
  const glow = 6 + bright * 14; // px
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute left-0 right-0"
        style={{
          top: "-100%",
          height: "200%",
          transform: "translate3d(0, var(--star-shift, 0%), 0)",
          transition: phase === "running" ? "none" : "transform 600ms ease-out",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        {stars.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size + bright * 1.2,
              height: s.size + bright * 1.2,
              opacity: starOpacity,
              animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
              boxShadow: `0 0 ${glow}px rgba(255,255,255,${0.85 + bright * 0.15})`,
            }}
          />
        ))}
      </div>
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
  const [bettingBarFill, setBettingBarFill] = useState(0);
  const [bettingBarDuration, setBettingBarDuration] = useState(0);
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
  const [flightTier, setFlightTier] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [flightMessage, setFlightMessage] = useState<string | null>(null);
  const [meteors, setMeteors] = useState<{ id: number; threshold: number; topPct: number }[]>([]);
  const meteorFiredRef = useRef<Set<number>>(new Set());
  const [saturns, setSaturns] = useState<{ id: number; leftPct: number }[]>([]);
  const saturnFiredRef = useRef<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Background music (mp3) — starts on first user interaction (browsers require a gesture)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio(bgMusicUrl);
    audio.loop = true;
    audio.volume = 0.18;
    bgAudioRef.current = audio;
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
      audio.pause();
      bgAudioRef.current = null;
    };
  }, []);

  // Countdown SFX (3, 2, 1, go) synced with betting phase
  const audioContextRef = useRef<AudioContext | null>(null);
  const countdownFiredRef = useRef<Set<number>>(new Set());
  const sfxUnlockedRef = useRef(false);
  useEffect(() => {
    type WindowWithWebAudio = Window & typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };

    const unlock = async () => {
      const AudioContextCtor = window.AudioContext || (window as WindowWithWebAudio).webkitAudioContext;
      if (!AudioContextCtor) return;

      try {
        if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }
        sfxUnlockedRef.current = audioContextRef.current.state === "running";
      } catch {
        sfxUnlockedRef.current = false;
      }

      if (!sfxUnlockedRef.current) return;

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      sfxUnlockedRef.current = false;
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      ctx?.close().catch(() => {});
    };
  }, []);

  const playTone = useCallback((frequency: number, durationMs: number, volume: number, type: OscillatorType = "sine") => {
    if (muted || !sfxUnlockedRef.current) return;

    const ctx = audioContextRef.current;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  }, [muted]);

  const playBeep = useCallback(() => {
    // Matches the first 3 beeps of the reference audio (~1050 Hz sine, ~65 ms)
    playTone(1050, 70, 0.12, "sine");
  }, [playTone]);

  const playGo = useCallback(() => {
    if (muted || !sfxUnlockedRef.current) return;

    const ctx = audioContextRef.current;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Matches the final beep of the reference audio (~3350 Hz sine, ~60 ms, higher pitch)
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(3350, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.14, now + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.09);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  }, [muted]);

  // Flight whoosh while running
  useEffect(() => {
    if (phase === "running") startFlight();
    else stopFlight();
  }, [phase]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      setAudioMuted(next);
      if (bgAudioRef.current) bgAudioRef.current.muted = next;
      return next;
    });
  };

  // Show up to 2 idle messages per betting phase
  useEffect(() => {
    if (phase !== "betting") return;
    setMessageIdx(Math.floor(Math.random() * IDLE_MESSAGES.length));
    const id = setTimeout(() => {
      setMessageIdx((i) => (i + 1 + Math.floor(Math.random() * (IDLE_MESSAGES.length - 1))) % IDLE_MESSAGES.length);
    }, 4000);
    return () => clearTimeout(id);
  }, [phase]);

  // Flight messages: pick a new one each time the multiplier crosses a tier
  useEffect(() => {
    if (phase !== "running") {
      if (flightTier !== 0 || flightMessage !== null) {
        setFlightTier(0);
        setFlightMessage(null);
      }
      return;
    }
    const tier = getFlightTier(multiplier);
    if (tier !== flightTier) {
      setFlightTier(tier);
      setFlightMessage(tier === 0 ? null : pickFlightMessage(tier));
    }
  }, [multiplier, phase, flightTier, flightMessage]);

  // Meteor passes at 1.2x, 2x, 3x y luego cada 3x (6, 9, 12, ...) — uno por umbral por ronda
  useEffect(() => {
    if (phase !== "running") {
      if (meteorFiredRef.current.size > 0) meteorFiredRef.current = new Set();
      if (meteors.length > 0) setMeteors([]);
      return;
    }
    const thresholds: number[] = [1.2, 2, 3];
    for (let t = 6; t <= Math.floor(multiplier) + 3; t += 3) thresholds.push(t);
    for (const threshold of thresholds) {
      if (multiplier >= threshold && !meteorFiredRef.current.has(threshold)) {
        meteorFiredRef.current.add(threshold);
        const id = Date.now() + threshold * 1000;
        // Variar posición vertical: entre 25% y 38% del alto (un poco arriba del 1/3)
        const topPct = 25 + Math.random() * 13;
        setMeteors((m) => [...m, { id, threshold, topPct }]);
        setTimeout(() => {
          setMeteors((m) => m.filter((x) => x.id !== id));
        }, 2200);
      }
    }
  }, [multiplier, phase, meteors.length]);

  // Saturno pasa una vez por ronda al superar 9x
  useEffect(() => {
    if (phase !== "running") {
      if (saturnFiredRef.current) saturnFiredRef.current = false;
      if (saturns.length > 0) setSaturns([]);
      return;
    }
    if (multiplier >= 9 && !saturnFiredRef.current) {
      saturnFiredRef.current = true;
      const id = Date.now();
      const leftPct = 10 + Math.random() * 30;
      setSaturns((s) => [...s, { id, leftPct }]);
      setTimeout(() => {
        setSaturns((s) => s.filter((x) => x.id !== id));
      }, 5200);
    }
  }, [multiplier, phase, saturns.length]);

  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const bettingBarRafRef = useRef<number | null>(null);

  const updateSceneVisuals = useCallback((currentMultiplier: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.style.setProperty("--bg-shift", getBackgroundShift(currentMultiplier));
    scene.style.setProperty("--star-shift", getStarShift(currentMultiplier));
    scene.style.setProperty("--space-dark-opacity", `${getDarkOverlayOpacity(currentMultiplier)}`);
    scene.style.setProperty("--space-red-opacity", `${getRedOverlayOpacity(currentMultiplier)}`);
  }, []);

  useEffect(() => {
    if (phase !== "running") updateSceneVisuals(multiplier);
  }, [multiplier, phase, updateSceneVisuals]);

  // ---- Game loop ----
  const startBetting = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (phaseTimer.current) {
      clearTimeout(phaseTimer.current);
      phaseTimer.current = null;
    }
    if (bettingBarRafRef.current) cancelAnimationFrame(bettingBarRafRef.current);

    setPhase("betting");
    setMultiplier(1);
    setCashedOutAt(null);
    setActiveBet(null);
    setLastWin(null);
    setCrashPoint(generateCrashPoint());
    setCountdown(BETTING_MS / 1000);
    setBettingBarDuration(0);
    setBettingBarFill(0);
    countdownFiredRef.current = new Set();

    bettingBarRafRef.current = requestAnimationFrame(() => {
      bettingBarRafRef.current = requestAnimationFrame(() => {
        setBettingBarDuration(BETTING_MS);
        setBettingBarFill(100);
      });
    });

    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, BETTING_MS - elapsed);
      if (remaining > 0) {
        setCountdown(remaining / 1000);
        const fired = countdownFiredRef.current;
        const remSec = remaining / 1000;
        [3, 2, 1].forEach((n) => {
          if (!fired.has(n) && remSec <= n && remSec > n - 1) {
            fired.add(n);
            playBeep();
          }
        });
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCountdown(0);
        setBettingBarFill(100);
        if (!countdownFiredRef.current.has(0)) {
          countdownFiredRef.current.add(0);
          playGo();
        }
        startRunning();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [playBeep, playGo]);

  // keep crash point in ref so the rAF closure sees fresh value
  const crashPointRef = useRef(crashPoint);
  useEffect(() => {
    crashPointRef.current = crashPoint;
  }, [crashPoint]);

  const triggerCrash = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase("crashed");
    setMultiplier(crashPointRef.current);
    setHistory((h) => [{ id: Date.now(), value: crashPointRef.current }, ...h].slice(0, 50));
    playCrashSound();
    // Duck background music during crash
    const bg = bgAudioRef.current;
    if (bg && !muted) {
      const startVol = bg.volume;
      bg.volume = 0.04;
      window.setTimeout(() => {
        if (!bgAudioRef.current) return;
        const target = 0.18;
        const steps = 20;
        let i = 0;
        const from = bgAudioRef.current.volume;
        const iv = window.setInterval(() => {
          i++;
          if (!bgAudioRef.current) { window.clearInterval(iv); return; }
          bgAudioRef.current.volume = from + (target - from) * (i / steps);
          if (i >= steps) window.clearInterval(iv);
        }, 60);
      }, 1800);
    }
    phaseTimer.current = setTimeout(() => {
      startBetting();
    }, CRASH_HOLD_MS);
  }, [startBetting]);

  const startRunning = useCallback(() => {
    setPhase("running");
    startRef.current = performance.now();
    let lastShown = 0;
    let frameCount = 0;
    const tick = () => {
      const t = (performance.now() - startRef.current) / 1000;
      // Exponential-ish growth, feels like crash games
      const exactMultiplier = Math.pow(Math.E, 0.09 * t);
      const shownMultiplier = +exactMultiplier.toFixed(2);
      // Throttle CSS variable writes to every 3rd frame (~20fps) to reduce GPU/CPU load on mobile
      frameCount++;
      if (frameCount % 3 === 0) {
        updateSceneVisuals(exactMultiplier);
      }
      // Only trigger React re-render when the displayed value actually changes
      if (shownMultiplier !== lastShown) {
        lastShown = shownMultiplier;
        setMultiplier(shownMultiplier);
      }
      if (exactMultiplier >= crashPointRef.current) {
        triggerCrash();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [triggerCrash, updateSceneVisuals]);

  // bootstrap
  useEffect(() => {
    setCrashPoint(generateCrashPoint());
    setOnline(80 + Math.floor(Math.random() * 200));
    startBetting();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (phaseTimer.current) clearTimeout(phaseTimer.current);
      if (bettingBarRafRef.current) cancelAnimationFrame(bettingBarRafRef.current);
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
    setBet((b) => Math.min(Math.min(balance, MAX_BET), b + amount));
  };

  const countdownLabel = Math.min(BETTING_MS / 1000, Math.max(1, Math.ceil(countdown)));

  // ---- Render ----
  const buttonState = (() => {
    if (phase === "running" && activeBet != null && cashedOutAt == null) {
      const profit = activeBet * (multiplier - 1);
      return { label: `RETIRAR  +${formatCOP(profit)}`, cls: "btn-primary-red", disabled: false, key: "cashout" };
    }
    if (phase === "betting") {
      return { label: activeBet ? "APUESTA REGISTRADA" : "APOSTAR", cls: "btn-primary-green", disabled: !!activeBet || bet < MIN_BET || bet > balance, key: activeBet ? "registered" : "bet" };
    }
    return { label: "ESPERANDO RONDA", cls: "btn-primary-green opacity-50 brightness-75", disabled: true, key: "waiting" };
  })();

  return (
    <div
      ref={sceneRef}
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{
        ["--bg-shift" as string]: getBackgroundShift(multiplier),
        ["--star-shift" as string]: getStarShift(multiplier),
        ["--space-dark-opacity" as string]: getDarkOverlayOpacity(multiplier),
        ["--space-red-opacity" as string]: getRedOverlayOpacity(multiplier),
      }}
    >
      {/* Fondo único — inicia mostrando el planeta inferior. Al subir el
          multiplicador el fondo se desliza hacia abajo hasta máx. 40% de
          su altura, sin llegar a mostrar el planeta superior. Se escala el
          ancho a 150vw para que la imagen sea más alta que el viewport y
          el desplazamiento de 40% mantenga el planeta de arriba oculto. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute bottom-0 left-1/2"
          style={{
            width: "150vw",
            aspectRatio: "544 / 1920",
            transform: "translate3d(-50%, var(--bg-shift, 0%), 0)",
            transition: phase === "running" ? "none" : "transform 700ms ease-out",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          <img
            src={bgImage}
            alt=""
            className="block h-full w-full object-cover"
            draggable={false}
          />
        </div>
      </div>
      {/* Base legibility gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1a0833]/40 via-[#160730]/30 to-[#0d0420]/80" />
      {/* Deep-space darkening — negro puro, más agresivo y temprano */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 65%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,1) 90%)",
          opacity: "var(--space-dark-opacity, 0)",
          transition: phase === "running" ? "none" : "opacity 250ms ease-out",
        }}
      />
      {/* Red dark overlay after 15x */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 65%, rgba(80,10,10,0.4) 0%, rgba(40,5,5,0.75) 45%, rgba(10,0,0,0.95) 90%)",
          opacity: "var(--space-red-opacity, 0)",
          transition: phase === "running" ? "none" : "opacity 400ms ease-out",
        }}
      />
      <Stars multiplier={multiplier} phase={phase} />

      {/* Meteoritos que cruzan la pantalla en 1.2x, 2x, 3x y luego cada 3x */}
      {meteors.map((m) => (
        <div
          key={m.id}
          aria-hidden
          className="pointer-events-none absolute left-1/2 h-12 w-12 sm:h-16 sm:w-16"
          style={{
            top: `${m.topPct}%`,
            animation: "meteor-cross 2.2s linear forwards",
            zIndex: 0,
          }}
        >
          <img
            src={meteorSrc}
            alt=""
            className="h-full w-full"
            style={{
              animation: "meteor-spin 1.8s linear infinite",
              filter: "drop-shadow(0 0 8px rgba(180,200,220,0.45))",
            }}
          />
        </div>
      ))}

      {/* Saturno cruza/cae al pasar 14.9x */}
      {saturns.map((s) => (
        <div
          key={s.id}
          aria-hidden
          className="pointer-events-none absolute h-40 w-40 sm:h-56 sm:w-56"
          style={{
            top: "-10%",
            left: `${s.leftPct}%`,
            animation: "saturn-fall 5.2s linear forwards",
            zIndex: 0,
          }}
        >
          <img
            src={saturnSrc}
            alt=""
            className="h-full w-full"
            style={{
              animation: "saturn-spin 14s linear infinite",
              filter: "drop-shadow(0 0 18px rgba(240,200,140,0.45))",
            }}
          />
        </div>
      ))}

      <div
        className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pt-4 sm:max-w-lg sm:px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) * 0.85 + 1.05rem)" }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <button className="rounded-md p-2 text-white hover:bg-white/10">
            <Menu className="h-7 w-7" strokeWidth={3} />
          </button>
          <Link to="/">
            <h1 className="font-display text-sm font-black leading-tight tracking-widest sm:text-base cursor-pointer">
              BETSPACEMAN
            </h1>
          </Link>
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

        {/* Stage */}
        <section className="relative mt-3 flex-1">
          {/* online + mute */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="font-semibold text-white/90">{online} ONLINE</span>
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
              {/* Flight messages: appear during running phase, lower-right so they don't cover the rocket */}
              <div
                className={`pointer-events-none absolute z-20 bottom-2 sm:bottom-4 left-[50%] right-[14%] sm:left-[48%] sm:right-[16%] flex items-end justify-end transition-opacity duration-300 ${
                  phase === "running" && flightMessage ? "opacity-100" : "opacity-0"
                }`}
              >
                {flightMessage && (
                  <div key={`${flightTier}-${flightMessage}`} className="relative animate-[msg-in_.45s_ease-out]">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-2 rounded-xl bg-fuchsia-500/20 blur-xl animate-[msg-pulse_2.2s_ease-in-out_infinite]"
                    />
                    <p
                      className="relative font-display text-[11px] sm:text-[13px] font-bold italic leading-tight text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] animate-[msg-beat_2.2s_ease-in-out_infinite] text-right [text-wrap:balance]"
                      style={{ textShadow: "0 0 12px rgba(180,140,255,0.55)" }}
                    >
                      {flightMessage}
                    </p>
                  </div>
                )}
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
              {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-8 w-px bg-gradient-to-b from-transparent via-white/70 to-transparent"
                      style={{
                        left: `${15 + i * 20}%`,
                        top: 0,
                        animation: `speed-line ${0.5 + (i % 3) * 0.15}s linear ${i * 0.12}s infinite`,
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
              <div className="result-pop-win absolute right-2 top-0 rounded-lg border border-emerald-400/50 bg-emerald-950/60 px-3 py-2 text-right shadow-lg">
                <div className="text-[10px] uppercase tracking-wider text-emerald-200">
                  Retirado a {cashedOutAt.toFixed(2)}x
                </div>
                <div className="neon-green font-display text-lg font-bold">
                  +{formatCOP(lastWin)} COP
                </div>
              </div>
            )}

            {phase === "crashed" && activeBet != null && cashedOutAt == null && (
              <div className="result-pop-lose absolute right-2 top-0 rounded-lg border border-rose-500/60 bg-rose-950/70 px-3 py-2 text-right">
                <div className="text-[10px] uppercase tracking-wider text-rose-200">Resultado</div>
                <div className="font-display text-lg font-bold text-rose-300">PERDISTE</div>
              </div>
            )}
          </div>
        </section>

        {/* Round status (fixed height to prevent layout shifts) */}
        <div className="mt-2 px-1 h-[30px]">
          <div className="flex h-5 items-center justify-between gap-3 text-xs sm:text-sm whitespace-nowrap">
            <div className="flex items-center gap-2 font-semibold min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${phase === "running" ? "bg-emerald-400" : "bg-rose-500"}`}
              />
              <span className="truncate uppercase tracking-wider text-purple-100/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                {phase === "betting" ? "¡Apuestas abiertas!" : phase === "running" ? "En vuelo" : "Crash"}
              </span>
            </div>
            <span className="neon-red font-display text-base font-bold shrink-0 tabular-nums w-12 text-right brightness-125">
              {phase === "betting" ? `${countdownLabel}s` : ""}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-purple-950/60">
            <div
              className="h-full rounded-full transition-[width] ease-linear"
              style={{
                width: `${bettingBarFill}%`,
                background:
                  "repeating-linear-gradient(45deg,#ff4d4d,#ff4d4d 10px,#c91f1f 10px,#c91f1f 20px)",
                boxShadow: "0 0 10px rgba(255,80,80,0.40)",
                transitionDuration: `${bettingBarDuration}ms`,
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
              type="text"
              value={formatCOP(bet)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                const n = parseInt(digits || "0", 10);
                setBet(Math.min(MAX_BET, Math.max(0, n)));
              }}
              disabled={!!activeBet}
              inputMode="numeric"
              className="no-spinner min-w-0 flex-1 rounded-lg border border-purple-500/30 bg-black/40 px-2 text-center font-display text-2xl font-bold text-white outline-none focus:border-purple-400/60 disabled:opacity-70 sm:text-3xl"
            />
            <button
              className="btn-bet flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-2xl font-black sm:h-16 sm:w-16"
              onClick={() => setBet((b) => Math.min(Math.min(balance, MAX_BET), b + BET_STEP))}
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
            key={buttonState.key}
            onClick={handleBetClick}
            disabled={buttonState.disabled}
            className={`btn-primary-action btn-pop-in mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2 font-display text-lg font-black uppercase sm:py-2.5 sm:text-xl ${buttonState.cls} disabled:cursor-not-allowed`}
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
            h.value >= 15 ? (
              <div key={h.id} className="shrink-0 jackpot-chip rounded">
                <div className="rounded-[3px] px-1.5 py-0.5 font-display text-[10px] font-bold leading-none text-amber-100 bg-amber-950/60 drop-shadow-[0_1px_0_rgba(120,60,0,0.9)]" style={{ textShadow: '0 -1px 0 rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.25)' }}>
                  {h.value.toFixed(2)}x
                </div>
              </div>
            ) : (
              <div
                key={h.id}
                className={`shrink-0 rounded border px-1.5 py-0.5 font-display text-[10px] font-bold leading-none ${colorFor(h.value)}`}
              >
                {h.value.toFixed(2)}x
              </div>
            )
          ))}
        </div>
      </div>

    </div>
  );
}