import { cn } from "@/lib/utils";
import { ARENA_CHARACTER_META, type ArenaSpritePhase } from "./characters";
import type { ArenaCharacterId } from "@/lib/games/arena.shared";

/**
 * Renders a single character sprite at a given phase.
 * Side is read from character meta; right-side characters are flipped
 * horizontally so both teams face the center.
 *
 * NOTE: the source PNGs are already drawn facing the opposite half
 * (Nova/Shadow face right, Titan/Blaze face left), so no flip is applied
 * by default. Set `mirror` to override.
 */
export function CharacterSprite({
  characterId,
  phase,
  className,
  alpha = 1,
  mirror = false,
  shake = false,
  fit = "contain",
}: {
  characterId: ArenaCharacterId;
  phase: ArenaSpritePhase;
  className?: string;
  alpha?: number;
  mirror?: boolean;
  shake?: boolean;
  fit?: "contain" | "height";
}) {
  const meta = ARENA_CHARACTER_META[characterId];
  return (
    <div
      className={cn(
        "transition-transform duration-200",
        className,
      )}
      style={{
        transform: mirror ? "scaleX(-1)" : undefined,
      }}
    >
      <img
        src={meta.sprites[phase]}
        alt={meta.name}
        draggable={false}
        className={cn(
          "pointer-events-none select-none object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-200",
          fit === "height" ? "h-full w-auto max-w-none" : "h-full w-full",
          shake && "animate-[arena-shake_0.45s_ease-in-out]",
        )}
        style={{
          opacity: alpha,
        }}
      />
    </div>
  );
}