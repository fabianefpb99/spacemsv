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

/** Center-point of each slot inside the stage area (percentages).
 *  Layout boceto: 4 personajes casi en l\u00ednea, con depth sutil.
 *  Front (Shadow/Titan) m\u00e1s grandes y separados a los extremos;
 *  Back (Nova/Blaze) m\u00e1s peque\u00f1os, justo detr\u00e1s entre ellos. */
const SLOT_POSITIONS: Record<SlotId, { x: number; y: number; facing: "left" | "right" }> = {
  backLeft: { x: 33, y: 47, facing: "right" },
  backRight: { x: 67, y: 47, facing: "left" },
  frontLeft: { x: 18, y: 64, facing: "right" },
  frontRight: { x: 82, y: 64, facing: "left" },
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

/** Posiciones fijas por boceto:
 *   Shadow front-left, Nova back-left, Blaze back-right, Titan front-right.
 *  As\u00ed cada personaje mira hacia el centro sin necesidad de mirror. */
const FIXED_SLOT_MAP: Record<SlotId, ArenaCharacterId> = {
  frontLeft: "shadow",
  backLeft: "nova",
  backRight: "blaze",
  frontRight: "titan",
};

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

  // Slot map dinámico: arranca con el boceto y se reorganiza antes de cada
  // golpe si atacante y objetivo quedan en la misma columna (sin ángulo).
  const [slotMap, setSlotMap] = useState<Record<SlotId, ArenaCharacterId>>(FIXED_SLOT_MAP);
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

    // 1) Reorganizar slots si la pareja no tiene ángulo de ataque.
    const reorganized = reorganizeForEvent(slotMap, ev.attacker, ev.target);
    const needsSwap = reorganized !== slotMap;
    if (needsSwap) setSlotMap(reorganized);

    // 2) Disparar el golpe (tras un beat si hubo swap, para que se "acomoden").
    const swapDelay = needsSwap ? SWAP_PREP_MS : 0;
    const startAttack = setTimeout(() => {
      setPhases((prev) => ({ ...prev, [ev.attacker]: "attack", [ev.target]: "damage" }));
      setHp(() => ({ ...ev.hp }));
      setShakeId(ev.target);
      setLungeId(ev.attacker);
    }, swapDelay);

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
    }, swapDelay + ATTACK_PHASE_MS);
    const advance = setTimeout(() => setEventIdx((i) => i + 1), swapDelay + EVENT_INTERVAL_MS);

    return () => {
      clearTimeout(startAttack);
      clearTimeout(reset);
      clearTimeout(advance);
    };
  }, [eventIdx, combatLog, onComplete, showFightBanner, slotMap]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Current event banner — 3 líneas centradas (atacante / acción / objetivo) */}
      <div className="absolute inset-x-0 top-[14%] z-20 flex justify-center px-4">
        {currentEvent ? (
          <div
            key={eventIdx}
            className="animate-fade-in flex flex-col gap-0.5 font-extrabold uppercase leading-none tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
          >
            <span
              className="self-start text-[30px]"
              style={{ color: ARENA_CHARACTER_META[currentEvent.attacker].color }}
            >
              {ARENA_CHARACTER_META[currentEvent.attacker].name}
            </span>
            <span className="self-center text-[22px] text-white">GOLPEÓ A</span>
            <span
              className="self-end text-[30px]"
              style={{ color: ARENA_CHARACTER_META[currentEvent.target].color }}
            >
              {ARENA_CHARACTER_META[currentEvent.target].name}
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
          // Mismo tamaño en front y back — la profundidad la da la posición Y,
          // no el escalado (si encogemos atrás, al avanzar parecen enanos).
          const heightPct = 65;

          // Profundidad: el atacante sube en jerarquía sólo lo necesario para
          // quedar por encima del objetivo y su compañero de fila, pero nunca
          // por encima de los personajes del lado opuesto de la fila delantera
          // (eso lo haría ver "más cerca de la cámara" de lo que está).
          const attackerSlot = lungeId ? slotOf[lungeId] : null;
          const currentTargetSlot = currentEvent ? slotOf[currentEvent.target] : null;
          const attackerIsBack = attackerSlot?.startsWith("back") ?? false;
          const targetIsFront = currentTargetSlot?.startsWith("front") ?? false;
          const baseZ = slot.startsWith("front") ? 10 : 5;
          let zIndex = baseZ;
          if (isAttacking) {
            // Si el atacante es de atrás y va al frente: queda apenas encima del
            // objetivo (front=10 → 11). Si ya es del frente, mantiene su rango +1.
            zIndex = attackerIsBack && targetIsFront ? 11 : baseZ + 5;
          } else if (attackerIsBack && targetIsFront && slot.startsWith("front") && slot !== attackerSlot) {
            // El otro frontal (no involucrado) sube para mantenerse por encima
            // del atacante que invade la zona delantera.
            zIndex = 12;
          }

          return (
            <FighterSlot
              key={slot}
              id={id}
              x={slotPos.x + lunge.dx}
              y={slotPos.y + lunge.dy}
              heightPct={heightPct}
              zIndex={zIndex}
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

      {/* ¡FIGHT! banner — blanco minimalista */}
      {showFightBanner && (
        <div className="pointer-events-none absolute inset-x-0 top-[18%] z-30 flex justify-center">
          <div className="animate-scale-in text-center">
            <div
              className="font-display text-6xl font-black uppercase tracking-tight text-white sm:text-7xl"
              style={{ textShadow: "0 4px 14px rgba(0,0,0,0.85)" }}
            >
              ¡FIGHT!
            </div>
          </div>
        </div>
      )}

      {/* HP bars — fila arriba NOVA/TITAN angostas; fila abajo SHADOW/BLAZE anchas. */}
      <div className="absolute inset-x-3 bottom-3 z-20 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <HpBar id="nova" hp={hp.nova} isBet={characterBet === "nova"} narrow />
          <HpBar id="titan" hp={hp.titan} isBet={characterBet === "titan"} narrow />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HpBar id="shadow" hp={hp.shadow} isBet={characterBet === "shadow"} />
          <HpBar id="blaze" hp={hp.blaze} isBet={characterBet === "blaze"} />
        </div>
      </div>
    </div>
  );
}

function HpBar({
  id,
  hp,
  isBet,
  narrow = false,
}: {
  id: ArenaCharacterId;
  hp: number;
  isBet: boolean;
  narrow?: boolean;
}) {
  const meta = ARENA_CHARACTER_META[id];
  const pct = Math.max(0, Math.min(100, hp));
  return (
    <div className={cn("flex flex-col items-center", narrow && "px-6")}>
      <div
        className="mb-1 flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]"
        style={{ color: "#ffffff" }}
      >
        {isBet && <span className="text-yellow-300">\u2605</span>}
        {meta.name}
      </div>
      <div
        className={cn(
          "h-2.5 w-full overflow-hidden rounded-full border bg-black/40 backdrop-blur-sm",
          isBet ? "border-yellow-300/90 shadow-[0_0_10px_rgba(250,204,21,0.5)]" : "border-white/70",
        )}
      >
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