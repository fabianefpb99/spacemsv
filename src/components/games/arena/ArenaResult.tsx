import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARENA_CHARACTER_META } from "./characters";
import type { ArenaRoundResult } from "@/lib/games/arena.shared";

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

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 animate-fade-in">
      {/* Top — verdict headline */}
      <div className="flex flex-col items-center pt-2">
        <div className="h-px w-40 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <h2
          className={cn(
            "mt-3 text-center font-extrabold uppercase italic leading-none tracking-tight",
            "text-[64px] sm:text-[72px]",
            won ? "text-white" : "text-white/85",
          )}
          style={{
            textShadow: won
              ? "0 0 18px rgba(255,255,255,0.55), 0 0 36px rgba(168,85,247,0.55), 0 4px 0 rgba(0,0,0,0.45)"
              : "0 0 18px rgba(255,255,255,0.25), 0 4px 0 rgba(0,0,0,0.55)",
          }}
        >
          {won ? "¡GANASTE!" : "PERDISTE"}
        </h2>
        <div className="mt-2 h-px w-40 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>

      {/* Bottom — winner + payout + CTA */}
      <div className="pointer-events-auto flex flex-col items-center gap-3 pb-2">
        <div className="text-center leading-[0.95]">
          <div
            className="font-extrabold italic uppercase tracking-tight text-[52px] sm:text-[60px]"
            style={{
              color: winnerMeta.color,
              textShadow: `0 0 18px ${winnerMeta.color}, 0 4px 0 rgba(0,0,0,0.5)`,
            }}
          >
            {winnerMeta.name}
          </div>
          <div
            className="font-extrabold italic uppercase tracking-tight text-white text-[44px] sm:text-[52px] -mt-1"
            style={{ textShadow: "0 0 14px rgba(255,255,255,0.45), 0 4px 0 rgba(0,0,0,0.55)" }}
          >
            GANÓ
          </div>
        </div>

        <div className="text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
            Tu apuesta
          </div>
          <div className="text-[15px] font-extrabold uppercase text-white/90">
            ${formatCOP(result.bet_amount)} {betMeta.name}
          </div>
          {won ? (
            <div
              className="mt-0.5 text-[20px] font-extrabold text-emerald-300"
              style={{ textShadow: "0 0 14px rgba(52,211,153,0.65)" }}
            >
              +${formatCOP(result.payout)}
            </div>
          ) : (
            <div className="mt-0.5 text-[15px] font-bold text-rose-300/90">
              -${formatCOP(result.bet_amount)}
            </div>
          )}
        </div>

        <Button
          size="lg"
          onClick={onPlayAgain}
          variant="outline"
          className="h-12 w-full max-w-[280px] rounded-full border-2 border-white/85 bg-black/35 text-base font-extrabold uppercase tracking-[0.2em] text-white backdrop-blur-sm hover:bg-white/10"
        >
          Apostar de nuevo
        </Button>
      </div>
    </div>
  );
}