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

type Choice = "red" | "black" | "green";
type Phase = "idle" | "spinning" | "revealing";
type HistoryEntry = { segment: number; color: Choice };

const MIN_BET = 500;
const MAX_BET = 500000;
const BET_STEP = 500;

// Calibración de la rueda sobre el fondo v2 (escena 942x1672, ratio 9:16)
// El fondo v2 tiene un hueco circular vacío donde encaja la rueda funcional.
// Medidas extraídas pixel-perfect del PNG.
const WHEEL_CX_PCT = 49.84;    // % del ancho — centro horizontal del hueco
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
  const R = 195; // outer (≈ extiende todo el viewBox)
  const r = Math.round(R * WHEEL_INNER_RATIO); // inner (alineado con borde interior pintado)
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
            fontSize={10}
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
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#06010f] text-white">
      {/* ───────────────── ESCENA (fondo + rueda alineada al centro pintado) ───────────────── */}
      <div
        className="relative mx-auto w-full"
        style={{ aspectRatio: "941 / 1672", maxWidth: "min(100vw, calc(100dvh * 941 / 1672))" }}
      >
        <img
          src={rouletteScene.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
        />

        {/* Rueda funcional: SVG plano alineado EXACTAMENTE con la ruleta del fondo */}
        <div
          className="absolute"
          style={{
            left: `${WHEEL_CX_PCT}%`,
            top: `${WHEEL_CY_PCT}%`,
            width: `${WHEEL_DIAM_PCT}%`,
            aspectRatio: "1 / 1",
            transform: "translate(-50%, -50%)",
          }}
        >
          <RouletteWheel rotation={rotation} spinning={phase === "spinning"} />
        </div>
      </div>

      {/* ───────────────── HEADER overlay (translúcido sobre la escena) ───────────────── */}
      <header
        className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)", paddingBottom: "0.4rem" }}
      >
        <div className="flex items-center gap-1">
          <button className="rounded-md p-1.5 text-white/95 hover:bg-white/10" aria-label="Menú">
            <Menu className="h-6 w-6" strokeWidth={2.5} />
          </button>
          <Link to="/">
            <img src={betspaceLogo} alt="BETSPACE" className="h-5 w-auto cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-black/50 px-2 py-1 text-right backdrop-blur-sm ring-1 ring-purple-400/30">
            <div className="text-[8px] uppercase tracking-wider text-purple-200/80 leading-none">Balance</div>
            <div className="font-display text-[11px] font-bold text-white leading-tight">
              <span className="text-emerald-400 mr-0.5">$</span>
              {balanceReady ? formatCOP(balance) : "—"}
            </div>
          </div>
          <AuthControl />
        </div>
      </header>

      {/* ───────────────── Mini-barra (online + mute + último resultado) ───────────────── */}
      <div
        className="absolute inset-x-0 z-20 flex items-center justify-between px-3"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 3.2rem)" }}
      >
        <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] backdrop-blur-sm ring-1 ring-white/10">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-semibold text-white/90">{online}</span>
        </div>

        {/* Historial compacto inline */}
        <div className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-sm ring-1 ring-white/10">
          {history.length === 0 ? (
            <span className="text-[9px] text-white/40 italic">sin giros</span>
          ) : (
            history.slice(0, 6).map((h, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full ring-1 ring-black/50 ${
                  h.color === "red"
                    ? "bg-rose-500"
                    : h.color === "black"
                      ? "bg-zinc-900"
                      : "bg-emerald-500"
                }`}
                title={`${h.segment} ${h.color}`}
              />
            ))
          )}
        </div>

        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Activar sonido" : "Silenciar"}
          className="rounded-full bg-black/50 p-1.5 text-white/90 backdrop-blur-sm ring-1 ring-white/10 hover:bg-black/70"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ───────────────── HUD inferior (compacto, sobre la tarima morada) ───────────────── */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 px-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      >
        <div className="mx-auto max-w-md space-y-2">
          {/* Botones de elección — 3 en una fila */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setChoice("red")}
              disabled={phase !== "idle"}
              className={`flex flex-col items-center justify-center gap-0 rounded-xl border-2 py-1.5 transition-all disabled:opacity-60 ${
                choice === "red"
                  ? "border-red-300 bg-gradient-to-br from-red-600 to-red-800 shadow-[0_0_14px_rgba(239,68,68,0.6)]"
                  : "border-red-500/40 bg-red-950/50 backdrop-blur-sm hover:bg-red-900/50"
              }`}
            >
              <span className="font-display text-sm font-black leading-tight">ROJO</span>
              <span className="text-[10px] font-bold text-rose-100/90 leading-none">1.95x</span>
            </button>
            <button
              onClick={() => setChoice("black")}
              disabled={phase !== "idle"}
              className={`flex flex-col items-center justify-center gap-0 rounded-xl border-2 py-1.5 transition-all disabled:opacity-60 ${
                choice === "black"
                  ? "border-white/70 bg-gradient-to-br from-zinc-700 to-zinc-950 shadow-[0_0_14px_rgba(255,255,255,0.25)]"
                  : "border-white/30 bg-zinc-900/60 backdrop-blur-sm hover:bg-zinc-800/70"
              }`}
            >
              <span className="font-display text-sm font-black leading-tight">NEGRO</span>
              <span className="text-[10px] font-bold text-white/80 leading-none">1.95x</span>
            </button>
            <button
              onClick={() => setChoice("green")}
              disabled={phase !== "idle"}
              className={`flex flex-col items-center justify-center gap-0 rounded-xl border-2 py-1.5 transition-all disabled:opacity-60 ${
                choice === "green"
                  ? "border-emerald-300 bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-[0_0_14px_rgba(16,185,129,0.6)]"
                  : "border-emerald-500/40 bg-emerald-950/50 backdrop-blur-sm hover:bg-emerald-900/50"
              }`}
            >
              <span className="font-display text-sm font-black leading-tight">VERDE 0</span>
              <span className="text-[10px] font-bold text-emerald-100/90 leading-none">14.00x</span>
            </button>
          </div>

          {/* Stepper + GIRAR — una sola fila compacta */}
          <div className="flex items-stretch gap-1.5">
            <button
              onClick={() => adjustBet(-BET_STEP)}
              disabled={phase !== "idle"}
              className="flex h-12 w-11 items-center justify-center rounded-xl border border-purple-400/40 bg-purple-950/60 text-2xl font-bold text-white backdrop-blur-sm hover:bg-purple-900/60 disabled:opacity-50"
              aria-label="Disminuir"
            >
              −
            </button>
            <div className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-purple-400/40 bg-black/60 px-2 backdrop-blur-sm">
              <BetAmount
                bet={bet}
                bonusBalance={bonusBalance}
                amountClassName="font-display text-lg font-bold tracking-wide text-white"
              />
            </div>
            <button
              onClick={() => adjustBet(BET_STEP)}
              disabled={phase !== "idle"}
              className="flex h-12 w-11 items-center justify-center rounded-xl border border-purple-400/40 bg-purple-950/60 text-2xl font-bold text-white backdrop-blur-sm hover:bg-purple-900/60 disabled:opacity-50"
              aria-label="Aumentar"
            >
              +
            </button>
            <button
              onClick={handleSpin}
              disabled={!canSpin}
              className={`h-12 flex-[1.6] rounded-xl font-display text-base font-black uppercase tracking-wider transition-all ${
                canSpin
                  ? "bg-gradient-to-b from-emerald-400 to-emerald-700 text-white shadow-[0_3px_14px_rgba(16,185,129,0.55)] active:scale-[0.98]"
                  : "bg-zinc-800/80 text-white/40 cursor-not-allowed"
              }`}
            >
              {phase === "spinning" ? "GIRANDO…" : "GIRAR"}
            </button>
          </div>
        </div>

        {/* Toast resultado (flotante sobre el HUD) */}
        {lastResult && phase === "revealing" && (
          <div
            className={`pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-center text-sm font-bold backdrop-blur-md animate-[scale-in_.3s_ease-out] ${
              lastResult.won
                ? "border-emerald-300 bg-emerald-950/80 text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,0.7)]"
                : "border-rose-400/60 bg-rose-950/80 text-rose-100"
            }`}
          >
            {lastResult.won ? (
              <>🎉 +<FitText className="inline-block">{formatCOP(lastResult.payout)}</FitText> COP</>
            ) : (
              <>Salió {lastResult.segment} {lastResult.color === "red" ? "rojo" : lastResult.color === "black" ? "negro" : "verde"}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}