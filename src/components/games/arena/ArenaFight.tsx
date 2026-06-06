import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ARENA_CHARACTERS,
  type ArenaCharacterId,
  type ArenaCombatEvent,
} from "@/lib/games/arena.shared";
import { ARENA_CHARACTER_META } from "./characters";
import { CharacterSprite } from "./CharacterSprite";

/**
 * Animated playback of a finished round.
 *
 * Layout (boceto): diamante 2×2 — fila trasera (back) más al centro/arriba,
 * fila frontal (front) más separada/abajo. El "duelo principal" (ganador vs
 * último en morir) se coloca al frente enfrentado; los otros dos quedan
 * atrás. Cada slot tiene una dirección fija (left/right) y los sprites se
 * voltean dinámicamente (mirror) para mirar siempre hacia el centro del ring.
 *
 * En cada evento el atacante se desplaza hacia el objetivo:
 *  - diagonal opuesta → al centro del ring
 *  - misma fila       → 10% horizontal
 *  - misma columna    → 10% vertical
 */

const EVENT_INTERVAL_MS = 1200;
const ATTACK_PHASE_MS = 600;
const FIGHT_BANNER_MS = 1200;

type SlotId = "backLeft" | "backRight" | "frontLeft" | "frontRight";
type PhaseMap = Record<ArenaCharacterId, "stance" | "attack" | "damage">;

/** Center-point of each slot inside the stage area (percentages). */
const SLOT_POSITIONS: Record<SlotId, { x: number; y: number; facing: "left" | "right" }> = {
  backLeft: { x: 38, y: 32, facing: "right" },
  backRight: { x: 62, y: 32, facing: "left" },
  frontLeft: { x: 20, y: 70, facing: "right" },
  frontRight: { x: 80, y: 70, facing: "left" },
};

/** Stage center used for diagonal lunge target. */
const RING_CENTER = { x: 50, y: 50 };

/** Natural sprite facing (what direction the artwork looks). */
const NATURAL_FACING: Record<ArenaCharacterId, "left" | "right"> = {
  nova: "right",
  shadow: "right",
  titan: "left",
  blaze: "left",
};

function freshPhases(): PhaseMap {
  return { nova: "stance", shadow: "stance", titan: "stance", blaze: "stance" };
}
function freshHp(): Record<ArenaCharacterId, number> {
  return { nova: 100, shadow: 100, titan: 100, blaze: 100 };
}

/** Find the order in which characters reached 0 HP across the log. */
function computeDeathOrder(combatLog: ArenaCombatEvent[]): ArenaCharacterId[] {
  const order: ArenaCharacterId[] = [];
  const seen = new Set<ArenaCharacterId>();
  for (const ev of combatLog) {
    for (const id of ARENA_CHARACTERS) {
      if (!seen.has(id) && ev.hp[id] <= 0) {
        seen.add(id);
        order.push(id);
      }
    }
  }
  return order;
}

/**
 * Pre-compute slot assignment so the "main duel" plays out front-and-center:
 *  - winner → frontRight
 *  - last to die (main rival) → frontLeft
 *  - remaining two → back row (death order)
 */
function computeSlotMap(
  combatLog: ArenaCombatEvent[],
  winner: ArenaCharacterId,
): Record<SlotId, ArenaCharacterId> {
  const deathOrder = computeDeathOrder(combatLog);
  const mainRival =
    [...deathOrder].reverse().find((id) => id !== winner) ??
    ARENA_CHARACTERS.find((c) => c !== winner)!;
  const others = ARENA_CHARACTERS.filter((c) => c !== winner && c !== mainRival);
  return {
    frontRight: winner,
    frontLeft: mainRival,
    backRight: others[0],
    backLeft: others[1],
  };
}

