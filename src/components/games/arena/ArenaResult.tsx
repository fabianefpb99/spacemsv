import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARENA_CHARACTER_META } from "./characters";
import type { ArenaRoundResult, ArenaCharacterId } from "@/lib/games/arena.shared";
import blazeSelectAudio from "@/assets/audio/arena/blaze-select.mp3.asset.json";
import novaSelectAudio from "@/assets/audio/arena/nova-select.mp3.asset.json";
import shadowSelectAudio from "@/assets/audio/arena/shadow-select.mp3.asset.json";
import titanSelectAudio from "@/assets/audio/arena/titan-select.mp3.asset.json";

const WINNER_VOICE: Record<ArenaCharacterId, string> = {
  nova: novaSelectAudio.url,
  shadow: shadowSelectAudio.url,
  titan: titanSelectAudio.url,
  blaze: blazeSelectAudio.url,
};

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

/**
 * Post-fight summary integrated into the arena scene (no modal overlay).
 * Big headline at top, winner name + payout/bet + CTA at the bottom,
 * letting the actual fighter sprite from <ArenaFight/> remain visible
 * in the middle of the stage.
 */
export function ArenaResult({
  result,
  onPlayAgain,
}: {
  result: ArenaRoundResult;
  onPlayAgain: () => void;
}) {
  const winnerMeta = ARENA_CHARACTER_META[result.winner];
  const betMeta = ARENA_CHARACTER_META[result.character_bet];
  const won = result.won;

  // Reproducir la voz del personaje ganador al aparecer victorioso.
  useEffect(() => {
    const src = WINNER_VOICE[result.winner];
    if (!src) return;
    const a = new Audio(src);
    a.volume = 0.7;
    const t = setTimeout(() => {
      try {
        a.currentTime = 0;
        void a.play();
      } catch {
        // ignore
      }
    }, 180);
    return () => {
      clearTimeout(t);
      try {
        a.pause();
        a.src = "";
      } catch {
        // ignore
      }
    };
  }, [result.winner]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
      {/* Top — verdict banner with colored backdrop */}
      <div
        className={cn(
          "w-full animate-fade-in",
          "border-y-2 py-2 text-center",
          won
            ? "border-emerald-300/80 bg-gradient-to-r from-emerald-600/0 via-emerald-600/85 to-emerald-600/0"
            : "border-rose-300/80 bg-gradient-to-r from-rose-700/0 via-rose-700/90 to-rose-700/0",
        )}
        style={{ animationDelay: "120ms" }}
      >
        <h2
          className="font-display text-[44px] font-black italic uppercase leading-none tracking-tight text-white"
          style={{
            textShadow:
              "0 2px 0 rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.45)",
          }}
        >
          {won ? "¡GANASTE!" : "¡PERDISTE!"}
        </h2>
      </div>

      {/* Bottom — winner + payout + CTA */}
      <div className="pointer-events-auto flex flex-col items-center gap-3 pb-1">
        <div
          className="flex items-baseline justify-center gap-2 animate-fade-in"
          style={{ animationDelay: "320ms" }}
        >
          <span
            className="font-display text-[34px] font-black italic uppercase leading-none tracking-tight"
            style={{
              color: winnerMeta.color,
              textShadow: `0 0 14px ${winnerMeta.color}, 0 2px 0 rgba(0,0,0,0.55)`,
            }}
          >
            {winnerMeta.name}
          </span>
          <span
            className="font-display text-[26px] font-black italic uppercase leading-none tracking-tight text-white"
            style={{ textShadow: "0 2px 0 rgba(0,0,0,0.55)" }}
          >
            GANÓ
          </span>
        </div>

        <div
          className="flex flex-col items-center gap-0.5 text-center animate-fade-in"
          style={{ animationDelay: "520ms" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
            Tu apuesta
          </div>
          <div className="text-[13px] font-extrabold uppercase text-white">
            ${formatCOP(result.bet_amount)}{" "}
            <span style={{ color: betMeta.color }}>{betMeta.name}</span>
          </div>
          {won ? (
            <div
              className="text-[18px] font-black tracking-tight text-emerald-300"
              style={{ textShadow: "0 0 12px rgba(52,211,153,0.6)" }}
            >
              +${formatCOP(result.payout)}
            </div>
          ) : (
            <div className="text-[14px] font-extrabold text-rose-300/90">
              -${formatCOP(result.bet_amount)}
            </div>
          )}
        </div>

        <Button
          size="lg"
          onClick={onPlayAgain}
          variant="outline"
          className={cn(
            "h-11 w-full max-w-[260px] rounded-full border-2 bg-black/45 text-[13px] font-extrabold uppercase tracking-[0.22em] text-white backdrop-blur-sm animate-fade-in arena-cta-glow",
            won
              ? "border-emerald-300/90 hover:bg-emerald-400/15 hover:text-white active:bg-emerald-400/25 active:text-white"
              : "border-rose-300/90 hover:bg-rose-400/15 hover:text-white active:bg-rose-400/25 active:text-white",
          )}
          style={
            {
              animationDelay: "740ms",
              ["--cta-glow" as never]: won ? "rgba(52,211,153,0.85)" : "rgba(244,114,182,0.85)",
            } as React.CSSProperties
          }
        >
          Apostar de nuevo
        </Button>
      </div>
    </div>
  );
}