import { BetAmount } from "@/components/games/BetAmount";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARENA_BET_STEP, ARENA_MAX_BET, ARENA_MIN_BET } from "@/lib/games/arena.shared";
import type { ArenaCharacterId } from "@/lib/games/arena.shared";
import { ARENA_CHARACTER_META } from "./characters";

const QUICK_ADDS = [1000, 5000, 10000, 50000];

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Bottom panel for the lobby:
 *  - shows current bet (with bonus-first hint via <BetAmount/>)
 *  - quick-add chips
 *  - "PELEAR" CTA (disabled until a character is selected)
 *
 * Stateless on purpose: parent owns bet + selected character.
 */
export function BettingPanel({
  bet,
  bonusBalance,
  balance,
  selected,
  onBetChange,
  onPlay,
  isPlaying,
}: {
  bet: number;
  bonusBalance: number;
  balance: number;
  selected: ArenaCharacterId | null;
  onBetChange: (next: number) => void;
  onPlay: () => void;
  isPlaying: boolean;
}) {
  const canBet = bet >= ARENA_MIN_BET && bet <= Math.min(ARENA_MAX_BET, balance);
  const meta = selected ? ARENA_CHARACTER_META[selected] : null;

  function clamp(next: number) {
    if (!Number.isFinite(next)) return ARENA_MIN_BET;
    const step = Math.round(next / ARENA_BET_STEP) * ARENA_BET_STEP;
    return Math.max(ARENA_MIN_BET, Math.min(ARENA_MAX_BET, step));
  }

  return (
    <div className="space-y-2 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 p-2 backdrop-blur-md">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Apuesta</div>
          <div className="h-8 w-40">
            <BetAmount
              bet={bet}
              bonusBalance={bonusBalance}
              amountClassName="text-xl font-bold text-white"
            />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Pago si gana</div>
          <div className="text-base font-bold text-yellow-300">
            {meta ? `$${formatCOP(Math.floor(bet * meta.odds))}` : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
          onClick={() => onBetChange(clamp(bet / 2))}
          disabled={isPlaying}
        >
          ½
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
          onClick={() => onBetChange(clamp(bet * 2))}
          disabled={isPlaying}
        >
          2×
        </Button>
        {QUICK_ADDS.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => onBetChange(clamp(bet + amt))}
            disabled={isPlaying}
            className="h-8 rounded-md border border-white/15 bg-white/5 text-[11px] font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-50"
          >
            +{formatCOP(amt)}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-yellow-400/40 bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/20"
          onClick={() => onBetChange(clamp(balance))}
          disabled={isPlaying}
        >
          MAX
        </Button>
      </div>

      <Button
        size="default"
        onClick={onPlay}
        disabled={!selected || !canBet || isPlaying}
        className={cn(
          "h-11 w-full text-base font-extrabold tracking-wide",
          "bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500",
          "shadow-[0_0_24px_rgba(168,85,247,0.55)] hover:brightness-110",
        )}
      >
        {isPlaying
          ? "PELEANDO…"
          : selected
            ? `PELEAR · ${meta!.name}`
            : "ELIGE UN PELEADOR"}
      </Button>
    </div>
  );
}