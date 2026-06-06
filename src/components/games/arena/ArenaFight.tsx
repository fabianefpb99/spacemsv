import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ARENA_CHARACTERS,
  type ArenaCharacterId,
  type ArenaCombatEvent,
} from "@/lib/games/arena.shared";
import { ARENA_BACKGROUNDS, ARENA_CHARACTER_META } from "./characters";
import { CharacterSprite } from "./CharacterSprite";
import { CombatLog } from "./CombatLog";

/**
 * Animated playback of a finished round.
 * Walks through combat_log events one at a time on a fixed cadence,
 * driving sprite phases (attack/damage) and HP bars.
 *
 * Pure presentation — receives the full deterministic result and replays it.
 */

const EVENT_INTERVAL_MS = 1100;

type PhaseMap = Record<ArenaCharacterId, "stance" | "attack" | "damage">;

function freshPhases(): PhaseMap {
  return { nova: "stance", shadow: "stance", titan: "stance", blaze: "stance" };
}
function freshHp(): Record<ArenaCharacterId, number> {
  return { nova: 100, shadow: 100, titan: 100, blaze: 100 };
}

export function ArenaFight({
  combatLog,
  winner,
  characterBet,
  onComplete,
}: {
  combatLog: ArenaCombatEvent[];
  winner: ArenaCharacterId;
  characterBet: ArenaCharacterId;
  onComplete: () => void;
}) {
  const [eventIdx, setEventIdx] = useState(0);
  const [phases, setPhases] = useState<PhaseMap>(freshPhases);
  const [hp, setHp] = useState<Record<ArenaCharacterId, number>>(freshHp);
  const [shakeId, setShakeId] = useState<ArenaCharacterId | null>(null);

  // Walk through events on a timer.
  useEffect(() => {
    if (eventIdx >= combatLog.length) {
      // After last event, settle for a beat then call onComplete.
      const t = setTimeout(onComplete, 1400);
      return () => clearTimeout(t);
    }
    const ev = combatLog[eventIdx];
    // Set attack/damage phase
    setPhases((prev) => ({ ...prev, [ev.attacker]: "attack", [ev.target]: "damage" }));
    setHp(() => ({ ...ev.hp }));
    setShakeId(ev.target);

    const reset = setTimeout(() => {
      setPhases((prev) => {
        const next = { ...prev };
        for (const id of ARENA_CHARACTERS) {
          if (ev.hp[id] > 0) next[id] = "stance";
        }
        return next;
      });
      setShakeId(null);
    }, 550);
    const advance = setTimeout(() => setEventIdx((i) => i + 1), EVENT_INTERVAL_MS);

    return () => {
      clearTimeout(reset);
      clearTimeout(advance);
    };
  }, [eventIdx, combatLog, onComplete]);

  const revealedEvents = useMemo(() => combatLog.slice(0, eventIdx + 1), [combatLog, eventIdx]);

  const left = ARENA_CHARACTERS.filter((id) => ARENA_CHARACTER_META[id].side === "left");
  const right = ARENA_CHARACTERS.filter((id) => ARENA_CHARACTER_META[id].side === "right");

  return (
    <div
      className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
      style={{
        backgroundImage: `url(${ARENA_BACKGROUNDS.fight})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* HP bars */}
      <div className="absolute inset-x-0 top-2 flex justify-between gap-2 px-3">
        <div className="flex flex-1 flex-col gap-1">
          {left.map((id) => (
            <HpBar key={id} id={id} hp={hp[id]} isBet={id === characterBet} />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {right.map((id) => (
            <HpBar key={id} id={id} hp={hp[id]} isBet={id === characterBet} align="right" />
          ))}
        </div>
      </div>

      {/* Stage area */}
      <div className="absolute inset-x-0 top-[42%] bottom-[28%] grid grid-cols-2 gap-2 px-3">
        <div className="flex items-end justify-around gap-1">
          {left.map((id) => (
            <FighterStage
              key={id}
              id={id}
              phase={hp[id] <= 0 ? "damage" : phases[id]}
              dead={hp[id] <= 0}
              shake={shakeId === id}
              isWinner={id === winner}
            />
          ))}
        </div>
        <div className="flex items-end justify-around gap-1">
          {right.map((id) => (
            <FighterStage
              key={id}
              id={id}
              phase={hp[id] <= 0 ? "damage" : phases[id]}
              dead={hp[id] <= 0}
              shake={shakeId === id}
              isWinner={id === winner}
            />
          ))}
        </div>
      </div>

      {/* Combat log */}
      <div className="absolute inset-x-3 bottom-3 h-[22%]">
        <CombatLog events={revealedEvents} />
      </div>
    </div>
  );
}

function HpBar({
  id,
  hp,
  isBet,
  align = "left",
}: {
  id: ArenaCharacterId;
  hp: number;
  isBet: boolean;
  align?: "left" | "right";
}) {
  const meta = ARENA_CHARACTER_META[id];
  const pct = Math.max(0, Math.min(100, hp));
  return (
    <div
      className={cn(
        "rounded-md border bg-black/60 p-1 backdrop-blur-sm",
        isBet ? "border-yellow-400/80 shadow-[0_0_10px_rgba(250,204,21,0.4)]" : "border-white/15",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 text-[9px] font-bold leading-none",
          align === "right" && "justify-end",
        )}
        style={{ color: meta.color }}
      >
        {isBet && <span className="text-yellow-300">★</span>}
        {meta.name}
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: meta.color }}
        />
      </div>
    </div>
  );
}

function FighterStage({
  id,
  phase,
  dead,
  shake,
  isWinner,
}: {
  id: ArenaCharacterId;
  phase: "stance" | "attack" | "damage";
  dead: boolean;
  shake: boolean;
  isWinner: boolean;
}) {
  return (
    <div className="relative flex h-full w-full items-end justify-center">
      <CharacterSprite
        characterId={id}
        phase={phase}
        alpha={dead ? 0.25 : 1}
        shake={shake}
        className={cn(
          "h-full w-full transition-all duration-300",
          isWinner && dead === false && "drop-shadow-[0_0_24px_rgba(250,204,21,0.9)]",
        )}
      />
    </div>
  );
}