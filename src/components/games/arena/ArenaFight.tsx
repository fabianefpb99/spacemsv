import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ARENA_CHARACTERS,
  type ArenaCharacterId,
  type ArenaCombatEvent,
} from "@/lib/games/arena.shared";
import { ARENA_CHARACTER_META } from "./characters";
import { CharacterSprite } from "./CharacterSprite";
import arenaFightAudio from "@/assets/audio/arena/arena-fight.mp3.asset.json";
import hit1Audio from "@/assets/audio/arena/hit-1.mp3.asset.json";
import hit2Audio from "@/assets/audio/arena/hit-2.mp3.asset.json";
import hit3Audio from "@/assets/audio/arena/hit-3.mp3.asset.json";
import hit4Audio from "@/assets/audio/arena/hit-4.mp3.asset.json";
import hit5Audio from "@/assets/audio/arena/hit-5.mp3.asset.json";
import hitFinalAudio from "@/assets/audio/arena/hit-final.mp3.asset.json";
import fightStartAudio from "@/assets/audio/arena/fight-start.mp3.asset.json";

function useFightStartSfx() {
  useEffect(() => {
    const a = new Audio(fightStartAudio.url);
    a.preload = "auto";
    a.volume = 0.35;
    const play = () => {
      try {
        a.currentTime = 0;
        void a.play();
      } catch {
        // ignore
      }
    };
    play();
    return () => {
      a.pause();
    };
  }, []);
}

function useHitSfx() {
  // Pool de Audio elements pre-cargados (3 instancias por sonido).
  // Reproducir desde una instancia ya cargada => latencia ~0 (sincronizado
  // con el sprite de golpe). Rotar entre 3 copias evita el problema de
  // re-disparar el mismo elemento mientras play() está pendiente.
  const poolsRef = useRef<{ hits: HTMLAudioElement[][]; final: HTMLAudioElement[] }>({
    hits: [],
    final: [],
  });
  const rotationRef = useRef(0);
  const poolIdxRef = useRef<Record<number, number>>({});
  const finalIdxRef = useRef(0);

  useEffect(() => {
    const hitUrls = [
      hit1Audio.url,
      hit2Audio.url,
      hit3Audio.url,
      hit4Audio.url,
      hit5Audio.url,
    ];
    const COPIES = 2;
    poolsRef.current.hits = hitUrls.map((u) => {
      const arr: HTMLAudioElement[] = [];
      for (let i = 0; i < COPIES; i++) {
        const a = new Audio(u);
        a.preload = "auto";
        a.volume = 0.55;
        a.load();
        arr.push(a);
      }
      return arr;
    });
    poolsRef.current.final = [];
    for (let i = 0; i < COPIES; i++) {
      const a = new Audio(hitFinalAudio.url);
      a.preload = "auto";
      a.volume = 0.75;
      a.load();
      poolsRef.current.final.push(a);
    }
    return () => {
      poolsRef.current.hits.flat().concat(poolsRef.current.final).forEach((a) => {
        try {
          a.pause();
          a.src = "";
        } catch {
          // ignore
        }
      });
      poolsRef.current.hits = [];
      poolsRef.current.final = [];
    };
  }, []);

  return useMemo(
    () => ({
      playHit(isFinal: boolean) {
        let a: HTMLAudioElement | undefined;
        if (isFinal) {
          const pool = poolsRef.current.final;
          if (!pool.length) return;
          a = pool[finalIdxRef.current % pool.length];
          finalIdxRef.current++;
        } else {
          const pools = poolsRef.current.hits;
          if (!pools.length) return;
          const soundIdx = rotationRef.current % pools.length;
          rotationRef.current++;
          const pool = pools[soundIdx];
          const next = (poolIdxRef.current[soundIdx] ?? 0) % pool.length;
          poolIdxRef.current[soundIdx] = next + 1;
          a = pool[next];
        }
        if (!a) return;
        try {
          a.pause();
          a.currentTime = 0;
        } catch {
          // ignore
        }
        const p = a.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      },
    }),
    [],
  );
}

