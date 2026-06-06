import { BetAmount } from "@/components/games/BetAmount";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import {
  ARENA_BET_STEP,
  ARENA_MAX_BET,
  ARENA_MIN_BET,
} from "@/lib/games/arena.shared";
import type { ArenaCharacterId } from "@/lib/games/arena.shared";
import { ARENA_CHARACTER_META } from "./characters";

const QUICK_BETS = [1000, 2000, 5000, 10000];

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
}

export function BettingPanel({
  bet,
  bonusBalance,
  balance,
  selected,
  recentWinners,
  odds,
  onBetChange,
  onSelect: _onSelect,
  onPlay,
  isPlaying,
}: {
  bet: number;
  bonusBalance: number;
  balance: number;
  selected: ArenaCharacterId | null;
  recentWinners: ArenaCharacterId[];
  odds: Record<ArenaCharacterId, number>;
  onBetChange: (next: number) => void;
  onSelect?: (id: ArenaCharacterId) => void;
  onPlay: () => void;
  isPlaying: boolean;
}) {
  const canBet = bet >= ARENA_MIN_BET && bet <= Math.min(ARENA_MAX_BET, balance);
  const meta = selected ? ARENA_CHARACTER_META[selected] : null;
  const selectedOdds = selected ? odds[selected] : null;

  function clamp(next: number) {
    if (!Number.isFinite(next)) return ARENA_MIN_BET;
    const step = Math.round(next / ARENA_BET_STEP) * ARENA_BET_STEP;
    return Math.max(ARENA_MIN_BET, Math.min(ARENA_MAX_BET, step));
  }

  return (
    <section className="rounded-2xl glass-panel p-2.5">
      {/* Recent winners — thin strip aligned with other game HUDs */}
      <div className="mb-2 flex items-center gap-2 overflow-hidden">
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-purple-200/70">
          Últimos
        </span>
        <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
          {recentWinners.slice(0, 8).map((id, i) => {
            const w = ARENA_CHARACTER_META[id];
            return (
              <div
                key={`${id}-${i}`}
                className="h-6 w-6 shrink-0 rounded-full border bg-black/50"
                style={{ borderColor: w.color, boxShadow: `0 0 6px ${w.glow}` }}
              >
                <img src={w.sprites.idle} alt={w.name} className="h-full w-full object-contain" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center text-[10px] uppercase tracking-widest text-purple-200/70">
        APUESTA (COP)
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onBetChange(clamp(bet - ARENA_BET_STEP))}
          disabled={isPlaying}
          className="flex h-11 w-11 items-center justify-center rounded-xl btn-bet disabled:opacity-40"
        >
          <Minus className="h-5 w-5" />
        </button>
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-purple-500/40 bg-[#0c0620] px-2 font-display text-base font-bold tabular-nums text-white">
          <BetAmount
            bet={bet}
            bonusBalance={bonusBalance}
            className="flex h-full min-h-0 w-full flex-col justify-center py-0.5"
            amountClassName="w-full pt-0.5 text-center tabular-nums"
            bonusClassName="mt-px text-center text-[7px] font-bold leading-none text-yellow-300/95"
            minScale={0.5}
          >
            {formatCOP(bet)}
          </BetAmount>
        </div>
        <button
          type="button"
          onClick={() => onBetChange(clamp(bet + ARENA_BET_STEP))}
          disabled={isPlaying}
          className="flex h-11 w-11 items-center justify-center rounded-xl btn-bet disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Quick bet shortcuts */}
      <div className="mt-1.5 grid grid-cols-4 gap-1">
        {QUICK_BETS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onBetChange(clamp(bet + q))}
            disabled={isPlaying}
            className="rounded-md btn-bet py-1 text-[11px] font-bold disabled:opacity-40"
          >
            +{q >= 1000 ? `${q / 1000}K` : q}
          </button>
        ))}
      </div>

      <div className="mt-1.5 text-center text-[10px] text-purple-200/60">
        MÍNIMO: {formatCOP(ARENA_MIN_BET)} COP · PASO: {formatCOP(ARENA_BET_STEP)}
      </div>

      {/* CTA + pago */}
      <div className="mt-2 flex items-center gap-2">
        <Button
          size="default"
          onClick={onPlay}
          disabled={!selected || !canBet || isPlaying}
          className={cn(
            "h-12 flex-1 rounded-xl text-[14px] font-black uppercase tracking-[0.1em]",
            "bg-[linear-gradient(180deg,rgba(34,197,94,0.95)_0%,rgba(22,163,74,0.95)_100%)]",
            "text-white shadow-[0_0_22px_rgba(34,197,94,0.4)] hover:brightness-110",
          )}
        >
          {isPlaying ? "PELEANDO…" : selected ? `APOSTAR ${meta?.name}` : "ELIGE UN LUCHADOR"}
        </Button>
        <div className="flex h-12 min-w-[96px] flex-col items-center justify-center rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-yellow-200/80">Pago</span>
          <span className="text-[14px] font-black leading-none text-yellow-300">
            {meta && selectedOdds != null
              ? `$${formatCOP(Math.floor(bet * selectedOdds))}`
              : "—"}
          </span>
        </div>
      </div>
    </section>
  );
}