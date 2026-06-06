import { cn } from "@/lib/utils";
import { ARENA_CHARACTERS, type ArenaCharacterId } from "@/lib/games/arena.shared";
import { ARENA_BACKGROUNDS, ARENA_CHARACTER_META } from "./characters";
import { CharacterSprite } from "./CharacterSprite";

/**
 * Lobby screen: shows the 4 fighters in their assigned arena halves and
 * lets the player tap one to select. Renders only — no betting UI here
 * (parent composes BettingPanel below).
 */
export function ArenaLobby({
  selected,
  onSelect,
  disabled,
}: {
  selected: ArenaCharacterId | null;
  onSelect: (id: ArenaCharacterId) => void;
  disabled?: boolean;
}) {
  const left = ARENA_CHARACTERS.filter((id) => ARENA_CHARACTER_META[id].side === "left");
  const right = ARENA_CHARACTERS.filter((id) => ARENA_CHARACTER_META[id].side === "right");

  return (
    <div
      className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
      style={{
        backgroundImage: `url(${ARENA_BACKGROUNDS.lobby})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Stage area where fighters stand (center 55% of height, on the platform). */}
      <div className="absolute inset-x-0 top-[45%] bottom-[8%] grid grid-cols-2 gap-2 px-3">
        <div className="flex items-end justify-around gap-1">
          {left.map((id) => (
            <FighterCard
              key={id}
              id={id}
              selected={selected === id}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
        </div>
        <div className="flex items-end justify-around gap-1">
          {right.map((id) => (
            <FighterCard
              key={id}
              id={id}
              selected={selected === id}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      {/* Top banner */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-3 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-purple-300">Arena Galáctica</div>
        <div className="text-sm font-bold text-white">Elige tu peleador</div>
      </div>
    </div>
  );
}

function FighterCard({
  id,
  selected,
  disabled,
  onSelect,
}: {
  id: ArenaCharacterId;
  selected: boolean;
  disabled?: boolean;
  onSelect: (id: ArenaCharacterId) => void;
}) {
  const meta = ARENA_CHARACTER_META[id];
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(id)}
      disabled={disabled}
      className={cn(
        "group relative flex h-full w-full flex-col items-center justify-end gap-1 rounded-lg p-1 transition disabled:opacity-50",
        selected && "z-10",
      )}
    >
      <CharacterSprite
        characterId={id}
        phase="idle"
        className={cn(
          "h-[70%] w-full transition-transform",
          selected ? "scale-110" : "group-hover:scale-105 opacity-80 group-hover:opacity-100",
        )}
      />
      <div
        className={cn(
          "w-full rounded-md border px-1.5 py-1 text-center backdrop-blur-sm transition",
          selected
            ? "border-2 bg-black/70 shadow-[0_0_18px_currentColor]"
            : "border-white/10 bg-black/40",
        )}
        style={selected ? { borderColor: meta.color, color: meta.color } : undefined}
      >
        <div
          className="text-[10px] font-extrabold leading-tight"
          style={!selected ? { color: meta.color } : undefined}
        >
          {meta.name}
        </div>
        <div className="font-mono text-xs font-bold text-white">{meta.odds.toFixed(2)}×</div>
      </div>
    </button>
  );
}