import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVip } from "@/hooks/useVip";
import {
  computeProgress,
  formatXp,
  RANK_META,
  rankLabel,
} from "@/lib/vip/vip.shared";
import { VipBadge } from "./VipBadge";

export function VipCard() {
  const vip = useVip();
  const data = vip.data;
  const loading = vip.isLoading || !data;

  if (loading) {
    return (
      <div className="rounded-2xl border border-purple-500/40 bg-[#0c0620]/80 p-4">
        <div className="h-20 animate-pulse rounded-lg bg-purple-500/10" />
      </div>
    );
  }

  const progress = computeProgress(data.user_vip?.total_xp ?? 0, data.levels);
  const meta = RANK_META[progress.rank];

  return (
    <Link
      to="/vip"
      className={cn(
        "block rounded-2xl border bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-3 transition hover:brightness-110",
        meta.border,
      )}
      style={{ boxShadow: `0 0 14px ${meta.glow}` }}
    >
      <div className="flex items-center gap-3">
        <VipBadge rank={progress.rank} sub={progress.sub} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
              <Sparkles className="h-3 w-3" />
              VIP · Nivel {progress.displayLevel}
            </div>
            <ChevronRight className="h-4 w-4 text-purple-300/70" />
          </div>
          <div className={cn("font-display truncate text-lg font-black uppercase tracking-wider", meta.text)}>
            {rankLabel(progress.rank, progress.sub)}
          </div>

          {progress.isMax ? (
            <div className="mt-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-purple-500/20">
                <div
                  className={cn("h-full bg-gradient-to-r", meta.gradient)}
                  style={{ width: "100%" }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] font-semibold">
                <span className="text-amber-300">★ Nivel Máximo Alcanzado</span>
                <span className="text-purple-200/70">{formatXp(progress.totalXp)} XP</span>
              </div>
            </div>
          ) : (
            <div className="mt-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-purple-500/20">
                <div
                  className={cn("h-full bg-gradient-to-r transition-all", meta.gradient)}
                  style={{ width: `${progress.pct.toFixed(1)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-purple-200/80">
                <span>
                  {formatXp(progress.xpIntoLevel)} / {formatXp(progress.xpForNextLevel)} XP
                </span>
                <span className="font-semibold text-fuchsia-300">
                  Nivel {progress.displayLevel + 1} →
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
