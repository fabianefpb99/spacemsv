import { useEffect, useMemo, useState } from "react";
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

/**
 * Mostrar SOLO en /perfil. Compara current_level vs last_seen_level
 * y muestra una animación al subir de nivel. No se monta en juegos
 * para evitar romper sus HUDs.
 */
export function VipLevelUpToast() {
  const vip = useVip();
  const markSeen = useMarkVipLevelSeen();
  const [dismissed, setDismissed] = useState(false);

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
  }, [showLevel]);

  if (!showLevel || dismissed) return null;

  const rank = rankForLevel(showLevel);
  const sub = subForLevel(showLevel);
  const meta = RANK_META[rank];
  const isMax = showLevel >= 100;

  const close = () => {
    setDismissed(true);
    markSeen.mutate();
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
          "vip-pop relative w-full max-w-sm overflow-hidden rounded-2xl border bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-6 text-center",
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
          <VipBadge rank={rank} sub={sub} size="lg" />
        </div>
        <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
          <Sparkles className="h-3 w-3" /> Subiste de nivel <Sparkles className="h-3 w-3" />
        </div>
        <div className={cn("font-display mt-2 text-2xl font-black uppercase tracking-wider", meta.text)}>
          {rankLabel(rank, sub)}
        </div>
        <div className="mt-1 text-xs text-purple-200/80">Nivel {showLevel}</div>

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
      `}</style>
    </div>
  );
}
