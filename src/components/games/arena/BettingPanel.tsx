import { BetAmount } from "@/components/games/BetAmount";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ARENA_BET_STEP,
  ARENA_CHARACTERS,
  ARENA_MAX_BET,
  ARENA_MIN_BET,
} from "@/lib/games/arena.shared";
import type { ArenaCharacterId } from "@/lib/games/arena.shared";
import { ARENA_CHARACTER_META } from "./characters";

const QUICK_ADDS = [1000, 2000, 5000, 10000];
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
  onSelect,
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
    <div className="space-y-3 rounded-[24px] border border-white/10 bg-black/45 p-3 backdrop-blur-md">
      <section className="rounded-[18px] border border-white/10 bg-black/28 px-3 py-3">
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-100/80">
          Últimos ganadores
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 overflow-hidden">
          {RECENT_WINNERS.map((id, index) => {
            const winner = ARENA_CHARACTER_META[id];
            return (
              <div
                key={`${id}-${index}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border bg-black/45"
                style={{ borderColor: winner.color, boxShadow: `0 0 16px ${winner.glow}` }}
              >
                <img src={winner.sprites.idle} alt={winner.name} className="h-9 w-9 object-contain" />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-black/30 px-3 py-3">
        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-100/85">
          Apuesta (COP)
        </div>
        <div className="mt-3 grid grid-cols-[72px_minmax(0,1fr)_72px] gap-2 sm:grid-cols-[88px_minmax(0,1fr)_88px] sm:gap-3">
          <button
            type="button"
            onClick={() => onBetChange(clamp(bet - ARENA_BET_STEP))}
            disabled={isPlaying}
            className="h-14 rounded-[18px] border border-purple-400/20 bg-purple-500/12 text-4xl font-light text-purple-100 transition hover:bg-purple-500/18 disabled:opacity-50 sm:h-16"
          >
            −
          </button>
          <div className="flex h-14 items-center justify-center rounded-[18px] border border-white/10 bg-black/65 px-2 sm:h-16 sm:px-3">
            <BetAmount
              bet={bet}
              bonusBalance={bonusBalance}
              className="flex h-full min-h-0 flex-col justify-center"
              amountClassName="text-[2rem] font-black tracking-[0.03em] text-white sm:text-[2.35rem]"
              bonusClassName="mt-0.5 text-center text-[9px] font-bold leading-none text-yellow-300/95"
              minScale={0.65}
            >
              {formatCOP(bet)}
            </BetAmount>
          </div>
          <button
            type="button"
            onClick={() => onBetChange(clamp(bet + ARENA_BET_STEP))}
            disabled={isPlaying}
            className="h-14 rounded-[18px] border border-purple-400/20 bg-purple-500/12 text-4xl font-light text-purple-100 transition hover:bg-purple-500/18 disabled:opacity-50 sm:h-16"
          >
            +
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {QUICK_ADDS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => onBetChange(clamp(bet + amt))}
              disabled={isPlaying}
              className="h-12 rounded-[16px] border border-purple-400/18 bg-purple-500/10 px-1 text-[12px] font-bold text-purple-100 transition hover:bg-purple-500/16 disabled:opacity-50"
            >
              +{formatCOP(amt)}
            </button>
          ))}
        </div>

        <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
          Mínimo: {formatCOP(ARENA_MIN_BET)} COP · Paso: {formatCOP(ARENA_BET_STEP)}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {ARENA_CHARACTERS.map((id) => {
            const fighter = ARENA_CHARACTER_META[id];
            const active = id === selected;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect?.(id)}
                disabled={isPlaying}
                className={cn(
                  "rounded-[18px] border px-2 py-2 text-left transition disabled:opacity-50",
                  active ? "scale-[1.02]" : "hover:-translate-y-0.5",
                )}
                style={{
                  borderColor: active ? fighter.color : "rgba(255,255,255,0.12)",
                  background: active
                    ? `linear-gradient(180deg, ${fighter.panelTone} 0%, rgba(8,3,18,0.94) 100%)`
                    : "linear-gradient(180deg, rgba(12,5,24,0.9) 0%, rgba(5,2,12,0.92) 100%)",
                  boxShadow: active ? `0 0 26px ${fighter.glow}` : undefined,
                }}
              >
                <div className="mb-2 flex h-16 items-center justify-center overflow-hidden rounded-[14px] bg-black/35">
                  <img src={fighter.sprites.idle} alt={fighter.name} className="h-16 w-16 object-contain" />
                </div>
                <div className="text-[10px] font-black uppercase leading-tight text-white">{fighter.name}</div>
                <div className="mt-1 text-[9px] font-bold leading-none" style={{ color: fighter.color }}>
                  {fighter.odds.toFixed(2)}x
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Button
        size="default"
        onClick={onPlay}
        disabled={!selected || !canBet || isPlaying}
        className={cn(
          "h-14 w-full rounded-[18px] text-[1.05rem] font-black uppercase tracking-[0.08em]",
          "bg-[linear-gradient(180deg,rgba(34,197,94,0.95)_0%,rgba(22,163,74,0.95)_100%)]",
          "text-white shadow-[0_0_30px_rgba(34,197,94,0.34)] hover:brightness-110",
        )}
      >
        {isPlaying ? "PELEANDO…" : "Confirmar apuesta"}
      </Button>

      <div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
        <span>Pago si gana</span>
        <span className="text-yellow-300">{meta ? `$${formatCOP(Math.floor(bet * meta.odds))}` : "—"}</span>
      </div>
    </div>
  );
}