function useFightMusic() {
  useEffect(() => {
    const TARGET_VOLUME = 0.022;
    const FADE_IN_MS = 500;
    const FADE_OUT_MS = 1200;
    const audio = new Audio(arenaFightAudio.url);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0;

    let cancelled = false;
    let raf: number | null = null;

    function fade(from: number, to: number, ms: number, onDone?: () => void) {
      const start = performance.now();
      function step(now: number) {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / ms);
        audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
        if (t < 1) raf = requestAnimationFrame(step);
        else onDone?.();
      }
      raf = requestAnimationFrame(step);
    }

    async function start() {
      try {
        await audio.play();
        fade(0, TARGET_VOLUME, FADE_IN_MS);
      } catch {
        const retry = () => {
          window.removeEventListener("pointerdown", retry);
          start();
        };
        window.addEventListener("pointerdown", retry, { once: true });
      }
    }
    start();

    let wasPlayingBeforeHide = false;
    const onVisibility = () => {
      if (document.hidden) {
        wasPlayingBeforeHide = !audio.paused;
        audio.pause();
      } else if (wasPlayingBeforeHide) {
        void audio.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      const startVol = audio.volume;
      const t0 = performance.now();
      const fadeOut = () => {
        const t = Math.min(1, (performance.now() - t0) / FADE_OUT_MS);
        audio.volume = Math.max(0, startVol * (1 - t));
        if (t < 1) requestAnimationFrame(fadeOut);
        else {
          audio.pause();
          audio.src = "";
        }
      };
      requestAnimationFrame(fadeOut);
    };
  }, []);
}

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
const FIGHT_BANNER_MS = 1400;
const PRE_ATTACK_REPOSITION_MS = 220;

type SlotId = "backLeft" | "backRight" | "frontLeft" | "frontRight";
type SlotMap = Record<SlotId, ArenaCharacterId>;
type PhaseMap = Record<ArenaCharacterId, "stance" | "attack" | "damage">;

/** Center-point of each slot inside the stage area (percentages).
 *  Layout boceto: 4 personajes casi en l\u00ednea, con depth sutil.
 *  Front (Shadow/Titan) m\u00e1s grandes y separados a los extremos;
 *  Back (Nova/Blaze) m\u00e1s peque\u00f1os, justo detr\u00e1s entre ellos. */
const SLOT_POSITIONS: Record<SlotId, { x: number; y: number; facing: "left" | "right" }> = {
  backLeft: { x: 33, y: 43, facing: "right" },
  backRight: { x: 67, y: 43, facing: "left" },
  frontLeft: { x: 18, y: 58, facing: "right" },
  frontRight: { x: 82, y: 58, facing: "left" },
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

const SLOT_IDS: SlotId[] = ["backLeft", "backRight", "frontLeft", "frontRight"];
const NATURAL_SIDE: Record<ArenaCharacterId, "Left" | "Right"> = {
  shadow: "Left",
  nova: "Left",
  blaze: "Right",
  titan: "Right",
};

function getSlotOf(map: SlotMap): Record<ArenaCharacterId, SlotId> {
  const next = {} as Record<ArenaCharacterId, SlotId>;
  SLOT_IDS.forEach((slot) => {
    next[map[slot]] = slot;
  });
  return next;
}

function getOppositeSideSlot(slot: SlotId): SlotId {
  switch (slot) {
    case "backLeft":
      return "backRight";
    case "backRight":
      return "backLeft";
    case "frontLeft":
      return "frontRight";
    case "frontRight":
      return "frontLeft";
  }
}

function swapSlots(map: SlotMap, from: SlotId, to: SlotId): SlotMap {
  if (from === to) return map;
  return {
    ...map,
    [from]: map[to],
    [to]: map[from],
  };
}

function isBlockedSameColumnAttack(
  map: SlotMap,
  attacker: ArenaCharacterId,
  target: ArenaCharacterId,
): boolean {
  const slotOf = getSlotOf(map);
  const attackerSlot = slotOf[attacker];
  const targetSlot = slotOf[target];
  const sameCol = attackerSlot.endsWith("Left") === targetSlot.endsWith("Left");
  return sameCol && attackerSlot.startsWith("back") && targetSlot.startsWith("front");
}

function reorganizeForEvent(
  currentMap: SlotMap,
  attacker: ArenaCharacterId,
  target: ArenaCharacterId,
  currentHp: Record<ArenaCharacterId, number>,
): SlotMap {
  if (!isBlockedSameColumnAttack(currentMap, attacker, target)) return currentMap;

  const currentSlotOf = getSlotOf(currentMap);
  const attackerSlot = currentSlotOf[attacker];
  const targetSlot = currentSlotOf[target];
  const candidates = [
    swapSlots(currentMap, targetSlot, getOppositeSideSlot(targetSlot)),
    swapSlots(currentMap, attackerSlot, getOppositeSideSlot(attackerSlot)),
  ];

  let bestMap: SlotMap | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (isBlockedSameColumnAttack(candidate, attacker, target)) continue;

    const candidateSlotOf = getSlotOf(candidate);
    const movedIds = ARENA_CHARACTERS.filter((id) => currentSlotOf[id] !== candidateSlotOf[id]);
    const deadMoves = movedIds.filter((id) => currentHp[id] <= 0).length;

    let naturalSideViolations = 0;
    let bocetoMisses = 0;
    for (const slot of SLOT_IDS) {
      const side = slot.endsWith("Left") ? "Left" : "Right";
      if (NATURAL_SIDE[candidate[slot]] !== side) naturalSideViolations++;
      if (candidate[slot] !== FIXED_SLOT_MAP[slot]) bocetoMisses++;
    }

    const score = deadMoves * 1000 + naturalSideViolations * 10 + bocetoMisses;
    if (!bestMap || score < bestScore) {
      bestMap = candidate;
      bestScore = score;
    }
  }

  return bestMap ?? currentMap;
}

