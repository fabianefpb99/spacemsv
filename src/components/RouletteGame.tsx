import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import betspaceLogo from "@/assets/betspace-logo.svg";
import rouletteScene from "@/assets/roulette-scene-v2.png.asset.json";
import { AuthControl } from "@/components/auth/AuthControl";
import { BetAmount } from "@/components/games/BetAmount";
import { FitText } from "@/components/ui/fit-text";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { clampBetToStep } from "@/lib/games/bet-helpers";
import mafiaJazzUrl from "@/assets/mafia-jazz.mp3";
import congratulationsAudio from "@/assets/audio/roulette-win/congratulations.mp3.asset.json";
import {
  setBackgroundTrack,
  clearBackgroundTrack,
  getBackgroundTrack,
  stopAllGameAudio,
  AUDIO_STOP_ALL_EVENT,
} from "@/lib/gameAudio";

type Choice = "red" | "black" | "green";
type Phase = "idle" | "spinning" | "revealing";
type HistoryEntry = { segment: number; color: Choice };

const MIN_BET = 500;
const MAX_BET = 500000;
const BET_STEP = 500;
const QUICK_ADDS = [1000, 2000, 5000, 10000];

// Calibración de la rueda sobre el fondo v2 (escena 942x1672, ratio 9:16)
// El fondo v2 tiene un hueco circular vacío donde encaja la rueda funcional.
// Medidas extraídas pixel-perfect del PNG.
const WHEEL_CX_PCT = 49.0;     // % del ancho — centro horizontal del hueco (ajustado a la flecha del fondo)
const WHEEL_CY_PCT = 43.99;    // % del alto  — centro vertical del hueco
const WHEEL_DIAM_PCT = 65.5;   // % del ancho — diámetro del hueco (encaja con el aro dorado)

// European single-zero wheel order, clockwise starting at 0 (top)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SEG_COUNT = 37;
const SEG_DEG = 360 / SEG_COUNT;
const SPIN_DURATION_MS = 10500;
const EXTRA_SPINS = 4;

const WIN_AUDIO_URLS = [congratulationsAudio.url];

function colorOf(n: number): Choice {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

// SVG arc path for a segment on a ring of radius R..r centered at (cx,cy)
function segmentPath(cx: number, cy: number, R: number, r: number, startDeg: number, endDeg: number) {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const a1 = toRad(startDeg);
  const a2 = toRad(endDeg);
  const x1o = cx + R * Math.cos(a1);
  const y1o = cy + R * Math.sin(a1);
  const x2o = cx + R * Math.cos(a2);
  const y2o = cy + R * Math.sin(a2);
  const x1i = cx + r * Math.cos(a1);
  const y1i = cy + r * Math.sin(a1);
  const x2i = cx + r * Math.cos(a2);
  const y2i = cy + r * Math.sin(a2);
  return `M ${x1o} ${y1o} A ${R} ${R} 0 0 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${r} ${r} 0 0 0 ${x1i} ${y1i} Z`;
}

function RouletteWheel({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  const cx = 200;
  const cy = 200;
  const R = 195; // outer (llena el hueco del aro dorado del fondo)
  const r = 70;  // inner (espacio para el eje/hub central de la rueda)
  const textR = R * 0.86; // números cerca del borde exterior (no en el centro)

  const segments = useMemo(() => {
    return WHEEL_ORDER.map((num, i) => {
      const start = i * SEG_DEG - SEG_DEG / 2;
      const end = start + SEG_DEG;
      const color = colorOf(num);
      const fill =
        color === "red" ? "url(#segRed)" : color === "black" ? "url(#segBlack)" : "url(#segGreen)";
      const mid = i * SEG_DEG;
      const rad = ((mid - 90) * Math.PI) / 180;
      const tx = cx + textR * Math.cos(rad);
      const ty = cy + textR * Math.sin(rad);
      return { num, start, end, fill, mid, tx, ty };
    });
  }, []);

  return (
    <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id="segRed" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id="segBlack" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#1f1f1f" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <radialGradient id="segGreen" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
      </defs>
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "200px 200px",
          transition: spinning
            ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.33, 0.1, 0.25, 1)`
            : "none",
          willChange: "transform",
        }}
      >
        {segments.map((s) => (
          <path key={s.num} d={segmentPath(cx, cy, R, r, s.start, s.end)} fill={s.fill} stroke="#d4a017" strokeWidth={0.7} />
        ))}
        {segments.map((s) => (
          <text
            key={`t-${s.num}`}
            x={s.tx}
            y={s.ty}
            fill="#fff"
            fontSize={13}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(${s.mid + 180} ${s.tx} ${s.ty})`}
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)", userSelect: "none" }}
          >
            {s.num}
          </text>
        ))}
      </g>
      {/* Hub central fijo (no rota) */}
      <circle cx={cx} cy={cy} r={r - 4} fill="url(#hubGrad)" stroke="#d4a017" strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={r - 18} fill="#1a0a2e" stroke="#a78bfa" strokeWidth={0.8} opacity={0.9} />
      {/* Logo BETSPACE tallado en el hub central */}
      <image
        href={betspaceLogo}
        x={cx - 46}
        y={cy - 12}
        width={92}
        height={24}
        opacity={0.9}
        style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.85))", pointerEvents: "none" }}
      />
      {/* Destello periódico recorriendo el logo */}
      <defs>
        <mask id="bsLogoMask" maskUnits="userSpaceOnUse">
          <image
            href={betspaceLogo}
            x={cx - 46}
            y={cy - 12}
            width={92}
            height={24}
          />
        </mask>
        <linearGradient id="bsShimmer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g mask="url(#bsLogoMask)" style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
        <rect y={cy - 12} width={26} height={24} fill="url(#bsShimmer)">
          <animate
            attributeName="x"
            dur="4s"
            repeatCount="indefinite"
            values={`${cx - 72};${cx + 46};${cx + 46}`}
            keyTimes="0;0.35;1"
          />
        </rect>
      </g>
      <defs>
        <radialGradient id="hubGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#3b1f5e" />
          <stop offset="100%" stopColor="#0d0420" />
        </radialGradient>
      </defs>
      {/* Puntero/flecha arriba (fija) */}
      <polygon points="200,2 192,22 208,22" fill="#facc15" stroke="#7c2d12" strokeWidth={1} />
    </svg>
  );
}

