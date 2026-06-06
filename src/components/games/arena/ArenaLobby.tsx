import { cn } from "@/lib/utils";
import { ARENA_CHARACTERS, type ArenaCharacterId } from "@/lib/games/arena.shared";
import { ARENA_CHARACTER_META } from "./characters";
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
      <div className="absolute left-0 right-0 top-1 flex items-center justify-between px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/90 sm:px-4">
        <div className="flex items-center gap-1.5 text-white/85">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
          152 ONLINE
        </div>
        <div className="rounded-md border border-white/15 bg-black/45 px-2 py-0.5 text-white/85">
          <span className="text-white/55">Inicio en </span>
          <span className="font-mono text-white">00:07</span>
        </div>
      </div>

      <div className="absolute inset-x-0 top-[9%] text-center">
        <h1 className="font-display text-[clamp(1.9rem,7.5vw,2.8rem)] font-black uppercase leading-[0.92] tracking-[0.06em] text-white [text-shadow:0_0_18px_rgba(255,255,255,0.35)]">
          Arena
          <br />
          <span className="text-fuchsia-300">de Campeones</span>
        </h1>
      </div>

      <div className="absolute inset-x-0 top-[24%] bottom-0 grid grid-cols-4 gap-0 px-0">
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
        "group relative flex h-full w-full flex-col items-center justify-end transition disabled:opacity-50",
        selected && "z-10",
      )}
    >
      <div
        className="absolute bottom-[20%] left-1/2 h-6 w-[80%] -translate-x-1/2 rounded-full blur-md transition-all duration-300"
        style={{ backgroundColor: meta.glow, opacity: selected ? 0.95 : 0.55 }}
      />
      <CharacterSprite
        characterId={id}
        phase="idle"
        className={cn(
          "relative z-10 h-[88%] w-[170%] max-w-none -mb-1 transition-transform duration-300",
          selected ? "scale-[1.18]" : "scale-[1.08] opacity-95 group-hover:scale-[1.14] group-hover:opacity-100",
        )}
      />
      <div
        className={cn(
          "relative z-10 w-[96%] rounded-lg border px-1 py-0.5 text-center backdrop-blur-md transition",
          selected
            ? "border-white/40 shadow-[0_0_30px_rgba(255,255,255,0.08)]"
            : "border-white/10",
        )}
        style={{
          borderColor: selected ? meta.color : undefined,
          background: selected
            ? `linear-gradient(180deg, ${meta.panelTone} 0%, rgba(6,2,16,0.84) 100%)`
            : `linear-gradient(180deg, rgba(10,6,24,0.84) 0%, rgba(6,2,16,0.88) 100%)`,
          boxShadow: selected ? `0 0 24px ${meta.glow}` : undefined,
        }}
      >
        <div className="text-[10px] font-black uppercase leading-tight" style={{ color: meta.color }}>
          {meta.name}
        </div>
        <div className="mt-0.5 flex items-baseline justify-center gap-1 leading-none">
          <span className="text-[14px] font-black" style={{ color: meta.color }}>
            {meta.odds.toFixed(2)}x
          </span>
        </div>
        <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/55">
          {meta.wins} wins
        </div>
      </div>
    </button>
  );
}