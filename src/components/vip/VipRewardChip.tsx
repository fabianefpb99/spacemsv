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
 * Representación compacta del premio VIP y su estado de reclamo.
 * Diseño "badge de acción separado": la info del premio va a la izquierda
 * y el CTA de reclamar a la derecha, para que el ancho no explote con
 * montos grandes o recompensas tipo avatar.
 */
export function VipRewardChip({ catalog, userReward, reached, onClaim, claiming }: Props) {
  if (!catalog || catalog.reward_kind === "none" || !catalog.is_active) {
    return null;
  }

  const isClaimed = !!userReward?.claimed_at;
  const isPending = reached && userReward && !isClaimed;
  const isLocked = !reached;

  const isBonus = catalog.reward_kind === "bonus";
  const label = isBonus ? `$${formatCOP(Number(catalog.reward_amount))}` : "Avatar";
  const avatarUrl = isBonus
    ? null
    : catalog.reward_image_url || getAvatarUrl(catalog.reward_avatar_key);

  // Icono solo para avatares; para saldo el "$" ya es suficiente y ahorra espacio.
  const rewardIcon = isBonus ? null : (
    <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-purple-500/20 ring-1 ring-white/10">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Gift className="h-3 w-3 p-0.5 text-purple-200" />
      )}
    </div>
  );

  const rewardInfo = (
    <div className="flex items-center gap-1.5 min-w-0">
      {rewardIcon}
      <span className="truncate text-[11px] font-bold tracking-tight">
        {label}
      </span>
    </div>
  );

  if (isPending && onClaim && userReward) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClaim(userReward.id);
        }}
        disabled={claiming}
        className={cn(
          "group flex h-9 min-w-[145px] max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border px-1.5 py-1 transition",
          "border-purple-500/30 bg-[#0c0620]/90 shadow-lg backdrop-blur-sm",
          "hover:border-amber-400/50 hover:shadow-amber-500/10",
          "disabled:opacity-60"
        )}
      >
        <div className="min-w-0 flex-1 text-purple-100/90 group-hover:text-white">
          {rewardInfo}
        </div>
        <div className="h-5 w-px shrink-0 bg-purple-500/30 group-hover:bg-amber-400/40" />
        <span
          className={cn(
            "flex h-7 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-black uppercase tracking-tight text-black",
            "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(251,191,36,0.25)]",
            "hover:from-amber-400 hover:to-yellow-300 active:scale-95"
          )}
        >
          {claiming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Reclamar"
          )}
        </span>
      </button>
    );
  }

  if (isClaimed) {
    return (
      <span
        className={cn(
          "flex h-9 max-w-[165px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        )}
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="h-3 w-3" strokeWidth={3} />
        </div>
        <span className="truncate">{label}</span>
      </span>
    );
  }

  // Locked or reached-without-pending-row
  return (
    <span
      className={cn(
        "flex h-9 max-w-[165px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1",
        isLocked
          ? "border-purple-500/25 bg-purple-500/5 text-purple-300/55"
          : "border-amber-400/30 bg-amber-500/10 text-amber-200/80"
      )}
    >
      {rewardInfo}
    </span>
  );
}
