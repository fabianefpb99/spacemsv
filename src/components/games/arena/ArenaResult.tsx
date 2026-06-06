import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARENA_CHARACTER_META } from "./characters";
import { CharacterSprite } from "./CharacterSprite";
import type { ArenaRoundResult } from "@/lib/games/arena.shared";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

/**
 * Post-fight summary overlay. Shows winner, payout, fair-play seeds,
 * and lets the user start a new round.
 */
export function ArenaResult({
  result,
  onPlayAgain,
}: {
  result: ArenaRoundResult;
  onPlayAgain: () => void;
}) {
  const winnerMeta = ARENA_CHARACTER_META[result.winner];
  const won = result.won;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div
        className={cn(
          "text-center text-4xl font-extrabold uppercase tracking-widest",
          won ? "text-yellow-300" : "text-white/70",
        )}
        style={won ? { textShadow: "0 0 20px rgba(250,204,21,0.7)" } : undefined}
      >
        {won ? "¡Ganaste!" : "Perdiste"}
      </div>

      <div className="w-40">
        <CharacterSprite characterId={result.winner} phase="idle" className="w-full" />
      </div>

      <div className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-white/50">Ganador</div>
        <div
          className="text-xl font-extrabold"
          style={{ color: winnerMeta.color, textShadow: `0 0 12px ${winnerMeta.color}` }}
        >
          {winnerMeta.name}
        </div>
      </div>

      {won ? (
        <div className="rounded-xl border border-yellow-400/60 bg-yellow-400/10 px-6 py-3 text-center shadow-[0_0_24px_rgba(250,204,21,0.4)]">
          <div className="text-[10px] uppercase tracking-wider text-yellow-200/80">Pago</div>
          <div className="text-2xl font-extrabold text-yellow-300">
            +${formatCOP(result.payout)}
          </div>
          <div className="text-[10px] text-yellow-200/70">
            {result.multiplier.toFixed(2)}× × ${formatCOP(result.bet_amount)}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/15 bg-black/40 px-6 py-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-white/50">Tu apuesta</div>
          <div className="text-lg font-bold text-white/80">
            ${formatCOP(result.bet_amount)} a {ARENA_CHARACTER_META[result.character_bet].name}
          </div>
        </div>
      )}

      <Button
        size="lg"
        onClick={onPlayAgain}
        className="w-full max-w-xs bg-gradient-to-r from-purple-500 to-fuchsia-500 text-lg font-extrabold tracking-wide shadow-[0_0_24px_rgba(168,85,247,0.55)]"
      >
        OTRA PELEA
      </Button>
    </div>
  );
}