export function RouletteGame() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const meQuery = useMe();
  const realBalance = meQuery.data?.balance ?? 0;
  const bonusBalance = meQuery.data?.bonus_balance ?? 0;
  const balance = realBalance + bonusBalance;
  const balanceReady = !!meQuery.data;

  const [bet, setBet] = useState(2000);
  const [choice, setChoice] = useState<Choice>("red");
  const [phase, setPhase] = useState<Phase>("idle");
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const [online] = useState(150);
  const [lastResult, setLastResult] = useState<{ segment: number; color: Choice; won: boolean; payout: number } | null>(null);

  const inFlightRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickTimersRef = useRef<number[]>([]);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopWinAudio = useCallback(() => {
    const a = winAudioRef.current;
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {}
    winAudioRef.current = null;
  }, []);

  const playWinAudio = useCallback(() => {
    if (muted) return;
    if (typeof window === "undefined") return;
    if (WIN_AUDIO_URLS.length === 0) return;
    stopWinAudio();
    const url = WIN_AUDIO_URLS[Math.floor(Math.random() * WIN_AUDIO_URLS.length)];
    const audio = new Audio(url);
    audio.volume = 0.45;
    audio.playbackRate = 1.21;
    winAudioRef.current = audio;
    audio.play().catch(() => {});
  }, [muted, stopWinAudio]);

  // Detener el audio de victoria al salir / cambiar pestaña / desmontar
  useEffect(() => {
    const onHide = () => stopWinAudio();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("blur", onHide);
    document.addEventListener("visibilitychange", onHide);
    const onStopAll = () => stopWinAudio();
    window.addEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("blur", onHide);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
      stopWinAudio();
    };
  }, [stopWinAudio]);

  useEffect(() => {
    if (muted) stopWinAudio();
  }, [muted, stopWinAudio]);

  // Hydrate history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("betspaceman:roulette:history");
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistory(parsed);
          return;
        }
      }
      // Sin historial real: pre-llenar con tiros simulados para que no se vea vacío
      const seeded: HistoryEntry[] = Array.from({ length: 12 }, () => {
        const segment = WHEEL_ORDER[Math.floor(Math.random() * WHEEL_ORDER.length)];
        return { segment, color: colorOf(segment) };
      });
      setHistory(seeded);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("betspaceman:roulette:history", JSON.stringify(history.slice(0, 30)));
    } catch {}
  }, [history]);

  // Música de fondo (misma pista que SLOT) — volumen bien bajo.
  useEffect(() => {
    stopAllGameAudio();
    const stopOnBackground = () => {
      clearBackgroundTrack();
    };
    const onStopAll = () => {};
    window.addEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
    window.addEventListener("pagehide", stopOnBackground);
    window.addEventListener("blur", stopOnBackground);
    document.addEventListener("visibilitychange", stopOnBackground);
    const audio = setBackgroundTrack(mafiaJazzUrl, { volume: 0.02, loop: true });
    if (!audio) {
      return () => {
        window.removeEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
        window.removeEventListener("pagehide", stopOnBackground);
        window.removeEventListener("blur", stopOnBackground);
        document.removeEventListener("visibilitychange", stopOnBackground);
      };
    }
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
      window.removeEventListener(AUDIO_STOP_ALL_EVENT, onStopAll);
      clearBackgroundTrack();
    };
  }, []);

  useEffect(() => {
    const audio = getBackgroundTrack();
    if (!audio) return;
    audio.muted = muted;
    if (muted) audio.pause();
    else audio.play().catch(() => {});
  }, [muted]);

  // Unlock audio on first gesture
  useEffect(() => {
    const unlock = () => {
      type WindowWithWebAudio = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext || (window as WindowWithWebAudio).webkitAudioContext;
      if (!Ctor) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      audioCtxRef.current.resume().catch(() => {});
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      tickTimersRef.current.forEach((t) => window.clearTimeout(t));
      tickTimersRef.current = [];
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  const playTick = useCallback(() => {
    if (muted) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }, [muted]);

  const playResult = useCallback((won: boolean) => {
    if (muted) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(won ? 880 : 220, now);
    if (won) osc.frequency.exponentialRampToValueAtTime(1480, now + 0.25);
    else osc.frequency.exponentialRampToValueAtTime(120, now + 0.4);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(won ? 0.05 : 0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (won ? 0.45 : 0.5));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }, [muted]);

  const adjustBet = (delta: number) => {
    setBet((b) => clampBetToStep(b + delta, balance, MAX_BET, BET_STEP, MIN_BET));
  };

  const handleSpin = useCallback(async () => {
    if (inFlightRef.current || phase !== "idle") return;
    if (!user) {
      toast.error("Inicia sesión para jugar");
      return;
    }
    if (bet > balance) {
      toast.error("Saldo insuficiente");
      return;
    }
    if (bet < MIN_BET || bet % BET_STEP !== 0) {
      toast.error(`Apuesta inválida (mínimo ${formatCOP(MIN_BET)}, paso ${formatCOP(BET_STEP)})`);
      return;
    }

    inFlightRef.current = true;
    setPhase("spinning");
    setLastResult(null);

    const actionId = crypto.randomUUID();
    try {
      const { data, error } = await supabase.rpc("spin_roulette_v1", {
        p_user_id: user.id,
        p_bet_amount: bet,
        p_choice: choice,
        p_client_action_id: actionId,
      });
      if (error) throw error;
      const result = (data as { cached: { winning_segment: number; winning_color: Choice; won: boolean; payout: number } }).cached;

      // Refrescar balance
      queryClient.invalidateQueries({ queryKey: ["me"] });

      // Calcular rotación final: winning segment debe terminar arriba
      const segIndex = WHEEL_ORDER.indexOf(result.winning_segment);
      const jitter = (Math.random() - 0.5) * (SEG_DEG * 0.6);
      const currentRotation = rotation;
      const currentMod = ((currentRotation % 360) + 360) % 360;
      // Queremos terminar con rotación final tal que (segIndex*SEG_DEG + finalRot) ≡ 0 (mod 360)
      // => finalRotMod = (360 - segIndex*SEG_DEG) mod 360
      const targetMod = (360 - segIndex * SEG_DEG) % 360;
      const delta = ((targetMod - currentMod + 360) % 360) + EXTRA_SPINS * 360 + jitter;
      const finalRotation = currentRotation + delta;
      setRotation(finalRotation);

      // Programar ticks aproximados a la velocidad angular (sampling cubic-bezier)
      tickTimersRef.current.forEach((t) => window.clearTimeout(t));
      tickTimersRef.current = [];
      // Sincronizar ticks con la curva real cubic-bezier(0.33, 0.1, 0.25, 1)
      // Un tick por cada N grados recorridos => muestreamos la bezier y disparamos
      // cuando el progreso angular cruza cada umbral.
      const totalRotationDeg = Math.abs(delta);
      const degPerTick = 26; // ~14 ticks por vuelta — sensación realista
      const totalTicks = Math.max(6, Math.floor(totalRotationDeg / degPerTick));
      // Bezier helper (x = tiempo normalizado, y = progreso). Resolvemos x para y dado.
      const bezier = (t: number, p1: number, p2: number) => {
        const u = 1 - t;
        return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
      };
      const cx1 = 0.33, cx2 = 0.25, cy1 = 0.1, cy2 = 1;
      const solveTimeForProgress = (target: number) => {
        // Bisección en t (0..1) para que bezier_y(t) == target
        let lo = 0, hi = 1;
        for (let k = 0; k < 22; k++) {
          const mid = (lo + hi) / 2;
          const y = bezier(mid, cy1, cy2);
          if (y < target) lo = mid; else hi = mid;
        }
        const tNorm = (lo + hi) / 2;
        // Convertir tNorm (param bezier) a tiempo real usando coord x
        return bezier(tNorm, cx1, cx2);
      };
      for (let i = 1; i <= totalTicks; i++) {
        const target = i / totalTicks;
        const tFrac = solveTimeForProgress(target);
        const at = window.setTimeout(playTick, tFrac * SPIN_DURATION_MS);
        tickTimersRef.current.push(at);
      }

      // Disparar el audio de victoria un poco antes de que termine el giro
      if (result.won) {
        const winAt = window.setTimeout(playWinAudio, Math.max(0, SPIN_DURATION_MS - 700));
        tickTimersRef.current.push(winAt);
      }

      // Al terminar la animación
      window.setTimeout(() => {
        setPhase("revealing");
        setLastResult({
          segment: result.winning_segment,
          color: result.winning_color,
          won: result.won,
          payout: Number(result.payout) || 0,
        });
        setHistory((h) => [{ segment: result.winning_segment, color: result.winning_color }, ...h].slice(0, 30));
        playResult(result.won);
        if (result.won) {
          toast.success(`¡Ganaste! +${formatCOP(Number(result.payout) || 0)} COP`);
        } else {
          toast(`Salió ${result.winning_segment} ${result.winning_color === "red" ? "rojo" : result.winning_color === "black" ? "negro" : "verde"}`, {
            description: "Suerte para la próxima",
          });
        }
        // Volver a idle tras un breve reveal
        window.setTimeout(() => {
          setPhase("idle");
          inFlightRef.current = false;
        }, 1800);
      }, SPIN_DURATION_MS + 50);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`No se pudo girar: ${msg}`);
      setPhase("idle");
      inFlightRef.current = false;
    }
  }, [user, bet, balance, choice, phase, rotation, queryClient, playTick, playResult]);

  const canSpin = phase === "idle" && balanceReady && bet <= balance;

  return (
    <div
      className="relative mx-auto flex h-[100dvh] max-w-md flex-col px-3 pt-4 sm:max-w-lg sm:px-4 text-white overflow-hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) * 0.85 + 0.6rem)" }}
    >
      {/* ───────────────── FONDO COMPLETO DE LA ESCENA (idéntico patrón Spaceman) ───────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#06010f]">
        <img
          src={rouletteScene.url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      </div>

      {/* ───────────────── RUEDA FUNCIONAL anclada al aro pintado ─────────────────
          El fondo usa object-cover y en mobile (viewport más estrecho que 942/1672)
          se escala por altura. Eso fija matemáticamente el centro vertical al 43.99%
          del alto del viewport, el centro horizontal al 50% (recorte simétrico),
          y el diámetro a 65.5% del ancho renderizado del PNG = 100dvh × (942/1672) × 0.655 */}
      <div
        className="pointer-events-none fixed left-1/2 -translate-x-1/2 -translate-y-1/2 z-0"
        style={{
          top: `${WHEEL_CY_PCT}dvh`,
          width: `calc(100dvh * (942 / 1672) * ${WHEEL_DIAM_PCT / 100})`,
          aspectRatio: "1 / 1",
        }}
      >
        <RouletteWheel rotation={rotation} spinning={phase === "spinning"} />
      </div>

      {/* ───────────────── HEADER GLOBAL ───────────────── */}
      <header
        className="relative z-10 flex items-center justify-between bg-[#06010f]/85 backdrop-blur-sm border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
      >
        <div className="flex items-center gap-1">
          <button className="rounded-md p-2 text-white hover:bg-white/10" aria-label="Menú">
            <Menu className="h-7 w-7" strokeWidth={3} />
          </button>
          <Link to="/">
            <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7 cursor-pointer" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
            <div className="font-display text-[11px] font-bold sm:text-xs text-white">
              <span className="neon-green mr-0.5">$</span>
              {balanceReady ? formatCOP(balance) : "—"} COP
            </div>
          </div>
          <AuthControl />
        </div>
      </header>

      {/* ───────────────── ONLINE + MUTE ───────────────── */}
      <div className="relative z-10 mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-semibold text-white/90">{online} ONLINE</span>
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Activar sonido" : "Silenciar"}
          className="rounded-md p-1 text-purple-200/80 hover:bg-white/5"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Espaciador flexible: deja ver el fondo y la rueda */}
      <div className="flex-1 min-h-0" />

      {/* ───────────────── HISTORIAL — encima del HUD ───────────────── */}
      <div className="relative z-10 mt-2 flex items-center gap-2 rounded-full border border-purple-400/30 bg-black/55 px-3 py-1.5 backdrop-blur-sm">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-200/80">Últimos</span>
        <div className="flex flex-1 items-center gap-1.5 overflow-hidden pr-1">
          {history.length === 0 ? (
            <span className="text-[11px] italic text-white/40">sin giros aún</span>
          ) : (
            history.slice(0, 9).map((h, i) => (
              <div
                key={i}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-black/60 ${
                  h.color === "red"
                    ? "bg-rose-600 text-white"
                    : h.color === "black"
                      ? "bg-zinc-900 text-white"
                      : "bg-emerald-600 text-white"
                }`}
                title={`${h.segment} ${h.color}`}
              >
                {h.segment}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ───────────────── HUD inferior ───────────────── */}
      <div className="relative z-10 mt-2 space-y-2.5 rounded-2xl border border-purple-400/30 bg-gradient-to-b from-[#1a0833]/85 to-[#0a0118]/90 p-3 shadow-[0_-4px_20px_rgba(124,58,237,0.25)] backdrop-blur-md">
        {/* Botones de elección — 3 en una fila */}
        <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setChoice("red")}
              disabled={phase !== "idle"}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 py-2.5 transition-all disabled:opacity-60 ${
                choice === "red"
                  ? "border-red-300 bg-gradient-to-br from-red-600 to-red-800 shadow-[0_0_14px_rgba(239,68,68,0.6)]"
                  : "border-red-500/30 bg-red-950/40 opacity-75 backdrop-blur-sm hover:opacity-95 hover:bg-red-900/50"
              }`}
            >
              <span className="font-display text-base font-black leading-tight">ROJO</span>
              <span className="text-[11px] font-bold text-rose-100/90 leading-none">1.95x</span>
            </button>
            <button
              onClick={() => setChoice("black")}
              disabled={phase !== "idle"}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 py-2.5 transition-all disabled:opacity-60 ${
                choice === "black"
                  ? "border-white/70 bg-gradient-to-br from-zinc-700 to-zinc-950 shadow-[0_0_14px_rgba(255,255,255,0.25)]"
                  : "border-white/20 bg-zinc-900/50 opacity-75 backdrop-blur-sm hover:opacity-95 hover:bg-zinc-800/60"
              }`}
            >
              <span className="font-display text-base font-black leading-tight">NEGRO</span>
              <span className="text-[11px] font-bold text-white/80 leading-none">1.95x</span>
            </button>
            <button
              onClick={() => setChoice("green")}
              disabled={phase !== "idle"}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 py-2.5 transition-all disabled:opacity-60 ${
                choice === "green"
                  ? "border-emerald-300 bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-[0_0_14px_rgba(16,185,129,0.6)]"
                  : "border-emerald-500/30 bg-emerald-950/40 opacity-75 backdrop-blur-sm hover:opacity-95 hover:bg-emerald-900/50"
              }`}
            >
              <span className="font-display text-base font-black leading-tight">VERDE</span>
              <span className="text-[11px] font-bold text-emerald-100/90 leading-none">14.00x</span>
            </button>
          </div>

          {/* Stepper + GIRAR — una sola fila compacta */}
          <div className="flex items-stretch gap-2">
            <button
              onClick={() => adjustBet(-BET_STEP)}
              disabled={phase !== "idle"}
              className="flex h-14 w-12 items-center justify-center rounded-xl border border-purple-400/40 bg-purple-950/60 text-2xl font-bold text-white backdrop-blur-sm hover:bg-purple-900/60 disabled:opacity-50"
              aria-label="Disminuir"
            >
              −
            </button>
            <div className="flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl border border-purple-400/40 bg-black/60 px-2 backdrop-blur-sm">
              <BetAmount
                bet={bet}
                bonusBalance={bonusBalance}
                amountClassName="font-display text-xl font-bold tracking-wide text-white"
              />
            </div>
            <button
              onClick={() => adjustBet(BET_STEP)}
              disabled={phase !== "idle"}
              className="flex h-14 w-12 items-center justify-center rounded-xl border border-purple-400/40 bg-purple-950/60 text-2xl font-bold text-white backdrop-blur-sm hover:bg-purple-900/60 disabled:opacity-50"
              aria-label="Aumentar"
            >
              +
            </button>
            <button
              onClick={handleSpin}
              disabled={!canSpin}
              className={`h-14 flex-[1.6] rounded-xl font-display text-lg font-black uppercase tracking-wider transition-all ${
                canSpin
                  ? "bg-gradient-to-b from-emerald-400 to-emerald-700 text-white shadow-[0_3px_14px_rgba(16,185,129,0.55)] active:scale-[0.98]"
                  : "bg-zinc-800/80 text-white/40 cursor-not-allowed"
              }`}
            >
              {phase === "spinning" ? "GIRANDO…" : "GIRAR"}
            </button>
          </div>

          {/* Atajos rápidos: X2 + sumas frecuentes */}
          <div className="grid grid-cols-5 gap-1.5">
            <button
              onClick={() => setBet((b) => clampBetToStep(b * 2, balance, MAX_BET, BET_STEP, MIN_BET))}
              disabled={phase !== "idle"}
              className="rounded-lg border border-purple-400/40 bg-purple-950/60 py-1.5 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur-sm hover:bg-purple-900/60 disabled:opacity-50"
              aria-label="Doblar apuesta"
              title="Doblar apuesta"
            >
              X2
            </button>
            {QUICK_ADDS.map((amt) => (
              <button
                key={amt}
                onClick={() => adjustBet(amt)}
                disabled={phase !== "idle"}
                className="rounded-lg border border-purple-400/40 bg-purple-950/60 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm hover:bg-purple-900/60 disabled:opacity-50"
              >
                +{amt >= 1000 ? `${amt / 1000}K` : amt}
              </button>
            ))}
          </div>

      </div>

      {/* ───────────────── RESULT POPUP — centrado en la rueda, 3 filas compactas ───────────────── */}
      {lastResult && phase === "revealing" && (() => {
        const colorLabel =
          lastResult.color === "red" ? "ROJO" : lastResult.color === "black" ? "NEGRO" : "VERDE";
        const won = lastResult.won;
        return (
          <div
            className="pointer-events-none fixed left-1/2 z-[100] -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${WHEEL_CY_PCT}dvh` }}
          >
            <div
              className={`result-pop-win min-w-[180px] rounded-xl border px-5 py-2.5 text-center shadow-2xl backdrop-blur-md ${
                won
                  ? "border-emerald-400/70 bg-[#0c0620]/90 shadow-[0_0_28px_rgba(16,185,129,0.55)]"
                  : "border-rose-400/70 bg-[#0c0620]/90 shadow-[0_0_22px_rgba(244,63,94,0.45)]"
              }`}
            >
              <div
                className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
                  won ? "text-emerald-300/90" : "text-rose-300/90"
                }`}
              >
                {won ? "¡GANASTE!" : "RESULTADO"}
              </div>
              <div
                className={`font-display text-xl font-black leading-tight ${
                  won ? "neon-green" : "text-rose-200"
                }`}
              >
                {lastResult.segment} {colorLabel}
              </div>
              {won ? (
                <div className="text-[11px] font-semibold text-emerald-200/85">
                  +<FitText className="inline-block">{formatCOP(lastResult.payout)}</FitText> COP · ¡Vamos a ganar de nuevo!
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-rose-100/80">
                  ¡Haz tu próxima apuesta!
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}