export function ArenaFight({
  combatLog,
  winner,
  characterBet,
  resultMode = false,
  onComplete,
}: {
  combatLog: ArenaCombatEvent[];
  winner: ArenaCharacterId;
  characterBet: ArenaCharacterId;
  resultMode?: boolean;
  onComplete: () => void;
}) {
  useFightMusic();
  useFightStartSfx();
  const { playHit } = useHitSfx();
  const [eventIdx, setEventIdx] = useState(0);
  const [phases, setPhases] = useState<PhaseMap>(freshPhases);
  const [hp, setHp] = useState<Record<ArenaCharacterId, number>>(freshHp);
  const [shakeId, setShakeId] = useState<ArenaCharacterId | null>(null);
  const [lungeId, setLungeId] = useState<ArenaCharacterId | null>(null);
  const [showFightBanner, setShowFightBanner] = useState(true);
  const [currentEvent, setCurrentEvent] = useState<ArenaCombatEvent | null>(null);
  const [slotMap, setSlotMap] = useState<SlotMap>(FIXED_SLOT_MAP);
  const slotMapRef = useRef<SlotMap>(FIXED_SLOT_MAP);
  const hpRef = useRef<Record<ArenaCharacterId, number>>(freshHp());

  const slotOf = useMemo(() => getSlotOf(slotMap), [slotMap]);

  useEffect(() => {
    if (!showFightBanner) return;
    const t = setTimeout(() => setShowFightBanner(false), FIGHT_BANNER_MS);
    return () => clearTimeout(t);
  }, [showFightBanner]);

  useEffect(() => {
    setEventIdx(0);
    setPhases(freshPhases());
    setHp(freshHp());
    setShakeId(null);
    setLungeId(null);
    setShowFightBanner(true);
    setCurrentEvent(null);
    setSlotMap(FIXED_SLOT_MAP);
    slotMapRef.current = FIXED_SLOT_MAP;
    hpRef.current = freshHp();
  }, [combatLog, winner, characterBet]);

  useEffect(() => {
    slotMapRef.current = slotMap;
  }, [slotMap]);

  useEffect(() => {
    hpRef.current = hp;
  }, [hp]);

  // Walk through events on a timer (start after the banner fades).
  useEffect(() => {
    if (showFightBanner) return;
    if (eventIdx >= combatLog.length) {
      const t = setTimeout(onComplete, 1400);
      return () => clearTimeout(t);
    }
    const ev = combatLog[eventIdx];
    const repositionedMap = reorganizeForEvent(
      slotMapRef.current,
      ev.attacker,
      ev.target,
      hpRef.current,
    );
    const needsReposition = repositionedMap !== slotMapRef.current;

    if (needsReposition) {
      slotMapRef.current = repositionedMap;
      setSlotMap(repositionedMap);
    }

    const attackStartDelay = needsReposition ? PRE_ATTACK_REPOSITION_MS : 0;
    const startAttack = setTimeout(() => {
      setCurrentEvent(ev);
      setPhases((prev) => ({ ...prev, [ev.attacker]: "attack", [ev.target]: "damage" }));
      setHp(() => ({ ...ev.hp }));
      setShakeId(ev.target);
      setLungeId(ev.attacker);
      const isFinal = ev.finisher === true || eventIdx === combatLog.length - 1;
      playHit(isFinal);
    }, attackStartDelay);

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
    }, attackStartDelay + ATTACK_PHASE_MS);
    const advance = setTimeout(() => setEventIdx((i) => i + 1), attackStartDelay + EVENT_INTERVAL_MS);

    return () => {
      clearTimeout(startAttack);
      clearTimeout(reset);
      clearTimeout(advance);
    };
  }, [eventIdx, combatLog, onComplete, showFightBanner]);

  return (
    <div className="absolute inset-y-0 -inset-x-3 overflow-visible">
      <div className="absolute inset-y-0 left-3 right-3 overflow-visible">
      {/* Current event banner — 3 líneas centradas (atacante / acción / objetivo) */}
      {!resultMode && <div className="absolute inset-x-0 top-[7%] z-20 flex justify-center px-2">
        {currentEvent ? (
          <div
            key={eventIdx}
            className="animate-fade-in flex w-full flex-col gap-0.5 font-display font-extrabold uppercase leading-none tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
          >
            <span
              className="self-start pl-10 text-[30px]"
              style={{ color: ARENA_CHARACTER_META[currentEvent.attacker].color }}
            >
              {ARENA_CHARACTER_META[currentEvent.attacker].name}
            </span>
            <span className="self-center text-[22px] text-white">GOLPEÓ A</span>
            <span
              className="self-end pr-10 text-[30px]"
              style={{ color: ARENA_CHARACTER_META[currentEvent.target].color }}
            >
              {ARENA_CHARACTER_META[currentEvent.target].name}
            </span>
          </div>
        ) : null}
      </div>}

      {/* Stage — slot-positioned fighters */}
      <div className="absolute inset-x-0 top-[9%] bottom-[22%] overflow-visible [@media(min-height:880px)]:-translate-y-[3%]">
        {resultMode && (
          <>
            {/* Floor glow under the winner */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[52%] z-[3] -translate-x-1/2 -translate-y-1/2 animate-fade-in"
              style={{
                width: "70%",
                height: "22%",
                borderRadius: "9999px",
                background: `radial-gradient(ellipse at center, ${ARENA_CHARACTER_META[winner].color}aa 0%, ${ARENA_CHARACTER_META[winner].color}44 45%, transparent 80%)`,
                filter: "blur(22px)",
              }}
            />
            {/* Backlight burst behind the winner */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[40%] z-[2] -translate-x-1/2 -translate-y-1/2 animate-fade-in"
              style={{
                width: "120%",
                height: "120%",
                borderRadius: "9999px",
                background: `radial-gradient(circle at center, ${ARENA_CHARACTER_META[winner].color}55 0%, ${ARENA_CHARACTER_META[winner].color}1a 35%, transparent 65%)`,
                filter: "blur(40px)",
                animation: "arena-winner-pulse 2.2s ease-in-out infinite",
              }}
            />
          </>
        )}
        {/* Speed streak — aura detrás del atacante mientras avanza al golpe. */}
        {!resultMode && currentEvent && lungeId && (() => {
          const aSlot = slotOf[lungeId];
          const tSlot = slotOf[currentEvent.target];
          const start = SLOT_POSITIONS[aSlot];
          const lunge = getLungeOffset(aSlot, tSlot);
          if (lunge.dx === 0 && lunge.dy === 0) return null;
          // Anclar el rastro a la cadera (no la cabeza). El sprite se dibuja con
          // object-contain alineado al bottom dentro de un slot de 65% de alto,
          // así que la cadera queda aprox. +14% bajo el centro del slot.
          const HIP_OFFSET_Y = 14;
          const sx = start.x;
          const sy = start.y + HIP_OFFSET_Y;
          const endX = start.x + lunge.dx;
          const endY = start.y + lunge.dy + HIP_OFFSET_Y;
          const color = ARENA_CHARACTER_META[lungeId].color;
          const gradId = `arena-streak-grad-${lungeId}`;
          const blurId = `arena-streak-blur-${lungeId}`;
          return (
            <svg
              key={`streak-${eventIdx}`}
              className="pointer-events-none absolute inset-0 z-[4] animate-fade-in"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient
                  id={gradId}
                  gradientUnits="userSpaceOnUse"
                  x1={sx}
                  y1={sy}
                  x2={endX}
                  y2={endY}
                >
                  <stop offset="0%" stopColor={color} stopOpacity="0" />
                  <stop offset="35%" stopColor={color} stopOpacity="0.25" />
                  <stop offset="70%" stopColor={color} stopOpacity="0.55" />
                  <stop offset="92%" stopColor={color} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
                <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.4" />
                </filter>
              </defs>
              <g filter={`url(#${blurId})`}>
                {/* Halo exterior — muy difuso, ancho */}
                <line
                  x1={sx} y1={sy} x2={endX} y2={endY}
                  stroke={`url(#${gradId})`}
                  strokeWidth="34"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.35"
                />
                {/* Cuerpo medio */}
                <line
                  x1={sx} y1={sy} x2={endX} y2={endY}
                  stroke={`url(#${gradId})`}
                  strokeWidth="16"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.6"
                />
                {/* Núcleo brillante */}
                <line
                  x1={sx} y1={sy} x2={endX} y2={endY}
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.55"
                />
              </g>
            </svg>
          );
        })()}
        {(resultMode
          ? [{ id: winner, slot: "frontRight" as SlotId }]
          : (Object.keys(slotMap) as SlotId[]).map((slot) => ({ id: slotMap[slot], slot }))).map(({ id, slot }, index) => {
          const slotPos = SLOT_POSITIONS[slot];
          const dead = resultMode ? false : hp[id] <= 0;
          const isAttacking = !resultMode && lungeId === id;
          const targetSlot = !resultMode && isAttacking && currentEvent ? slotOf[currentEvent.target] : null;
          const lunge = targetSlot ? getLungeOffset(slot, targetSlot) : { dx: 0, dy: 0 };
          // Mirror sprite so it faces this slot's direction.
          const mirror = resultMode ? false : NATURAL_FACING[id] !== slotPos.facing;
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
              key={resultMode ? `winner-${winner}-${index}` : slot}
              id={id}
              slot={slot}
              x={resultMode ? 50 : slotPos.x + lunge.dx}
              y={resultMode ? 48 : slotPos.y + lunge.dy}
              heightPct={resultMode ? 88 : heightPct}
              zIndex={resultMode ? 24 : zIndex}
              phase={resultMode ? "stance" : dead ? "damage" : phases[id]}
              dead={resultMode ? false : dead}
              shake={resultMode ? false : shakeId === id}
              mirror={resultMode ? false : mirror}
              isWinner={id === winner}
              isBet={id === characterBet}
            />
          );
        })}
      </div>

      {/* ¡FIGHT! banner — blanco minimalista */}
      {!resultMode && showFightBanner && (
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
      {!resultMode && <div className="absolute inset-x-3 bottom-6 z-20 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <HpBar id="nova" hp={hp.nova} isBet={characterBet === "nova"} />
          <HpBar id="titan" hp={hp.titan} isBet={characterBet === "titan"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HpBar id="shadow" hp={hp.shadow} isBet={characterBet === "shadow"} />
          <HpBar id="blaze" hp={hp.blaze} isBet={characterBet === "blaze"} />
        </div>
      </div>}
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
    <div className="flex flex-col items-center">
      <div
        className="mb-1 flex items-center gap-1 text-[13px] font-extrabold uppercase tracking-wider drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]"
        style={{ color: "#ffffff" }}
      >
        {isBet && <span className="text-yellow-300">★</span>}
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
  slot,
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
  slot: SlotId;
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
  const needsHorizontalBleed = slot === "frontLeft" || slot === "frontRight";
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
      {isBet && !isWinner && !dead && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 animate-pulse"
          style={{
            width: "62%",
            height: "24%",
            background:
              "radial-gradient(ellipse at center, rgba(250,204,21,0.7) 0%, rgba(250,204,21,0.32) 42%, rgba(250,204,21,0) 78%)",
            borderRadius: "9999px",
            filter: "blur(8px)",
          }}
        />
      )}
      <div
        className="pointer-events-none flex h-full items-end justify-center overflow-visible"
        style={{ width: needsHorizontalBleed ? "calc(100% + 20vw)" : "100%" }}
      >
        {/* Sombra suave bajo los pies — anclada al inner container para que
            siga al sprite tanto en pelea como en la pose ganadora, sin
            desbordarse del slot. */}
        {!dead && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 bottom-[17%] -translate-x-1/2"
            style={{
              width: "38%",
              height: "3.6%",
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 82%)",
              borderRadius: "9999px",
              filter: "blur(2px)",
              zIndex: 0,
            }}
          />
        )}
        <CharacterSprite
          characterId={id}
          phase={phase}
          alpha={dead ? 0.3 : 1}
          shake={shake}
          mirror={mirror}
          fit="contain"
          className="relative z-[1] h-full"
        />
      </div>
    </div>
  );
}