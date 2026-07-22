import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarkVipLevelSeen, useVip } from "@/hooks/useVip";
import {
  rankForLevel,
  rankLabel,
  RANK_META,
  subForLevel,
} from "@/lib/vip/vip.shared";
import { VipBadge } from "./VipBadge";
import { RANK_ART } from "@/lib/vip/vip-art";
import coinRevealSfx from "@/assets/sfx/coin-reveal.mp3";
import { isMuted } from "@/lib/gameAudio";

/**
 * Mostrar SOLO en /perfil. Compara current_level vs last_seen_level
 * y muestra una animación al subir de nivel. No se monta en juegos
 * para evitar romper sus HUDs.
 */
export function VipLevelUpToast() {
  const vip = useVip();
  const markSeen = useMarkVipLevelSeen();
  const [dismissed, setDismissed] = useState(false);
  const [shattered, setShattered] = useState(false);

  const data = vip.data;
  const showLevel = useMemo(() => {
    if (!data || !data.user_vip) return null;
    const cur = data.user_vip.current_level ?? 0;
    const seen = data.last_seen_level ?? 0;
    if (cur <= 0 || cur <= seen) return null;
    return cur;
  }, [data]);

  useEffect(() => {
    setDismissed(false);
    setShattered(false);
  }, [showLevel]);

  // Trigger the shatter + diamond reveal sound shortly after the modal opens.
  useEffect(() => {
    if (!showLevel || dismissed) return;
    const t = window.setTimeout(() => {
      setShattered(true);
      if (!isMuted()) {
        try {
          const a = new Audio(coinRevealSfx);
          a.volume = 0.55;
          a.playbackRate = 1.05;
          void a.play();
        } catch {}
      }
    }, 620);
    return () => window.clearTimeout(t);
  }, [showLevel, dismissed]);

  if (!showLevel || dismissed) return null;

  const rank = rankForLevel(showLevel);
  const sub = subForLevel(showLevel);
  const meta = RANK_META[rank];
  const isMax = showLevel >= 100;

  const close = () => {
    setDismissed(true);
    markSeen.mutate({ level: showLevel });
  };

  return (
    <div
      role="dialog"
      aria-label="Subiste de nivel VIP"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "vip-levelup-toast vip-pop relative w-full max-w-sm overflow-hidden rounded-2xl border bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-6 text-center",
          meta.border,
        )}
        style={{ boxShadow: `0 0 60px ${meta.glow}` }}
      >
        <button
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-2 top-2 rounded-md p-1 text-white/70 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* glow background */}
        <div
          aria-hidden
          className={cn("vip-glow absolute inset-0 -z-10 bg-gradient-to-br opacity-30", meta.gradient)}
        />

        <div className="mb-2 flex justify-center">
          <ShatterReveal
            rank={rank}
            sub={sub}
            shattered={shattered}
            glow={meta.glow}
          />
        </div>
        <div className="vip-levelup-eyebrow flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
          <Sparkles className="h-3 w-3" /> Subiste de nivel <Sparkles className="h-3 w-3" />
        </div>
        <div className={cn("font-display mt-2 text-2xl font-black uppercase tracking-wider", meta.text)}>
          {rankLabel(rank, sub)}
        </div>
        <div className="vip-levelup-sublevel mt-1 text-xs text-purple-200/80">Nivel {showLevel}</div>

        {isMax && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-200">
            ★ Nivel Máximo Alcanzado
          </div>
        )}

        <button
          onClick={close}
          className="mt-5 w-full rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-purple-500"
        >
          ¡Continuar!
        </button>
      </div>

      <style>{`
        @keyframes vip-pop-in {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes vip-glow-pulse {
          0%,100% { opacity: 0.25; }
          50% { opacity: 0.45; }
        }
        .vip-pop { animation: vip-pop-in 420ms cubic-bezier(.2,.9,.3,1.2) both; }
        .vip-glow { animation: vip-glow-pulse 2s ease-in-out infinite; filter: blur(40px); }

        html.light body .vip-levelup-toast .vip-levelup-eyebrow,
        html.light body .vip-levelup-toast .vip-levelup-eyebrow *,
        html.light body .vip-levelup-toast .vip-levelup-sublevel {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.45) !important;
        }

        /* ---- Shatter reveal ---- */
        .vip-reveal { position: relative; width: 9rem; height: 9rem; }
        .vip-reveal-art {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transform: scale(0.7);
          transition: opacity 260ms ease-out, transform 480ms cubic-bezier(.34,1.56,.64,1);
        }
        .vip-reveal-art.is-on { opacity: 1; transform: scale(1); }
        .vip-reveal-art img {
          width: 100%; height: 100%; object-fit: contain;
          filter: drop-shadow(0 6px 16px rgba(0,0,0,.55));
        }
        .vip-reveal-sub {
          position: absolute; bottom: -0.25rem; right: 0;
          padding: 0 0.35rem; font-size: 0.7rem; line-height: 1.3;
          font-weight: 900; letter-spacing: 0.15em; color: #fff;
          background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.25);
          border-radius: 0.375rem;
        }
        .vip-shell {
          position: absolute; inset: 6%;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45), rgba(255,255,255,0.06) 38%, transparent 60%),
            linear-gradient(160deg, #2a1450 0%, #120628 70%);
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow:
            inset 0 0 22px rgba(168,85,247,0.35),
            0 0 30px rgba(168,85,247,0.35);
          overflow: hidden;
          animation: vip-shell-breath 1.4s ease-in-out infinite;
          transition: opacity 220ms ease-out;
        }
        .vip-shell::before {
          content: ""; position: absolute; inset: 12%;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
        }
        .vip-shell.is-broken { opacity: 0; animation: none; }
        @keyframes vip-shell-breath {
          0%,100% { transform: scale(1); filter: brightness(1); }
          50%     { transform: scale(1.03); filter: brightness(1.18); }
        }

        .vip-crack {
          position: absolute; left: 50%; top: 50%;
          width: 140%; height: 2px;
          background:
            linear-gradient(90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.95) 18%,
              rgba(220,180,255,0.85) 55%,
              rgba(255,255,255,0) 100%);
          box-shadow: 0 0 8px rgba(255,255,255,0.85);
          transform-origin: 0% 50%;
          transform: rotate(0deg) scaleX(0);
          opacity: 0;
        }
        .vip-shell.is-broken .vip-crack {
          animation: vip-crack-grow 320ms cubic-bezier(.22,.61,.36,1) forwards;
        }
        .vip-crack.c1 { transform: rotate(22deg)  scaleX(0); }
        .vip-crack.c2 { transform: rotate(-48deg) scaleX(0); animation-delay: 40ms !important; }
        .vip-crack.c3 { transform: rotate(110deg) scaleX(0); animation-delay: 90ms !important; }
        .vip-crack.c4 { transform: rotate(-148deg) scaleX(0); animation-delay: 140ms !important; }
        @keyframes vip-crack-grow {
          0%   { opacity: 0; }
          25%  { opacity: 1; }
          100% { opacity: 1; transform: var(--vip-crack-end, rotate(0deg) scaleX(1)); }
        }
        .vip-crack.c1 { --vip-crack-end: rotate(22deg)  scaleX(1); }
        .vip-crack.c2 { --vip-crack-end: rotate(-48deg) scaleX(1); }
        .vip-crack.c3 { --vip-crack-end: rotate(110deg) scaleX(1); }
        .vip-crack.c4 { --vip-crack-end: rotate(-148deg) scaleX(1); }

        .vip-shard {
          position: absolute; left: 50%; top: 50%;
          width: 9px; height: 9px;
          margin-left: -4.5px; margin-top: -4.5px;
          background: linear-gradient(160deg, #b58cff, #2a124f);
          box-shadow: 0 0 8px rgba(200,160,255,0.85);
          border-radius: 2px;
          opacity: 0;
          transform: translate(0,0) rotate(0deg) scale(0.4);
        }
        .is-broken .vip-shard {
          animation: vip-shard-fly 700ms cubic-bezier(.22,.61,.36,1) forwards;
        }
        @keyframes vip-shard-fly {
          0%   { opacity: 0; transform: translate(0,0) rotate(0deg) scale(0.4); }
          15%  { opacity: 1; }
          100% { opacity: 0; transform: var(--vip-shard-end) rotate(540deg) scale(0.2); }
        }

        .vip-flash {
          position: absolute; inset: -10%;
          border-radius: 9999px; pointer-events: none;
          background: radial-gradient(circle, rgba(255,255,255,0.85), rgba(255,255,255,0) 60%);
          opacity: 0;
        }
        .is-broken .vip-flash { animation: vip-flash-burst 520ms ease-out forwards; }
        @keyframes vip-flash-burst {
          0%   { opacity: 0; transform: scale(0.4); }
          30%  { opacity: 0.9; }
          100% { opacity: 0; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

/**
 * "Buscaminas"-style shatter: a glowing shell covers the rank insignia,
 * cracks spread across it, then it bursts into shards revealing the SVG.
 */
function ShatterReveal({
  rank,
  sub,
  shattered,
  glow,
}: {
  rank: ReturnType<typeof rankForLevel>;
  sub: ReturnType<typeof subForLevel>;
  shattered: boolean;
  glow: string;
}) {
  // Pre-computed shard endpoints (radial scatter).
  const shards = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 70 + Math.random() * 50;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        return {
          end: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
          delay: Math.round(Math.random() * 80),
        };
      }),
    [rank, sub],
  );

  return (
    <div
      className="vip-reveal"
      style={{ filter: `drop-shadow(0 0 18px ${glow})` }}
    >
      <div className={cn("vip-reveal-art", shattered && "is-on")}>
        <div className="relative h-full w-full">
          <img src={RANK_ART[rank]} alt={`Insignia ${rank}`} draggable={false} />
          <span className="vip-reveal-sub">{sub}</span>
        </div>
      </div>
      <div className={cn("vip-shell", shattered && "is-broken")} aria-hidden>
        <span className="vip-crack c1" />
        <span className="vip-crack c2" />
        <span className="vip-crack c3" />
        <span className="vip-crack c4" />
        {shards.map((s, i) => (
          <span
            key={i}
            className="vip-shard"
            style={
              {
                animationDelay: `${s.delay}ms`,
                ["--vip-shard-end" as never]: s.end,
              } as CSSProperties
            }
          />
        ))}
        <span className="vip-flash" />
      </div>
    </div>
  );
}
