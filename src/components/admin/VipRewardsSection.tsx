import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Save, Gift } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "./shared";
import {
  adminListVipRewards,
  adminUpsertVipReward,
  type VipRankRewardRow,
  type VipRewardKind,
} from "@/lib/vip/rewards.functions";
import { AVATAR_OPTIONS, getAvatarUrl } from "@/lib/avatars";
import { RANK_META, RANK_ORDER, type VipRank, type VipSub } from "@/lib/vip/vip.shared";
import { VipBadge } from "@/components/vip/VipBadge";
import { cn } from "@/lib/utils";

const SUBS: VipSub[] = ["V", "IV", "III", "II", "I"];

export function VipRewardsSection() {
  const fn = useServerFn(adminListVipRewards);
  const q = useQuery({
    queryKey: ["admin-vip-rewards"],
    queryFn: () => fn(),
  });

  return (
    <div className="space-y-4">
      <Panel
        title="Premios VIP por sub-rango"
        actions={
          <button
            onClick={() => q.refetch()}
            className="flex items-center gap-1 rounded-md border border-purple-500/30 px-2 py-1 text-[10px] uppercase tracking-widest text-purple-200 hover:bg-white/5"
          >
            <RefreshCw className="h-3 w-3" />
            Actualizar
          </button>
        }
      >
        <p className="mb-3 text-[11px] text-purple-200/70">
          Configura un premio por cada transición de sub-rango (Bronce V → Bronce IV, …). Los
          jugadores lo reclaman manualmente desde su perfil VIP cuando alcanzan el sub-rango. El
          sub-rango inicial <span className="font-bold">Bronce V</span> no otorga premio.
        </p>
        {q.isLoading ? (
          <div className="flex items-center justify-center py-10 text-purple-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : q.isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            No se pudo cargar el catálogo.{" "}
            {q.error instanceof Error ? q.error.message : ""}
          </div>
        ) : (
          <div className="space-y-4">
            {RANK_ORDER.map((r) => (
              <RankGroup key={r} rank={r} rows={(q.data ?? []).filter((x) => x.rank === r)} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RankGroup({ rank, rows }: { rank: VipRank; rows: VipRankRewardRow[] }) {
  const meta = RANK_META[rank];
  const byMap = new Map(rows.map((r) => [r.sub_division as VipSub, r]));
  return (
    <section className="rounded-xl border border-purple-500/20 bg-[#0c0620]/60">
      <header
        className={cn(
          "flex items-center gap-2 rounded-t-xl border-b border-purple-500/20 bg-gradient-to-r px-3 py-2",
          meta.gradient,
        )}
      >
        <span className="font-display text-xs font-black uppercase tracking-widest text-white drop-shadow">
          {meta.label}
        </span>
      </header>
      <div className="divide-y divide-purple-500/10">
        {SUBS.map((sub) => {
          const row = byMap.get(sub);
          if (!row) return null;
          return <RewardRow key={`${rank}-${sub}`} row={row} />;
        })}
      </div>
    </section>
  );
}

function RewardRow({ row }: { row: VipRankRewardRow }) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(adminUpsertVipReward);
  const isInitialSub = row.min_level === 1; // Bronce V

  const [kind, setKind] = useState<VipRewardKind>(row.reward_kind);
  const [amount, setAmount] = useState<string>(String(row.reward_amount ?? 0));
  const [avatarKey, setAvatarKey] = useState<string>(row.reward_avatar_key ?? "");
  const [label, setLabel] = useState<string>(row.reward_label ?? "");
  const [isActive, setIsActive] = useState<boolean>(row.is_active);

  useEffect(() => {
    setKind(row.reward_kind);
    setAmount(String(row.reward_amount ?? 0));
    setAvatarKey(row.reward_avatar_key ?? "");
    setLabel(row.reward_label ?? "");
    setIsActive(row.is_active);
  }, [row]);

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          rank: row.rank,
          sub_division: row.sub_division,
          reward_kind: kind,
          reward_amount: Number(amount) || 0,
          reward_avatar_key: kind === "avatar" ? avatarKey || null : null,
          reward_label: label || null,
          reward_image_url:
            kind === "avatar" && avatarKey ? getAvatarUrl(avatarKey) : null,
          is_active: isActive,
        },
      }),
    onSuccess: () => {
      toast.success(`Guardado: ${row.rank.toUpperCase()} ${row.sub_division}`);
      qc.invalidateQueries({ queryKey: ["admin-vip-rewards"] });
      qc.invalidateQueries({ queryKey: ["vip-rewards-catalog"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const meta = RANK_META[row.rank as VipRank];

  return (
    <div className={cn("flex flex-col gap-2 p-3 sm:flex-row sm:items-center", isInitialSub && "opacity-60")}>
      <div className="flex w-32 shrink-0 items-center gap-2">
        <VipBadge rank={row.rank as VipRank} sub={row.sub_division as VipSub} size="sm" art />
        <div>
          <div className={cn("text-xs font-bold", meta.text)}>
            {meta.label} {row.sub_division}
          </div>
          <div className="text-[10px] text-purple-200/60">Nivel {row.min_level}+</div>
        </div>
      </div>

      {isInitialSub ? (
        <div className="flex-1 text-[11px] italic text-purple-200/60">
          Sub-rango inicial — no otorga premio.
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as VipRewardKind)}
              className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-1.5 text-xs text-white"
            >
              <option value="none">Ninguno</option>
              <option value="bonus">Saldo Bonus</option>
              <option value="avatar">Avatar</option>
            </select>

            {kind === "bonus" && (
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Monto COP"
                className="w-28 rounded-md border border-purple-500/30 bg-[#150830] px-2 py-1.5 text-xs text-white"
              />
            )}

            {kind === "avatar" && (
              <select
                value={avatarKey}
                onChange={(e) => setAvatarKey(e.target.value)}
                className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-1.5 text-xs text-white"
              >
                <option value="">— Elige avatar —</option>
                {AVATAR_OPTIONS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            )}

            {kind === "avatar" && avatarKey && (
              <img
                src={getAvatarUrl(avatarKey)}
                alt=""
                className="h-8 w-8 rounded-full border border-fuchsia-400/40 object-cover"
              />
            )}

            {kind !== "none" && (
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Etiqueta (opcional)"
                className="w-40 rounded-md border border-purple-500/30 bg-[#150830] px-2 py-1.5 text-xs text-white"
              />
            )}

            <label className="flex items-center gap-1 text-[10px] text-purple-200/80">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Activo
            </label>
          </div>

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center justify-center gap-1 rounded-md bg-fuchsia-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:opacity-50"
          >
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar
          </button>
        </>
      )}
    </div>
  );
}

export { Gift };