/** Compute lunge offset (in stage %) for an attacker moving toward target. */
function getLungeOffset(
  attackerSlot: SlotId,
  targetSlot: SlotId,
): { dx: number; dy: number } {
  const sameRow = attackerSlot.startsWith("front") === targetSlot.startsWith("front");
  const sameCol = attackerSlot.endsWith("Left") === targetSlot.endsWith("Left");
  if (sameRow && sameCol) return { dx: 0, dy: 0 };

  if (sameRow) {
    // 10% horizontal toward target
    const dir = targetSlot.endsWith("Right") ? 1 : -1;
    return { dx: dir * 10, dy: 0 };
  }
  if (sameCol) {
    // 10% vertical toward target
    const dir = targetSlot.startsWith("front") ? 1 : -1;
    return { dx: 0, dy: dir * 10 };
  }
  // Diagonal → lunge ~80% of the way toward ring center
  const a = SLOT_POSITIONS[attackerSlot];
  return { dx: (RING_CENTER.x - a.x) * 0.85, dy: (RING_CENTER.y - a.y) * 0.85 };
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
  const [lungeId, setLungeId] = useState<ArenaCharacterId | null>(null);
  const [showFightBanner, setShowFightBanner] = useState(true);
  const [currentEvent, setCurrentEvent] = useState<ArenaCombatEvent | null>(null);

  // Pre-computed slot map for this round.
  const slotMap = useMemo(() => computeSlotMap(combatLog, winner), [combatLog, winner]);
  const slotOf = useMemo(() => {
    const map = {} as Record<ArenaCharacterId, SlotId>;
    (Object.keys(slotMap) as SlotId[]).forEach((s) => {
      map[slotMap[s]] = s;
    });
    return map;
  }, [slotMap]);

  // Dismiss the ¡FIGHT! banner after a beat.
  useEffect(() => {
    const t = setTimeout(() => setShowFightBanner(false), FIGHT_BANNER_MS);
    return () => clearTimeout(t);
  }, []);

  // Walk through events on a timer (start after the banner fades).
  useEffect(() => {
    if (showFightBanner) return;
    if (eventIdx >= combatLog.length) {
      const t = setTimeout(onComplete, 1400);
      return () => clearTimeout(t);
    }
    const ev = combatLog[eventIdx];
    setCurrentEvent(ev);
    setPhases((prev) => ({ ...prev, [ev.attacker]: "attack", [ev.target]: "damage" }));
    setHp(() => ({ ...ev.hp }));
    setShakeId(ev.target);
    setLungeId(ev.attacker);

    const reset = setTimeout(() => {
      setPhases((prev) => {
        const next = { ...prev };
        for (const id of ARENA_CHARACTERS) {
          if (ev.hp[id] > 0) next[id] = "stance";
        }
        return next;
      });
      setShakeId(null);
      setLungeId(null);
    }, ATTACK_PHASE_MS);
    const advance = setTimeout(() => setEventIdx((i) => i + 1), EVENT_INTERVAL_MS);

    return () => {
      clearTimeout(reset);
      clearTimeout(advance);
    };
  }, [eventIdx, combatLog, onComplete, showFightBanner]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Current event banner — top */}
      <div className="absolute inset-x-0 top-1 z-20 flex justify-center px-2">
        {currentEvent ? (
          <div
            key={eventIdx}
            className="animate-fade-in rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm"
          >
            <span style={{ color: ARENA_CHARACTER_META[currentEvent.attacker].color }}>
              {ARENA_CHARACTER_META[currentEvent.attacker].name}
            </span>
            <span className="mx-1.5 text-white/70">golpeó a</span>
            <span style={{ color: ARENA_CHARACTER_META[currentEvent.target].color }}>
              {ARENA_CHARACTER_META[currentEvent.target].name}
            </span>
            <span className="ml-2 rounded bg-red-500/25 px-1.5 py-0.5 font-mono text-[10px] text-red-200">
              -{currentEvent.damage}
            </span>
          </div>
        ) : null}
      </div>

      {/* Stage — slot-positioned fighters */}
      <div className="absolute inset-x-0 top-[9%] bottom-[22%]">
        {(Object.keys(slotMap) as SlotId[]).map((slot) => {
          const id = slotMap[slot];
          const slotPos = SLOT_POSITIONS[slot];
          const dead = hp[id] <= 0;
          const isAttacking = lungeId === id;
          const targetSlot = isAttacking && currentEvent ? slotOf[currentEvent.target] : null;
          const lunge = targetSlot ? getLungeOffset(slot, targetSlot) : { dx: 0, dy: 0 };
          // Mirror sprite so it faces this slot's direction.
          const mirror = NATURAL_FACING[id] !== slotPos.facing;
          // Front slots render slightly larger to reinforce depth.
          const heightPct = slot.startsWith("front") ? 58 : 48;

          return (
            <FighterSlot
              key={slot}
              id={id}
              x={slotPos.x + lunge.dx}
              y={slotPos.y + lunge.dy}
              heightPct={heightPct}
              zIndex={slot.startsWith("front") ? 10 : 5}
              phase={dead ? "damage" : phases[id]}
              dead={dead}
              shake={shakeId === id}
              mirror={mirror}
              isWinner={id === winner}
              isBet={id === characterBet}
            />
          );
        })}
      </div>

      {/* ¡FIGHT! banner at start */}
      {showFightBanner && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="animate-scale-in text-center">
            <div
              className="font-display text-6xl font-black uppercase tracking-tighter text-yellow-300 sm:text-7xl"
              style={{ textShadow: "0 0 20px rgba(250,204,21,0.8), 0 0 40px rgba(239,68,68,0.6)" }}
            >
              ¡FIGHT!
            </div>
          </div>
        </div>
      )}

      {/* HP bars — 2×2 grid bottom */}
      <div className="absolute inset-x-2 bottom-2 z-20 grid grid-cols-2 gap-1.5">
        {(["backLeft", "backRight", "frontLeft", "frontRight"] as SlotId[])
          .sort() // keep deterministic
          .map((slot) => {
            const id = slotMap[slot];
            return <HpBar key={slot} id={id} hp={hp[id]} isBet={id === characterBet} />;
          })}
      </div>
    </div>
  );
}

