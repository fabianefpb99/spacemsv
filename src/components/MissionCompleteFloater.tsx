import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

/** Soft "blip" notification sound via WebAudio (no asset needed). */
function playBlip() {
  if (typeof window === "undefined") return;
  try {
    const Ctx: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // Quick two-step blip: 880Hz -> 1320Hz
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
    // Soft, low volume envelope
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* ignore – audio is best-effort */
  }
}

/**
 * Banner flotante superior que aparece ~4s cuando una misión se completa.
 * Compacto (no ocupa mucha altura) y con la recompensa visible (avatar img,
 * o el monto / spins / xp).
 */
export function MissionCompleteFloater() {
  const [mounted, setMounted] = useState(false);
  const [item, setItem] = useState<(MissionCompletePayload & { visible: boolean }) | null>(null);
  const { user } = useAuth();
  const hideTimers = useRef<{ fade?: number; remove?: number }>({});

  const dismiss = () => {
    if (hideTimers.current.fade) window.clearTimeout(hideTimers.current.fade);
    if (hideTimers.current.remove) window.clearTimeout(hideTimers.current.remove);
    setItem((p) => (p ? { ...p, visible: false } : p));
    window.setTimeout(() => setItem(null), 350);
  };

  const show = (detail: MissionCompletePayload) => {
    if (hideTimers.current.fade) window.clearTimeout(hideTimers.current.fade);
    if (hideTimers.current.remove) window.clearTimeout(hideTimers.current.remove);
    setItem({ ...detail, visible: true });
    playBlip();
    hideTimers.current.fade = window.setTimeout(
      () => setItem((p) => (p ? { ...p, visible: false } : p)),
      4500,
    );
    hideTimers.current.remove = window.setTimeout(() => setItem(null), 4900);
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onEvent(e: Event) {
      const detail = (e as CustomEvent<MissionCompletePayload>).detail;
      if (!detail) return;
      show(detail);
    }
    window.addEventListener(EVT, onEvent as EventListener);
    return () => window.removeEventListener(EVT, onEvent as EventListener);
  }, []);

  // Global subscriber: listen for any user_mission row that completes for the
  // current user (on any view), fetch the mission metadata, and trigger the
  // floater. Uses an in-session dedup set so old completions don't fire again.
  useEffect(() => {
    if (!user) return;
    const SEEN_KEY = "betspace:missions-notified-global-v1";
    let seen = new Set<string>();
    try {
      seen = new Set<string>(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]"));
    } catch {}
    const mountedAt = Date.now();

    const handleRow = async (row: any) => {
      if (!row || row.user_id !== user.id) return;
      if (!row.completed_at) return;
      const completedAt = new Date(row.completed_at).getTime();
      if (completedAt < mountedAt - 10_000) return;
      const key = `${row.mission_id}:${row.period_start}`;
      if (seen.has(key)) return;
      seen.add(key);
      sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
      try {
        const { data: mission } = await supabase
          .from("missions")
          .select("id, title, subtitle, reward_kind, reward_value, reward_label, reward_image_url")
          .eq("id", row.mission_id)
          .maybeSingle();
        if (!mission) return;
        notifyMissionComplete({
          id: mission.id,
          title: mission.title,
          subtitle: mission.subtitle ?? undefined,
          reward: {
            kind: mission.reward_kind as MissionCompletePayload["reward"]["kind"],
            value: Number(mission.reward_value ?? 0),
            label: mission.reward_label || undefined,
            image: mission.reward_image_url ?? null,
          },
        });
      } catch {
        /* swallow — notification is best-effort */
      }
    };

    const channel = supabase
      .channel(`user-missions:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_missions", filter: `user_id=eq.${user.id}` },
        (payload) => handleRow(payload.new),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_missions", filter: `user_id=eq.${user.id}` },
        (payload) => handleRow(payload.new),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Swipe-to-close (vertical or horizontal flick)
  const dragRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragRef.current = { x: t.clientX, y: t.clientY, active: true };
    setDrag({ dx: 0, dy: 0 });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current?.active) return;
    const t = e.touches[0];
    setDrag({ dx: t.clientX - dragRef.current.x, dy: t.clientY - dragRef.current.y });
  };
  const onTouchEnd = () => {
    if (!dragRef.current?.active) return;
    const { dx, dy } = drag;
    dragRef.current.active = false;
    if (Math.abs(dx) > 80 || dy < -50) {
      dismiss();
    } else {
      setDrag({ dx: 0, dy: 0 });
    }
  };

  if (!mounted || !item) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-3"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      aria-live="polite"
    >
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: item.visible
            ? `translate(${drag.dx}px, ${Math.min(0, drag.dy)}px)`
            : "translateY(-12px)",
          opacity: item.visible
            ? Math.max(0, 1 - Math.abs(drag.dx) / 200 - Math.max(0, -drag.dy) / 120)
            : 0,
          transition: dragRef.current?.active ? "none" : "transform 300ms, opacity 300ms",
          touchAction: "pan-y",
        }}
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
            onClick={dismiss}
            aria-label="Cerrar"
            className="ml-1 shrink-0 rounded-md p-1 text-white hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}