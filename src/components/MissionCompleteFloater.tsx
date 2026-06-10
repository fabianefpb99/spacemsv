import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";

export type MissionCompletePayload = {
  id: string;
  title: string;
  subtitle?: string;
  reward: {
    kind: "bonus" | "spins" | "xp" | "avatar";
    value?: number | string;
    label?: string;
    image?: string | null;
  };
};

const EVT = "betspace:mission-complete";

/**
 * Dispara la notificación flotante de "misión completada".
 * Llamable desde cualquier parte del cliente.
 */
export function notifyMissionComplete(payload: MissionCompletePayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MissionCompletePayload>(EVT, { detail: payload }));
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function rewardText(r: MissionCompletePayload["reward"]) {
  if (r.label) return r.label;
  if (r.kind === "bonus") return `$${formatCOP(Number(r.value) || 0)} Bonus`;
  if (r.kind === "spins") return `${Number(r.value) || 0} Free Spins`;
  if (r.kind === "xp") return `+${Number(r.value) || 0} XP`;
  return "Avatar";
}

/**
 * Banner flotante superior que aparece ~4s cuando una misión se completa.
 * Compacto (no ocupa mucha altura) y con la recompensa visible (avatar img,
 * o el monto / spins / xp).
 */
export function MissionCompleteFloater() {
  const [mounted, setMounted] = useState(false);
  const [item, setItem] = useState<(MissionCompletePayload & { visible: boolean }) | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onEvent(e: Event) {
      const detail = (e as CustomEvent<MissionCompletePayload>).detail;
      if (!detail) return;
      setItem({ ...detail, visible: true });
      window.setTimeout(() => setItem((p) => (p ? { ...p, visible: false } : p)), 4000);
      window.setTimeout(() => setItem(null), 4400);
    }
    window.addEventListener(EVT, onEvent as EventListener);
    return () => window.removeEventListener(EVT, onEvent as EventListener);
  }, []);

  if (!mounted || !item) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-3"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border border-amber-300/50 bg-gradient-to-r from-[#1a0930]/95 via-[#240a3a]/95 to-[#1a0930]/95 shadow-[0_8px_22px_-6px_rgba(217,70,239,0.55)] backdrop-blur transition-all duration-300 ${
          item.visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 ring-1 ring-amber-300/50">
            {item.reward.kind === "avatar" && item.reward.image ? (
              <img src={item.reward.image} alt="" className="h-9 w-9 rounded-md object-cover" />
            ) : (
              <Sparkles className="h-5 w-5 text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-widest text-amber-200">
              Misión completada
            </div>
            <div className="truncate text-[11px] font-semibold text-white">
              {item.title}
              {item.subtitle ? <span className="text-fuchsia-200"> {item.subtitle}</span> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9px] uppercase tracking-wider text-purple-300/70">Ganaste</div>
            <div className="font-display text-[12px] font-black leading-none text-emerald-300">
              {rewardText(item.reward)}
            </div>
          </div>
          <button
            onClick={() => setItem((p) => (p ? { ...p, visible: false } : p))}
            aria-label="Cerrar"
            className="ml-1 shrink-0 rounded-md p-1 text-purple-300/70 hover:bg-white/5 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}