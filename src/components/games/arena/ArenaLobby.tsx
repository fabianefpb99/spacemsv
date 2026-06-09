import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { ARENA_CHARACTERS, type ArenaCharacterId } from "@/lib/games/arena.shared";
import { ARENA_CHARACTER_META } from "./characters";
import { CharacterSprite } from "./CharacterSprite";
import arenaLobbyAudio from "@/assets/audio/arena/arena-lobby.mp3.asset.json";
import blazeSelectAudio from "@/assets/audio/arena/blaze-select.mp3.asset.json";
import novaSelectAudio from "@/assets/audio/arena/nova-select.mp3.asset.json";
import shadowSelectAudio from "@/assets/audio/arena/shadow-select.mp3.asset.json";
import titanSelectAudio from "@/assets/audio/arena/titan-select.mp3.asset.json";
import { playSound, preloadSound } from "@/lib/webAudioPlayer";

const LOBBY_HITBOXES: Record<ArenaCharacterId, string> = {
  nova: "left-[9%] w-[18%]",
  shadow: "left-[31%] w-[18%]",
  titan: "left-[51%] w-[18%]",
  blaze: "left-[69%] w-[18%]",
};

const LOBBY_PHRASES = [
  "¿Quién ganará hoy?",
  "¿Apostarás por el invicto?",
  "...la decisión es tuya.",
];

/**
 * Lobby (selection) — fills the parent stage with the platform backdrop and
 * places the 4 fighters on top of it. No card / no wrapper border: the
 * artwork *is* the game surface. Parent composes the HUD below.
 */
export function ArenaLobby({
  selected,
  onSelect,
  disabled,
  odds,
}: {
  selected: ArenaCharacterId | null;
  onSelect: (id: ArenaCharacterId) => void;
  disabled?: boolean;
  odds: Record<ArenaCharacterId, number>;
}) {
  useLobbyMusic();
  const selectSourcesRef = useRef<Record<ArenaCharacterId, string>>({
    nova: novaSelectAudio.url,
    shadow: shadowSelectAudio.url,
    titan: titanSelectAudio.url,
    blaze: blazeSelectAudio.url,
  });
  useEffect(() => {
    const sources = selectSourcesRef.current;
    (Object.keys(sources) as ArenaCharacterId[]).forEach((id) => {
      preloadSound(sources[id]);
    });
  }, []);
  const handleSelect = (id: ArenaCharacterId) => {
    if (disabled) return;
    const url = selectSourcesRef.current[id];
    if (url) playSound(url, { volume: 0.65 });
    onSelect(id);
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 right-0 top-1 flex items-center px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/90 sm:px-4">
        <div className="flex items-center gap-1.5 text-white/85">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
          152 ONLINE
        </div>
      </div>

      <div className="absolute inset-x-0 top-[9%] text-center">
        <h1 className="font-display text-[clamp(1.9rem,7.5vw,2.8rem)] font-black uppercase leading-[0.92] tracking-[0.06em] text-white [text-shadow:0_0_18px_rgba(255,255,255,0.35)]">
          <GlitchText text="Arena" />
          <br />
          <GlitchText text="de Campeones" className="text-fuchsia-300" />
        </h1>
        <RotatingPhrase />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[14%] bottom-0 grid grid-cols-4 gap-0 px-0">
        {ARENA_CHARACTERS.map((id) => (
          <FighterCard
            key={id}
            id={id}
            selected={selected === id}
            odds={odds[id]}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 top-[14%] bottom-0">
        {ARENA_CHARACTERS.map((id) => (
          <button
            key={`${id}-hitbox`}
            type="button"
            aria-label={`Seleccionar ${ARENA_CHARACTER_META[id].name}`}
            onClick={() => handleSelect(id)}
            disabled={disabled}
            className={cn(
              "absolute bottom-0 top-[2%] rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50",
              LOBBY_HITBOXES[id],
              selected === id && "z-20",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function RotatingPhrase() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 2400);
    const next = setTimeout(() => {
      setIndex((i) => (i + 1) % LOBBY_PHRASES.length);
      setVisible(true);
    }, 3000);
    return () => {
      clearTimeout(hide);
      clearTimeout(next);
    };
  }, [index]);

  return (
    <p
      className={cn(
        "mt-1.5 font-display text-[clamp(0.8rem,3.2vw,1rem)] italic tracking-wide text-white/85 [text-shadow:0_0_10px_rgba(244,114,182,0.5)] transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {LOBBY_PHRASES[index]}
    </p>
  );
}

const GLITCH_INTERVAL_MS = 4500;
const GLITCH_DURATION_MS = 600;

function GlitchText({ text, className }: { text: string; className?: string }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), GLITCH_DURATION_MS);
    }, GLITCH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      data-text={text}
      className={cn("relative inline-block", glitch && "arena-glitch", className)}
    >
      {text}
    </span>
  );
}

function useLobbyMusic() {
  useEffect(() => {
    const TARGET_VOLUME = 0.026;
    const FADE_IN_MS = 1500;
    const GAP_MS = 2000;

    let cancelled = false;
    let current: ReturnType<typeof playSound> | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    const startPlayback = () => {
      if (cancelled) return;
      current = playSound(arenaLobbyAudio.url, {
        volume: TARGET_VOLUME,
        fadeInMs: FADE_IN_MS,
        pauseOnHidden: true,
        onEnded: () => {
          if (cancelled) return;
          restartTimer = setTimeout(startPlayback, GAP_MS);
        },
      });
    };
    startPlayback();

    return () => {
      cancelled = true;
      if (restartTimer) clearTimeout(restartTimer);
      current?.stop(400);
    };
  }, []);
}

function FighterCard({
  id,
  selected,
  odds,
}: {
  id: ArenaCharacterId;
  selected: boolean;
  odds: number;
}) {
  const meta = ARENA_CHARACTER_META[id];
  return (
    <div
      className={cn(
        "group relative flex h-full w-full flex-col items-center justify-end transition disabled:opacity-50",
        selected && "z-10",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full blur-md transition-all duration-300",
          selected ? "bottom-[27%] h-7 w-[86%]" : "bottom-[26%] h-6 w-[78%]",
        )}
        style={{
          backgroundColor: meta.glow,
          opacity: selected ? 1 : 0.5,
          boxShadow: selected ? `0 0 38px 10px ${meta.glow}` : undefined,
        }}
      />
      <CharacterSprite
        characterId={id}
        phase="idle"
        className={cn(
          "pointer-events-none relative z-10 h-[112%] w-[210%] max-w-none -mb-7 transition-transform duration-300",
          selected ? "scale-[1.32]" : "scale-[1.22] opacity-95 group-hover:scale-[1.28] group-hover:opacity-100",
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
            {odds.toFixed(2)}x
          </span>
        </div>
        <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/55">
          {meta.wins} wins
        </div>
      </div>
    </div>
  );
}