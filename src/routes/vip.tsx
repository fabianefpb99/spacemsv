import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useVip } from "@/hooks/useVip";
import {
  computeProgress,
  formatXp,
  rankLabel,
  RANK_META,
  RANK_ORDER,
  RANK_RANGES,
  subForLevel,
  type VipLevelRow,
  type VipRank,
} from "@/lib/vip/vip.shared";
import { VipBadge } from "@/components/vip/VipBadge";
import { VipRewardChip } from "@/components/vip/VipRewardChip";
import {
  claimVipReward,
  listMyVipRewards,
  type VipRankRewardRow,
  type UserVipRewardRow,
} from "@/lib/vip/rewards.functions";
import { useAuth } from "@/hooks/useAuth";
import { playRewardSound } from "@/lib/reward-sound";
import type { MeData } from "@/hooks/useMe";

export const Route = createFileRoute("/vip")({
  head: () => ({
    meta: [
      { title: "Programa VIP — BETSPACE Casino" },
      {
        name: "description",
        content:
          "100 niveles de prestigio en BETSPACE Casino. Sube de Bronce a Leyenda apostando en tus juegos favoritos.",
      },
      { property: "og:title", content: "Programa VIP — BETSPACE Casino" },
      {
        property: "og:description",
        content:
          "Gana XP en cada apuesta y conquista los 100 niveles VIP. Bronce, Plata, Oro, Platino, Diamante, Maestro y Leyenda.",
      },
    ],
  }),
  component: VipPage,
});

