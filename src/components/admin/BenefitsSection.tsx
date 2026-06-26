import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, RefreshCw, Search, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { adminListUsers } from "@/lib/admin/admin.functions";
import {
  adminGetUserVipSnapshot,
  adminResetUserVip,
} from "@/lib/vip/rewards.functions";
import { rankForLevel, subForLevel, RANK_META } from "@/lib/vip/vip.shared";
import { Panel, type UserRow, formatCOP, shortId } from "./shared";

export function BenefitsSection() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const listFn = useServerFn(adminListUsers);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["admin-benefits-users", debounced],
    queryFn: () =>
      listFn({ data: { search: debounced, status: "all", page: 1, pageSize: 20 } }),
  });

  return (
    <div className="space-y-4">
      <Panel
        title="Beneficios — Reset de premios VIP"
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
        <p className="mb-3 text-[11px] leading-relaxed text-purple-200/70">
          Resetea el progreso VIP completo de un usuario: pone XP y nivel en 0 y
          borra <strong>todos</strong> los premios desbloqueados (incluidos
          avatares VIP, reclamados o no). El <strong>saldo bonus</strong> ya
          acreditado <strong>no</strong> se devuelve.
        </p>

        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-300/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por correo, username o ID…"
            className="w-full rounded-md border border-purple-500/30 bg-[#150830] py-2 pl-7 pr-2 text-xs text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none"
          />
        </div>

        {q.isLoading ? (
          <div className="flex items-center justify-center py-8 text-purple-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <ul className="space-y-2">
            {(q.data?.rows as UserRow[] | undefined)?.map((u) => {
              const isSel = selected?.id === u.id;
              return (
                <li key={u.id}>
                  <button
                    onClick={() => setSelected(u)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                      isSel
                        ? "border-fuchsia-500/70 bg-[#1a0b3a]"
                        : "border-purple-500/20 bg-[#150830]/60 hover:border-fuchsia-500/40"
                    }`}
                  >
                    <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-fuchsia-400/40 bg-purple-900/40">
                      <UserAvatar avatarKey={u.avatar_key} avatarUrl={u.avatar_url} alt="" spinnerSize="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-white">{u.username ?? "—"}</span>
                        <span className="text-[10px] text-purple-300/70">#{shortId(u.id)}</span>
                      </div>
                      <div className="truncate text-[11px] text-purple-200/60">{u.email}</div>
                    </div>
                  </button>
                </li>
              );
            })}
            {q.data?.rows.length === 0 && (
              <li className="py-6 text-center text-xs text-purple-200/60">Sin resultados.</li>
            )}
          </ul>
        )}
      </Panel>

      {selected && <BenefitsUserPanel user={selected} onDone={() => q.refetch()} />}
    </div>
  );
}

function BenefitsUserPanel({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const qc = useQueryClient();
  const snapFn = useServerFn(adminGetUserVipSnapshot);
  const resetFn = useServerFn(adminResetUserVip);
  const [confirm, setConfirm] = useState(false);

  const snap = useQuery({
    queryKey: ["admin-vip-snapshot", user.id],
    queryFn: () => snapFn({ data: { userId: user.id } }),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: { userId: user.id } }),
    onSuccess: (res) => {
      toast.success(`Reset completo. Premios borrados: ${res.deleted_rewards}`);
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ["admin-vip-snapshot", user.id] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const data = snap.data;
  const level = data?.current_level ?? 0;
  const displayLevel = Math.max(1, level);
  const rank = rankForLevel(displayLevel);
  const sub = subForLevel(displayLevel);
  const claimed = (data?.rewards ?? []).filter((r) => r.claimed_at).length;
  const total = data?.rewards.length ?? 0;

  return (
    <Panel title={`Reset VIP — ${user.username ?? user.email ?? user.id}`}>
      {snap.isLoading ? (
        <div className="flex items-center justify-center py-8 text-purple-200/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="XP total" value={formatCOP(data?.total_xp ?? 0)} />
            <Stat label="Nivel" value={`${displayLevel}`} />
            <Stat label="Rango" value={`${RANK_META[rank].label} ${sub}`} />
            <Stat label="Premios" value={`${claimed} / ${total}`} />
          </div>

          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/60 bg-rose-500/10 py-3 text-sm font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Reset completo de VIP
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-rose-500/60 bg-rose-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <p className="text-xs text-rose-100">
                  Esto pondrá XP y nivel en <strong>0</strong> y borrará los{" "}
                  <strong>{total}</strong> premios VIP (incl. avatares
                  desbloqueados). El saldo bonus ya entregado <strong>no</strong>{" "}
                  se descuenta. ¿Confirmar?
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setConfirm(false)}
                  className="flex-1 rounded-md border border-purple-500/40 bg-[#150830] py-2 text-xs font-bold uppercase tracking-wider text-purple-100 hover:bg-white/5"
                  disabled={reset.isPending}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => reset.mutate()}
                  disabled={reset.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-rose-600 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {reset.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Gift className="h-3.5 w-3.5" />
                  )}
                  Confirmar reset
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-purple-500/20 bg-[#150830]/60 px-2 py-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-purple-200/70">{label}</div>
      <div className="font-display mt-0.5 text-xs font-bold text-white">{value}</div>
    </div>
  );
}