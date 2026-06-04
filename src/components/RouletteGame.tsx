import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import betspaceLogo from "@/assets/betspace-logo.svg";
import rouletteScene from "@/assets/roulette-scene.png.asset.json";
import { AuthControl } from "@/components/auth/AuthControl";
import { BetAmount } from "@/components/games/BetAmount";
import { FitText } from "@/components/ui/fit-text";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { clampBetToStep } from "@/lib/games/bet-helpers";

type Choice = "red" | "black" | "green";
type Phase = "idle" | "spinning" | "revealing";
type HistoryEntry = { segment: number; color: Choice };

const MIN_BET = 500;
const MAX_BET = 500000;
const BET_STEP = 500;

// Calibración de la rueda sobre el fondo (escena 941x1672, ratio 9:16)
// Centro de la ruleta del fondo y diámetro útil (segmentos R/N/V)
const WHEEL_CX_PCT = 50;       // % del ancho del fondo
const WHEEL_CY_PCT = 44.9;     // % del alto del fondo
const WHEEL_DIAM_PCT = 59.5;   // % del ancho del fondo (zona de segmentos)

// European single-zero wheel order, clockwise starting at 0 (top)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SEG_COUNT = 37;
const SEG_DEG = 360 / SEG_COUNT;
const SPIN_DURATION_MS = 6500;
const EXTRA_SPINS = 8;

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
  const R = 195; // outer
  const r = 110; // inner (where numbers end)
  const textR = (R + r) / 2;

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
            ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.85, 0.25, 1)`
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
            fontSize={14}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(${s.mid} ${s.tx} ${s.ty})`}
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)", userSelect: "none" }}
          >
            {s.num}
          </text>
        ))}
      </g>
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

  // Hydrate history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("betspaceman:roulette:history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("betspaceman:roulette:history", JSON.stringify(history.slice(0, 30)));
    } catch {}
  }, [history]);

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
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
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
      // velocidad ∝ derivada del easing; aproximamos con sqrt para más ticks al inicio
      tickTimersRef.current.forEach((t) => window.clearTimeout(t));
      tickTimersRef.current = [];
      const totalTicks = 26;
      for (let i = 1; i <= totalTicks; i++) {
        const p = i / totalTicks;
        // Easing inverso aproximado: ticks más juntos al inicio, separados al final
        const t = 1 - Math.pow(1 - p, 2.4);
        const at = window.setTimeout(playTick, t * SPIN_DURATION_MS);
        tickTimersRef.current.push(at);
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
    <div className="min-h-screen bg-[#06010f] text-white relative overflow-hidden">
      {/* Cosmic backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,40,200,0.25),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(60,10,120,0.35),transparent_60%)]" />

      <div
        className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pt-4 sm:max-w-lg sm:px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) * 0.85 + 1.05rem)" }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
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
                <span className="text-emerald-400 mr-0.5">$</span>
                {balanceReady ? formatCOP(balance) : "—"} COP
              </div>
            </div>
            <AuthControl />
          </div>
        </header>

        {/* Top bar: online + mute */}
        <div className="mt-3 flex items-center justify-between">
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

        {/* Title */}
        <div className="mt-2 text-center">
          <h1 className="font-display text-4xl font-black tracking-wider bg-gradient-to-b from-rose-300 via-red-500 to-red-700 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(239,68,68,0.5)]">
            RULETA
          </h1>
          <div className="mt-0.5 text-[11px] font-semibold tracking-wide">
            <span className="text-rose-400">ROJO</span>
            <span className="text-white/40 mx-1.5">/</span>
            <span className="text-white/80">NEGRO</span>
            <span className="text-white/40 mx-1.5">/</span>
            <span className="text-emerald-400">0</span>
          </div>
        </div>

        {/* Wheel */}
        <div className="relative mx-auto mt-3 aspect-square w-full max-w-[360px]">
          <img
            src={rouletteFrame}
            alt=""
            className="absolute inset-0 h-full w-full pointer-events-none select-none"
            draggable={false}
          />
          {/* Inner wheel disc, sized to fit inside the gold ring (~63% of frame) */}
          <div className="absolute left-1/2 top-1/2 aspect-square w-[63%] -translate-x-1/2 -translate-y-1/2">
            <RouletteWheel rotation={rotation} spinning={phase === "spinning"} />
            {/* Central hub overlay (small golden cap) */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-300 via-yellow-600 to-amber-800 shadow-[inset_0_2px_6px_rgba(255,255,255,0.4),0_0_12px_rgba(0,0,0,0.6)] ring-2 ring-fuchsia-500/60" />
          </div>
          {/* Pointer (top, fixed) */}
          <div className="pointer-events-none absolute left-1/2 top-[6%] z-20 -translate-x-1/2">
            <div
              className={`h-0 w-0 transition-all ${phase === "spinning" ? "drop-shadow-[0_0_8px_rgba(251,191,36,1)]" : ""}`}
              style={{
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderTop: "18px solid #fbbf24",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))",
              }}
            />
          </div>
        </div>

        {/* Últimos resultados */}
        <div className="mt-3 rounded-2xl border border-purple-500/30 bg-[#150828]/60 px-3 py-2">
          <div className="text-center text-[10px] font-bold uppercase tracking-wider text-purple-200/80">
            Últimos resultados
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 overflow-x-auto">
            {history.length === 0 ? (
              <span className="text-[11px] text-white/40 italic py-1">Aún no hay giros</span>
            ) : (
              history.slice(0, 10).map((h, i) => (
                <div
                  key={i}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-black/40 ${
                    h.color === "red"
                      ? "bg-gradient-to-br from-red-500 to-red-800"
                      : h.color === "black"
                        ? "bg-gradient-to-br from-zinc-700 to-zinc-950"
                        : "bg-gradient-to-br from-emerald-500 to-emerald-800"
                  }`}
                  title={`${h.segment} ${h.color}`}
                >
                  {h.segment}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bet panel */}
        <div className="mt-3 rounded-2xl border border-purple-500/30 bg-[#150828]/60 p-3">
          <div className="text-center text-[10px] font-bold uppercase tracking-wider text-purple-200/80">
            Apuesta (COP)
          </div>
          <div className="mt-2 flex items-stretch gap-2">
            <button
              onClick={() => adjustBet(-BET_STEP)}
              disabled={phase !== "idle"}
              className="flex h-14 w-14 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-950/40 text-2xl font-bold text-white hover:bg-purple-900/50 disabled:opacity-50"
            >
              −
            </button>
            <div className="flex h-14 flex-1 items-center justify-center rounded-xl border border-purple-500/40 bg-black/50 px-3">
              <BetAmount
                bet={bet}
                bonusBalance={bonusBalance}
                amountClassName="font-display text-2xl font-bold tracking-wide text-white"
              />
            </div>
            <button
              onClick={() => adjustBet(BET_STEP)}
              disabled={phase !== "idle"}
              className="flex h-14 w-14 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-950/40 text-2xl font-bold text-white hover:bg-purple-900/50 disabled:opacity-50"
            >
              +
            </button>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {QUICK_ADDS.map((q) => (
              <button
                key={q}
                onClick={() => adjustBet(q)}
                disabled={phase !== "idle"}
                className="rounded-lg border border-purple-500/40 bg-purple-950/30 py-1.5 text-[11px] font-bold text-white hover:bg-purple-900/40 disabled:opacity-50"
              >
                +{formatCOP(q)}
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-center text-[10px] text-purple-200/60">
            MÍNIMO: {formatCOP(MIN_BET)} COP &nbsp;·&nbsp; PASO: {formatCOP(BET_STEP)}
          </div>
        </div>

        {/* Choice buttons */}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            onClick={() => setChoice("red")}
            disabled={phase !== "idle"}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all disabled:opacity-60 ${
              choice === "red"
                ? "border-red-400 bg-gradient-to-br from-red-600 to-red-800 shadow-[0_0_18px_rgba(239,68,68,0.55)]"
                : "border-red-500/40 bg-red-950/30 hover:bg-red-900/40"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-700 ring-2 ring-white/30 text-xs font-bold">●</div>
            <div className="text-left">
              <div className="font-display text-base font-bold leading-none">ROJO</div>
              <div className="text-[10px] font-bold text-rose-100/90">1.95x</div>
            </div>
          </button>
          <button
            onClick={() => setChoice("black")}
            disabled={phase !== "idle"}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all disabled:opacity-60 ${
              choice === "black"
                ? "border-white/70 bg-gradient-to-br from-zinc-700 to-zinc-950 shadow-[0_0_18px_rgba(255,255,255,0.25)]"
                : "border-white/30 bg-zinc-900/50 hover:bg-zinc-800/60"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-black ring-2 ring-amber-400/50 text-xs font-bold">●</div>
            <div className="text-left">
              <div className="font-display text-base font-bold leading-none">NEGRO</div>
              <div className="text-[10px] font-bold text-white/80">1.95x</div>
            </div>
          </button>
          <button
            onClick={() => setChoice("green")}
            disabled={phase !== "idle"}
            className={`col-span-2 flex items-center justify-center gap-3 rounded-xl border-2 p-2.5 transition-all disabled:opacity-60 ${
              choice === "green"
                ? "border-emerald-400 bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-[0_0_18px_rgba(16,185,129,0.55)]"
                : "border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/40"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 ring-2 ring-white/40 text-xs font-bold">0</div>
            <div className="font-display text-base font-bold">VERDE (0)</div>
            <div className="ml-auto text-sm font-bold text-emerald-200">14.00x</div>
          </button>
        </div>

        {/* Spin button */}
        <button
          onClick={handleSpin}
          disabled={!canSpin}
          className={`mt-3 h-14 w-full rounded-2xl font-display text-xl font-black uppercase tracking-wider transition-all ${
            canSpin
              ? "bg-gradient-to-b from-emerald-400 to-emerald-700 text-white shadow-[0_4px_18px_rgba(16,185,129,0.55)] hover:from-emerald-300 hover:to-emerald-600 active:scale-[0.98]"
              : "bg-zinc-800 text-white/40 cursor-not-allowed"
          }`}
        >
          {phase === "spinning" ? "GIRANDO…" : phase === "revealing" ? "RESULTADO" : "GIRAR RULETA"}
        </button>

        {/* Last result banner */}
        {lastResult && phase === "revealing" && (
          <div
            className={`mt-2 rounded-xl border-2 px-3 py-2 text-center font-bold animate-[scale-in_.3s_ease-out] ${
              lastResult.won
                ? "border-emerald-400 bg-emerald-950/50 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.5)]"
                : "border-rose-500/50 bg-rose-950/40 text-rose-200"
            }`}
          >
            {lastResult.won ? (
              <>
                🎉 Ganaste <FitText className="inline-block">+{formatCOP(lastResult.payout)} COP</FitText>
              </>
            ) : (
              <>Salió {lastResult.segment} ({lastResult.color === "red" ? "rojo" : lastResult.color === "black" ? "negro" : "verde"})</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}