function VipPage() {
  const navigate = useNavigate();
  const vip = useVip();
  const data = vip.data;
  const levels = data?.levels ?? [];
  const progress = computeProgress(data?.user_vip?.total_xp ?? 0, levels);
  const { user } = useAuth();
  const qc = useQueryClient();

  const catalogQ = useQuery({
    queryKey: ["vip-rewards-catalog"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_rank_rewards" as never)
        .select("*")
        .order("min_level", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as VipRankRewardRow[];
    },
  });

  const myRewardsFn = useServerFn(listMyVipRewards);
  const myRewardsQ = useQuery({
    queryKey: ["vip-my-rewards", user?.id ?? null],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: () => myRewardsFn(),
  });

  const claimFn = useServerFn(claimVipReward);
  const claim = useMutation({
    mutationFn: (rewardId: string) => {
      // Trigger sound immediately on user gesture (avoids autoplay block).
      playRewardSound();
      return claimFn({ data: { rewardId } });
    },
    onSuccess: (res) => {
      if (res.kind === "bonus") {
        toast.success(`+$${new Intl.NumberFormat("es-CO").format(res.amount ?? 0)} de saldo bonus`);
        // Optimistic bonus balance bump so /perfil + header reflejen al instante.
        if (user) {
          qc.setQueryData<MeData | null>(["me", user.id], (prev) => {
            if (!prev) return prev;
            const newBonus = typeof res.new_bonus_balance === "number"
              ? res.new_bonus_balance
              : prev.bonus_balance + Number(res.amount ?? 0);
            return { ...prev, bonus_balance: newBonus };
          });
        }
      } else if (res.kind === "avatar") {
        toast.success("¡Avatar desbloqueado!");
      } else {
        toast.success("Premio reclamado");
      }
      qc.invalidateQueries({ queryKey: ["vip-my-rewards"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["vip"] });
      qc.invalidateQueries({ queryKey: ["unlocked-avatars"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "No se pudo reclamar");
    },
  });

  const catalogByKey = new Map<string, VipRankRewardRow>();
  (catalogQ.data ?? []).forEach((r) =>
    catalogByKey.set(`${r.rank}:${r.sub_division}`, r),
  );
  const userByKey = new Map<string, UserVipRewardRow>();
  (myRewardsQ.data ?? []).forEach((r) =>
    userByKey.set(`${r.rank}:${r.sub_division}`, r),
  );

  return (
    <div className="vip-page theme-dark-fixed min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-12 pt-4 sm:max-w-lg sm:px-4">
        {/* Header */}
        <header
          className="-mx-3 -mt-4 flex items-center justify-between border-b border-purple-500/20 bg-[#060210] px-3 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <button
            onClick={() => navigate({ to: "/perfil" })}
            aria-label="Atrás"
            className="rounded-md p-2 text-purple-100 hover:bg-white/5"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={3} />
          </button>
          <h1 className="font-display flex items-center gap-1.5 text-base font-bold uppercase tracking-widest">
            <Sparkles className="h-4 w-4 text-fuchsia-300" /> Programa VIP
          </h1>
          <div className="h-7 w-11" />
        </header>

        {/* Header card: progreso del usuario */}
        <section
          className={cn(
            "mt-4 rounded-2xl border bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-4",
            RANK_META[progress.rank].border,
          )}
          style={{ boxShadow: `0 0 16px ${RANK_META[progress.rank].glow}` }}
        >
          <div className="flex items-center gap-4">
            <VipBadge rank={progress.rank} sub={progress.sub} size="lg" art />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
                Tu rango actual
              </div>
              <div
                className={cn(
                  "font-display truncate text-xl font-black uppercase tracking-wider",
                  RANK_META[progress.rank].text,
                )}
              >
                {rankLabel(progress.rank, progress.sub)}
              </div>
              <div className="mt-0.5 text-xs text-purple-200/80">
                Nivel {progress.displayLevel} {progress.isMax ? "· Máximo" : `/ 100`}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-purple-500/20">
              <div
                className={cn("h-full bg-gradient-to-r transition-all", RANK_META[progress.rank].gradient)}
                style={{ width: `${progress.pct.toFixed(1)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-purple-200/80">
              {progress.isMax ? (
                <>
                  <span className="font-bold text-amber-300">★ Nivel Máximo Alcanzado</span>
                  <span>{formatXp(progress.totalXp)} XP totales</span>
                </>
              ) : (
                <>
                  <span>
                    {formatXp(progress.xpIntoLevel)} / {formatXp(progress.xpForNextLevel)} XP
                  </span>
                  <span className="font-semibold text-fuchsia-300">
                    Próximo: Nivel {progress.displayLevel + 1}
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        <h2 className="font-display mt-6 mb-2 text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
          Rangos
        </h2>

        <div className="space-y-3">
          {RANK_ORDER.map((r) => (
            <RankSection
              key={r}
              rank={r}
              levels={levels}
              currentLevel={progress.displayLevel}
              userIsMax={progress.isMax}
              catalogByKey={catalogByKey}
              userByKey={userByKey}
              onClaim={(id) => claim.mutate(id)}
              claimingId={claim.isPending ? claim.variables ?? null : null}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-[10px] text-purple-200/60">
          Ganas XP por cada apuesta en cualquier juego.
          <br />
          Mientras más apuestas, más rápido subes.
        </p>

        <Link
          to="/perfil"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 py-3 text-xs font-bold uppercase tracking-widest text-purple-100 hover:bg-purple-500/20"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al perfil
        </Link>
      </div>
    </div>
  );
}

function RankSection({
  rank,
  levels,
  currentLevel,
  userIsMax,
  catalogByKey,
  userByKey,
  onClaim,
  claimingId,
}: {
  rank: VipRank;
  levels: VipLevelRow[];
  currentLevel: number;
  userIsMax: boolean;
  catalogByKey: Map<string, VipRankRewardRow>;
  userByKey: Map<string, UserVipRewardRow>;
  onClaim: (rewardId: string) => void;
  claimingId: string | null;
}) {
  const meta = RANK_META[rank];
  const range = RANK_RANGES[rank];
  const Icon = meta.icon;
  // Agrupar por subdivisión
  const subs = (["V", "IV", "III", "II", "I"] as const).map((s) => {
    const lvls = levels.filter(
      (l) => l.level >= range.from && l.level <= range.to && subForLevel(l.level) === s,
    );
    return { sub: s, levels: lvls };
  });

  const isUserHere = currentLevel >= range.from && currentLevel <= range.to;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-[#0c0620]/80",
        isUserHere ? meta.border : "border-purple-500/20",
      )}
      style={isUserHere ? { boxShadow: `0 0 10px ${meta.glow}` } : undefined}
    >
      <header
        className={cn(
          "flex items-center gap-3 bg-gradient-to-r px-3 py-2.5",
          meta.gradient,
          "bg-opacity-20",
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 ring-1 ring-white/20">
          <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-black uppercase tracking-widest text-white drop-shadow">
            {meta.label}
          </div>
          <div className="text-[10px] text-white/80">
            Niveles {range.from} – {range.to}
          </div>
        </div>
        {isUserHere && (
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            Estás aquí
          </span>
        )}
      </header>

      <div className="divide-y divide-purple-500/10">
        {subs.map(({ sub, levels: lvls }) => {
          if (lvls.length === 0) return null;
          const subFrom = lvls[0].level;
          const subTo = lvls[lvls.length - 1].level;
          const subTargetXp = lvls[lvls.length - 1].xp_required;
          const reached = currentLevel >= subFrom;
          const isCurrent = currentLevel >= subFrom && currentLevel <= subTo;
          const key = `${rank}:${sub}`;
          const catalog = catalogByKey.get(key) ?? null;
          const userReward = userByKey.get(key) ?? null;
          return (
            <div
              key={sub}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5",
                isCurrent && "bg-purple-500/10",
              )}
            >
              <VipBadge rank={rank} sub={sub} size="sm" art />
              <div className="min-w-0 flex-1">
                <div className={cn("text-xs font-bold", reached ? meta.text : "text-purple-200/60")}>
                  {meta.label} {sub}
                </div>
                <div className="text-[10px] text-purple-200/60">
                  Niveles {subFrom}–{subTo} · {formatXp(subTargetXp)} XP
                </div>
              </div>
              <VipRewardChip
                catalog={catalog}
                userReward={userReward}
                reached={reached}
                onClaim={onClaim}
                claiming={claimingId === userReward?.id}
              />
              {!reached && !userIsMax && (!catalog || catalog.reward_kind === "none") && (
                <Lock className="h-3.5 w-3.5 text-purple-300/50" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
