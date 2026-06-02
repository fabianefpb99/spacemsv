import type { ReactNode } from "react";
import { FitText } from "@/components/ui/fit-text";
import { cn } from "@/lib/utils";

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
}: {
  bet: number;
  bonusBalance: number;
  children?: ReactNode;
}) {
  const bonusUsed = Math.min(Math.max(bonusBalance, 0), Math.max(bet, 0));
  const usesBonus = bonusUsed > 0;

  if (!usesBonus) {
    return <FitText>{children ?? formatCOP(bet)}</FitText>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <FitText>{children ?? formatCOP(bet)}</FitText>
      </div>
      <div className="-mt-1.5 text-center text-[7px] font-bold leading-none text-yellow-300/95">
        +{formatCOP(bonusUsed)} BONUS
      </div>
    </div>
  );
}