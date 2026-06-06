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
      <div className="absolute left-0 right-0 top-2 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 sm:px-4">
        <div className="flex items-center gap-1.5 text-white/85">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.7)]" />
          152 ONLINE
        </div>
        <div className="text-white/70">ARENA DE CAMPEONES</div>
      </div>

      <div className="absolute inset-x-0 top-[9%] text-center">
        <h1 className="text-balance font-display text-[clamp(2.4rem,8vw,3.6rem)] font-black uppercase leading-none text-white [text-shadow:0_0_24px_rgba(255,255,255,0.35)]">
          Arena
        </h1>
        <div className="mt-1 text-[clamp(1rem,3.6vw,1.35rem)] font-extrabold uppercase tracking-[0.18em] text-fuchsia-300 [text-shadow:0_0_16px_rgba(217,70,239,0.5)]">
          de campeones
        </div>
      </div>

      <div className="absolute inset-x-[14%] top-[22%] rounded-[18px] border border-white/10 bg-black/28 px-4 py-2 text-center backdrop-blur-[6px]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
          La batalla comienza en
        </div>
        <div className="font-display text-[clamp(2rem,8vw,2.8rem)] font-black leading-none text-white">00:07</div>
      </div>

      <div className="absolute inset-x-0 top-[31%] bottom-[23%] grid grid-cols-4 gap-0 px-1">
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
        "group relative flex h-full w-full flex-col items-center justify-end gap-2 transition disabled:opacity-50",
        selected && "z-10",
      )}
    >
      <div
        className="absolute bottom-[19%] left-1/2 h-7 w-[78%] -translate-x-1/2 rounded-full blur-md transition-all duration-300"
        style={{ backgroundColor: meta.glow, opacity: selected ? 0.95 : 0.55 }}
      />
      <CharacterSprite
        characterId={id}
        phase="idle"
        className={cn(
          "relative z-10 h-[97%] w-[138%] max-w-none transition-transform duration-300",
          selected ? "scale-[1.12]" : "scale-105 opacity-95 group-hover:scale-[1.09] group-hover:opacity-100",
        )}
      />
      <div
        className={cn(
          "relative z-10 w-full rounded-[14px] border px-1 py-2 text-center backdrop-blur-md transition",
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
        <div className="text-[11px] font-black uppercase leading-tight" style={{ color: meta.color }}>
          {meta.name}
        </div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">
          Victorias
        </div>
        <div className="text-[14px] font-black text-white">{meta.wins}</div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
          Cuota
        </div>
        <div className="text-[18px] font-black leading-none" style={{ color: meta.color }}>
          {meta.odds.toFixed(2)}x
        </div>
      </div>
    </button>
  );
}