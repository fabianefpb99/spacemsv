import { useEffect, useRef } from "react";
import { ARENA_CHARACTER_META } from "./characters";
import type { ArenaCombatEvent } from "@/lib/games/arena.shared";

/**
 * Live combat log. Auto-scrolls to the most recent event.
 * Pass `eventsRevealed` to incrementally reveal events as the fight plays.
 */
export function CombatLog({ events }: { events: ArenaCombatEvent[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs leading-tight backdrop-blur-sm"
    >
      {events.length === 0 ? (
        <div className="flex h-full items-center justify-center text-white/40">
          Esperando primera ronda…
        </div>
      ) : (
        <ul className="space-y-1.5">
          {events.map((e, i) => {
            const atk = ARENA_CHARACTER_META[e.attacker];
            const tgt = ARENA_CHARACTER_META[e.target];
            return (
              <li
                key={i}
                className="animate-fade-in flex flex-wrap items-center gap-1.5 text-white/90"
              >
                <span className="text-white/40">R{e.round}</span>
                <span className="font-semibold" style={{ color: atk.color }}>
                  {atk.name}
                </span>
                <span className="text-white/60">→</span>
                <span className="font-semibold" style={{ color: tgt.color }}>
                  {tgt.name}
                </span>
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-300">
                  -{e.damage}
                </span>
                {e.finisher && (
                  <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300">
                    FINISH
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}