function HpBar({
  id,
  hp,
  isBet,
}: {
  id: ArenaCharacterId;
  hp: number;
  isBet: boolean;
}) {
  const meta = ARENA_CHARACTER_META[id];
  const pct = Math.max(0, Math.min(100, hp));
  return (
    <div
      className={cn(
        "rounded-md border bg-black/65 p-1 backdrop-blur-sm",
        isBet
          ? "border-yellow-400/80 shadow-[0_0_10px_rgba(250,204,21,0.4)]"
          : "border-white/15",
      )}
    >
      <div
        className="flex items-center gap-1 text-[10px] font-bold leading-none"
        style={{ color: meta.color }}
      >
        {isBet && <span className="text-yellow-300">★</span>}
        {meta.name}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: meta.color }}
        />
      </div>
    </div>
  );
}

function FighterSlot({
  id,
  x,
  y,
  heightPct,
  zIndex,
  phase,
  dead,
  shake,
  mirror,
  isWinner,
  isBet,
}: {
  id: ArenaCharacterId;
  x: number;
  y: number;
  heightPct: number;
  zIndex: number;
  phase: "stance" | "attack" | "damage";
  dead: boolean;
  shake: boolean;
  mirror: boolean;
  isWinner: boolean;
  isBet: boolean;
}) {
  return (
    <div
      className="absolute flex items-end justify-center transition-[left,top] duration-300 ease-out"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        height: `${heightPct}%`,
        width: `${heightPct}%`,
        transform: "translate(-50%, -50%)",
        zIndex,
      }}
    >
      <CharacterSprite
        characterId={id}
        phase={phase}
        alpha={dead ? 0.3 : 1}
        shake={shake}
        mirror={mirror}
        className={cn(
          "h-full w-full",
          isWinner && !dead && "drop-shadow-[0_0_24px_rgba(250,204,21,0.9)]",
          isBet && !isWinner && !dead && "drop-shadow-[0_0_14px_rgba(250,204,21,0.5)]",
        )}
      />
    </div>
  );
}