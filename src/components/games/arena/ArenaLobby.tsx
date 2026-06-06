import { cn } from "@/lib/utils";
import { ARENA_CHARACTERS, type ArenaCharacterId } from "@/lib/games/arena.shared";
import { ARENA_BACKGROUNDS, ARENA_CHARACTER_META } from "./characters";
import { CharacterSprite } from "./CharacterSprite";

/**
 * Lobby (selection) — fills the parent stage with the platform backdrop and
 * places the 4 fighters on top of it. No card / no wrapper border: the
 * artwork *is* the game surface. Parent composes the HUD below.
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
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fighters standing on the 4 platforms in the backdrop.
          The platforms sit roughly in the lower-middle of the artwork;
          fighters are large and their feet land on the platform line. */}
      <div className="absolute inset-x-0 top-[8%] bottom-[18%] grid grid-cols-4 gap-0 px-1">
        {ARENA_CHARACTERS.map((id) => (
          <FighterCard
            key={id}
            id={id}
            selected={selected === id}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 top-1 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-purple-200/90 drop-shadow">
          Elige tu peleador
        </div>
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
        "group relative flex h-full w-full flex-col items-center justify-end gap-1 transition disabled:opacity-50",
        selected && "z-10",
      )}
    >
      <CharacterSprite
        characterId={id}
        phase="idle"
        className={cn(
          "h-[88%] w-full transition-transform",
          selected ? "scale-110" : "opacity-90 group-hover:scale-105 group-hover:opacity-100",
        )}
      />
      <div
        className={cn(
          "w-full rounded-md border px-1 py-0.5 text-center backdrop-blur-sm transition",
          selected
            ? "border-2 bg-black/70 shadow-[0_0_18px_currentColor]"
            : "border-white/10 bg-black/40",
        )}
        style={selected ? { borderColor: meta.color, color: meta.color } : undefined}
      >
        <div
          className="text-[9px] font-extrabold leading-tight"
          style={!selected ? { color: meta.color } : undefined}
        >
          {meta.name}
        </div>
        <div className="font-mono text-[11px] font-bold text-white">{meta.odds.toFixed(2)}×</div>
      </div>
    </button>
  );
}