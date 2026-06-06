import { BetAmount } from "@/components/games/BetAmount";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ARENA_BET_STEP,
  ARENA_MAX_BET,
  ARENA_MIN_BET,
} from "@/lib/games/arena.shared";
import type { ArenaCharacterId } from "@/lib/games/arena.shared";
import { ARENA_CHARACTER_META } from "./characters";

const RECENT_WINNERS: ArenaCharacterId[] = ["titan", "nova", "blaze", "shadow", "titan", "shadow", "nova", "blaze"];

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
}

export function BettingPanel({
  bet,
  bonusBalance,
  balance,
  selected,
  onBetChange,
  onSelect: _onSelect,
  onPlay,
  isPlaying,
}: {
  bet: number;
  bonusBalance: number;
  balance: number;
  selected: ArenaCharacterId | null;
  onBetChange: (next: number) => void;
  onSelect?: (id: ArenaCharacterId) => void;
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
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/60 p-2.5 backdrop-blur-md">
      {/* Recent winners — single thin row */}
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">
          Últimos
        </span>
        <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
          {RECENT_WINNERS.slice(0, 8).map((id, i) => {
            const w = ARENA_CHARACTER_META[id];
            return (
              <div
                key={`${id}-${i}`}
                className="h-7 w-7 shrink-0 rounded-full border bg-black/50"
                style={{ borderColor: w.color, boxShadow: `0 0 6px ${w.glow}` }}
              >
                <img src={w.sprites.idle} alt={w.name} className="h-full w-full object-contain" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bet row: − [amount] + */}
      <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] gap-2">
        <button
          type="button"
          onClick={() => onBetChange(clamp(bet - ARENA_BET_STEP))}
          disabled={isPlaying}
          className="h-14 rounded-xl border border-purple-400/30 bg-purple-500/15 text-3xl font-light text-purple-100 transition hover:bg-purple-500/25 disabled:opacity-50"
        >
          −
        </button>
        <div className="flex h-14 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/65 px-2">
          <BetAmount
            bet={bet}
            bonusBalance={bonusBalance}
            className="flex min-h-0 flex-col justify-center"
            amountClassName="text-[1.7rem] font-black leading-none tracking-[0.02em] text-white"
            bonusClassName="text-[9px] font-bold leading-none text-yellow-300/95"
            minScale={0.7}
          >
            {formatCOP(bet)}
          </BetAmount>
        </div>
        <button
          type="button"
          onClick={() => onBetChange(clamp(bet + ARENA_BET_STEP))}
          disabled={isPlaying}
          className="h-14 rounded-xl border border-purple-400/30 bg-purple-500/15 text-3xl font-light text-purple-100 transition hover:bg-purple-500/25 disabled:opacity-50"
        >
          +
        </button>
      </div>

      {/* CTA + pago en una sola línea */}
      <div className="flex items-center gap-2">
        <Button
          size="default"
          onClick={onPlay}
          disabled={!selected || !canBet || isPlaying}
          className={cn(
            "h-14 flex-1 rounded-xl text-[15px] font-black uppercase tracking-[0.1em]",
            "bg-[linear-gradient(180deg,rgba(34,197,94,0.95)_0%,rgba(22,163,74,0.95)_100%)]",
            "text-white shadow-[0_0_22px_rgba(34,197,94,0.4)] hover:brightness-110",
          )}
        >
          {isPlaying ? "PELEANDO…" : selected ? `APOSTAR ${meta?.name}` : "ELIGE UN LUCHADOR"}
        </Button>
        <div className="flex h-14 min-w-[100px] flex-col items-center justify-center rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-yellow-200/80">Pago</span>
          <span className="text-[15px] font-black leading-none text-yellow-300">
            {meta ? `$${formatCOP(Math.floor(bet * meta.odds))}` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}