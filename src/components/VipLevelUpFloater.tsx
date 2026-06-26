import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type LevelInfo = {
  level: number;
  rank: string;
  sub: string;
};

const RANK_LABEL: Record<string, string> = {
  bronce: "Bronce",
  plata: "Plata",
  oro: "Oro",
  platino: "Platino",
  diamante: "Diamante",
  maestro: "Maestro",
  leyenda: "Leyenda",
};

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
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function VipLevelUpFloater() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [item, setItem] = useState<(LevelInfo & { visible: boolean }) | null>(null);
  const lastLevelRef = useRef<number | null>(null);
  const hideTimers = useRef<{ fade?: number; remove?: number }>({});

  useEffect(() => setMounted(true), []);

  const dismiss = () => {
    if (hideTimers.current.fade) window.clearTimeout(hideTimers.current.fade);
    if (hideTimers.current.remove) window.clearTimeout(hideTimers.current.remove);
    setItem((p) => (p ? { ...p, visible: false } : p));
    window.setTimeout(() => setItem(null), 350);
  };

  const show = async (newLevel: number) => {
    try {
      const { data } = await supabase
        .from("vip_levels")
        .select("level, rank, sub_division")
        .eq("level", newLevel)
        .maybeSingle();
      if (!data) return;
      if (hideTimers.current.fade) window.clearTimeout(hideTimers.current.fade);
      if (hideTimers.current.remove) window.clearTimeout(hideTimers.current.remove);
      setItem({ level: data.level, rank: data.rank as string, sub: data.sub_division as string, visible: true });
      playBlip();
      hideTimers.current.fade = window.setTimeout(
        () => setItem((p) => (p ? { ...p, visible: false } : p)),
        5200,
      );
      hideTimers.current.remove = window.setTimeout(() => setItem(null), 5600);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!user) {
      lastLevelRef.current = null;
      return;
    }
    let cancelled = false;

    // Seed baseline from current level so the very first realtime payload
    // is compared against reality, not null.
    (async () => {
      const { data } = await supabase
        .from("user_vip")
        .select("current_level")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      lastLevelRef.current = data?.current_level ?? 0;
    })();

    const handleRow = (row: any) => {
      if (!row || row.user_id !== user.id) return;
      const newLevel = Number(row.current_level ?? 0);
      const prev = lastLevelRef.current;
      if (prev == null) {
        lastLevelRef.current = newLevel;
        return;
      }
      if (newLevel > prev) {
        lastLevelRef.current = newLevel;
        void show(newLevel);
      } else {
        lastLevelRef.current = newLevel;
      }
    };

    const channel = supabase
      .channel(`user-vip:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_vip", filter: `user_id=eq.${user.id}` },
        (payload) => handleRow(payload.new),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_vip", filter: `user_id=eq.${user.id}` },
        (payload) => handleRow(payload.new),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Swipe-to-close
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

  const rankName = RANK_LABEL[item.rank] ?? item.rank;

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
          opacity: item.visible ? 1 : 0,
          transition: dragRef.current?.active ? "none" : "transform 300ms, opacity 300ms",
          touchAction: "pan-y",
        }}
        className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border border-amber-300/40 bg-[#1a0930] shadow-[0_8px_30px_rgba(251,191,36,0.18)]"
        data-vip-floater
      >
        <Link
          to="/vip"
          onClick={dismiss}
          className="flex items-center gap-2.5 px-3 py-2 no-underline"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 ring-1 ring-amber-300/60">
            <Crown className="h-5 w-5 text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-widest text-amber-200">
              ¡Subiste de rango!
            </div>
            <div className="truncate text-[11px] font-semibold text-white">
              {rankName} {item.sub}
              <span className="text-purple-300/80"> · Nivel {item.level}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9px] uppercase tracking-wider text-purple-300/70">Toca para</div>
            <div className="font-display text-[12px] font-black leading-none text-emerald-300">
              Ver VIP
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dismiss();
            }}
            aria-label="Cerrar"
            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{ color: "#ffffff", backgroundColor: "#1a0930" }}
          >
            <span
              aria-hidden="true"
              className="block select-none text-[20px] font-black leading-none"
              style={{ color: "#ffffff" }}
            >
              ×
            </span>
          </button>
        </Link>
      </div>
    </div>,
    document.body,
  );
}