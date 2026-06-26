import { Check, Coins, Gift, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatars";
import type { VipRankRewardRow, UserVipRewardRow } from "@/lib/vip/rewards.functions";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

type Props = {
  catalog: VipRankRewardRow | null;
  userReward: UserVipRewardRow | null;
  reached: boolean;
  onClaim?: (rewardId: string) => void;
  claiming?: boolean;
};

/**
 * Reemplaza la estrella en la lista de sub-rangos por una representación
 * del premio configurado (saldo bonus / avatar) y su estado.
 */
export function VipRewardChip({ catalog, userReward, reached, onClaim, claiming }: Props) {
  if (!catalog || catalog.reward_kind === "none" || !catalog.is_active) {
    return null;
  }

  const isClaimed = !!userReward?.claimed_at;
  const isPending = reached && userReward && !isClaimed;
  const isLocked = !reached;

  // Visual content
  let body: React.ReactNode;
  if (catalog.reward_kind === "bonus") {
    body = (
      <span className="flex items-center gap-1">
        <Coins className="h-3 w-3" />
        <span className="font-display text-[11px] font-black">
          ${formatCOP(Number(catalog.reward_amount))}
        </span>
      </span>
    );
  } else {
    const url = catalog.reward_image_url || getAvatarUrl(catalog.reward_avatar_key);
    body = (
      <span className="flex items-center gap-1">
        <img src={url} alt="" className="h-5 w-5 rounded-full object-cover" />
        <span className="text-[10px] font-bold">Avatar</span>
      </span>
    );
  }

  if (isPending && onClaim && userReward) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClaim(userReward.id);
        }}
        disabled={claiming}
        className="flex items-center gap-1.5 rounded-full border border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-[0_0_12px_rgba(251,191,36,0.55)] transition hover:scale-105 disabled:opacity-60"
      >
        {claiming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gift className="h-3 w-3" />}
        {body}
        <span>Reclamar</span>
      </button>
    );
  }

  if (isClaimed) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
        <Check className="h-3 w-3" />
        {body}
      </span>
    );
  }

  // Locked or reached-without-pending-row
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
        isLocked
          ? "border-purple-500/30 bg-purple-500/5 text-purple-300/60"
          : "border-amber-400/40 bg-amber-500/10 text-amber-200",
      )}
    >
      {body}
    </span>
  );
}