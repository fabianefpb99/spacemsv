import type { ReactNode } from "react";
import { FitText } from "@/components/ui/fit-text";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Renders the bet amount with the casino's "bonus-first" UX hint:
 *
 *  - When the bet will consume part (or all) of the user's promotional balance,
 *    the amount is painted yellow, and a tiny "+X BONUS" label appears just
 *    below it. The label states exactly how much of the bet is drawn from the
 *    bonus bucket (the rest comes from the real balance, transparently).
 *  - When no bonus would be consumed (bonus_balance = 0), the component
 *    behaves identically to a plain <FitText>{formatCOP(bet)}</FitText>,
 *    so existing layouts stay pixel-perfect.
 *
 * `children` lets game-specific markup wrap the amount (e.g. Blackjack's
 * leading neon-green "$"). When omitted, defaults to formatCOP(bet).
 */
export function BetAmount({
  bet,
  bonusBalance,
  children,
  className,
  amountClassName,
  bonusClassName,
  minScale,
}: {
  bet: number;
  bonusBalance: number;
  children?: ReactNode;
  className?: string;
  amountClassName?: string;
  bonusClassName?: string;
  minScale?: number;
}) {
  const bonusUsed = Math.min(Math.max(bonusBalance, 0), Math.max(bet, 0));
  const usesBonus = bonusUsed > 0;

  if (!usesBonus) {
    return <FitText className={amountClassName} min={minScale}>{children ?? formatCOP(bet)}</FitText>;
  }

  return (
    <div className={className ?? "flex h-full min-h-0 flex-col justify-center py-1"}>
      <div className="min-h-0 flex-1">
        <FitText className={amountClassName} min={minScale}>{children ?? formatCOP(bet)}</FitText>
      </div>
      <div className={bonusClassName ?? "mt-0.5 text-center text-[8px] font-bold leading-none text-yellow-300/95"}>
        +{formatCOP(bonusUsed)} BONUS
      </div>
    </div>
  );
}