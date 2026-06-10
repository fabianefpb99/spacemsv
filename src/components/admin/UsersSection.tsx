import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Gift,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ChevronDown,
  UserCircle2,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import astronaut from "@/assets/astronaut.svg";
import { useHistoryBackClose } from "@/hooks/useHistoryBackClose";
import {
  adminAdjustBalance,
  adminAdjustXp,
  adminGetUserDetail,
  adminGetUserTransactions,
  adminListUsers,
  adminResetPassword,
  adminSetBlock,
} from "@/lib/admin/admin.functions";
import {
  KpiCard,
  Panel,
  StatChip,
  type UserRow,
  formatCOP,
  shortId,
} from "./shared";

export function UsersSection() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked" | "verified" | "unverified">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const fn = useServerFn(adminListUsers);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["admin-users", debounced, status, page],
    queryFn: () => fn({ data: { search: debounced, status, page, pageSize: 20 } }),
  });

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <Panel
        title="Usuarios registrados"
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
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-300/60" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por correo, username o ID…"
              className="w-full rounded-md border border-purple-500/30 bg-[#150830] py-2 pl-7 pr-2 text-xs text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="blocked">Bloqueados</option>
            <option value="verified">Verificados</option>
            <option value="unverified">Sin verificar</option>
          </select>
        </div>

        {q.isLoading ? (
          <div className="flex items-center justify-center py-12 text-purple-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : q.isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            No se pudieron cargar los usuarios. {q.error instanceof Error ? q.error.message : ""}
          </div>
        ) : q.data && q.data.rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-purple-200/60">Sin resultados.</div>
        ) : (
          <ul className="space-y-2">
            {(q.data?.rows as UserRow[] | undefined)?.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => setSelected(u.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-purple-500/20 bg-[#150830]/60 p-2.5 text-left transition hover:border-fuchsia-500/50 hover:bg-[#1a0b3a]/80"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-fuchsia-400/40 bg-purple-900/40">
                    <img src={astronaut} alt="" className="h-7 w-7 object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-white">
                        {u.username ?? "—"}
                      </span>
                      <span className="text-[10px] text-purple-300/70">#{shortId(u.id)}</span>
                    </div>
                    <div className="truncate text-[11px] text-purple-200/60">{u.email}</div>
                  </div>
                  <div className="hidden text-right text-[10px] sm:block">
                    <div className="text-purple-300/70 uppercase tracking-wider">Saldo</div>
                    <div className="font-display text-xs font-bold text-white">
                      <span className="neon-green mr-0.5">$</span>
                      {formatCOP(Number(u.balance ?? 0))}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      u.is_blocked
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {u.is_blocked ? "Bloqueado" : "Activo"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between text-[10px] text-purple-200/70">
          <span>
            Página {page} de {totalPages} · {q.data?.total ?? 0} usuarios
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-purple-500/30 px-2 py-1 text-xs disabled:opacity-40"
            >
              ←
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-purple-500/30 px-2 py-1 text-xs disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </Panel>

      {selected && <UserDetailDrawer userId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  useHistoryBackClose(true, onClose);
  const detailFn = useServerFn(adminGetUserDetail);
  const txFn = useServerFn(adminGetUserTransactions);
  const adjustFn = useServerFn(adminAdjustBalance);
  const adjustXpFn = useServerFn(adminAdjustXp);
  const blockFn = useServerFn(adminSetBlock);
  const resetFn = useServerFn(adminResetPassword);
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => detailFn({ data: { userId } }),
  });
  const txs = useQuery({
    queryKey: ["admin-user-tx", userId],
    queryFn: () => txFn({ data: { userId, limit: 30 } }),
  });

  const adjust = useMutation({
    mutationFn: (vars: { amount: number; target: "real" | "bonus"; reason?: string }) =>
      adjustFn({ data: { userId, ...vars } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-user-tx", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const adjustXp = useMutation({
    mutationFn: (vars: { delta: number; reason?: string }) =>
      adjustXpFn({ data: { userId, ...vars } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const blockMut = useMutation({
    mutationFn: (blocked: boolean) => blockFn({ data: { userId, blocked } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const resetMut = useMutation({
    mutationFn: () => resetFn({ data: { userId } }),
  });

  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState<"real" | "bonus">("real");
  const [reason, setReason] = useState("");
  const [xpAmount, setXpAmount] = useState("");
  const [xpReason, setXpReason] = useState("");

  const submitAdjust = (sign: 1 | -1) => {
    const n = Math.floor(Number(amount));
    if (!n || isNaN(n)) return;
    adjust.mutate({ amount: sign * Math.abs(n), target, reason: reason || undefined });
    setAmount("");
    setReason("");
  };

  const submitXp = (sign: 1 | -1) => {
    const n = Math.floor(Number(xpAmount));
    if (!n || isNaN(n)) return;
    adjustXp.mutate({ delta: sign * Math.abs(n), reason: xpReason || undefined });
    setXpAmount("");
    setXpReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full flex-col overflow-y-auto border-l border-fuchsia-500/40 bg-gradient-to-b from-[#0c0620] to-[#060210] shadow-[0_0_30px_rgba(217,70,239,0.3)] sm:my-6 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:border">
        <div
          className="sticky top-0 z-10 flex items-center gap-2 border-b border-purple-500/30 bg-[#060210]/90 px-3 py-3 backdrop-blur"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-purple-200 hover:bg-white/5"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h3 className="flex-1 font-display text-sm font-bold uppercase tracking-widest text-white">
            Detalle del usuario
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-purple-200 hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {detail.isLoading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-purple-300" />
          </div>
        ) : detail.isError ? (
          <div className="p-4">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              No se pudo cargar este usuario. {detail.error instanceof Error ? detail.error.message : ""}
            </div>
          </div>
        ) : !detail.data ? (
          <div className="p-4">
            <div className="rounded-xl border border-purple-500/20 bg-[#150830]/50 p-3 text-xs text-purple-200/70">
              Usuario no encontrado.
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {/* Identity */}
            <div className="flex items-center gap-3 rounded-2xl border border-fuchsia-500/40 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-fuchsia-400/60 bg-purple-900/40">
                <img src={astronaut} alt="" className="h-10 w-10 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-base font-black text-white">
                  {detail.data.profile?.username ?? "—"}
                </div>
                <div className="truncate text-[11px] text-purple-200/70">{detail.data.email}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      detail.data.profile?.is_blocked
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {detail.data.profile?.is_blocked ? "Bloqueado" : "Activo"}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      detail.data.profile?.verification_status === "verified"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {detail.data.profile?.verification_status === "verified"
                      ? "Verificado"
                      : "Sin verificar"}
                  </span>
                  <span className="text-[10px] text-purple-300/60">
                    #{shortId(detail.data.profile?.id)}
                  </span>
                </div>
              </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Balance Principal"
                value={`$${formatCOP(detail.data.balance)}`}
                icon={WalletIcon}
                accent="purple"
              />
              <KpiCard
                label="Balance Bonus"
                value={`$${formatCOP(detail.data.bonus_balance)}`}
                icon={Gift}
                accent="amber"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatChip
                label="Total apostado"
                value={`$${formatCOP(detail.data.stats.totalBet)}`}
              />
              <StatChip
                label="Total ganado"
                value={`$${formatCOP(detail.data.stats.totalWin)}`}
                color="emerald"
              />
              <StatChip
                label="Total depositado"
                value={`$${formatCOP(detail.data.stats.totalDeposit)}`}
              />
              <StatChip
                label="Total retirado"
                value={`$${formatCOP(detail.data.stats.totalWithdraw)}`}
              />
              <StatChip
                label="Ganancia neta"
                value={`$${formatCOP(detail.data.stats.net)}`}
                color={detail.data.stats.net >= 0 ? "emerald" : "rose"}
              />
              <StatChip
                label="Juego favorito"
                value={(detail.data.stats.favorite ?? "—").toUpperCase()}
              />
            </div>

            <div className="text-[10px] text-purple-200/60">
              Último acceso:{" "}
              {detail.data.lastSignInAt
                ? new Date(detail.data.lastSignInAt).toLocaleString("es-CO")
                : "—"}
            </div>

            {/* Balance actions */}
            <Panel title="Ajustar saldo">
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as "real" | "bonus")}
                  className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white"
                >
                  <option value="real">Saldo real</option>
                  <option value="bonus">Saldo bonus</option>
                </select>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Monto en COP"
                  className="flex-1 rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white placeholder:text-purple-300/40"
                />
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="mt-2 w-full rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white placeholder:text-purple-300/40"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => submitAdjust(1)}
                  disabled={adjust.isPending || !amount}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
                <button
                  onClick={() => submitAdjust(-1)}
                  disabled={adjust.isPending || !amount}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  <Minus className="h-3.5 w-3.5" />
                  Descontar
                </button>
              </div>
              {adjust.isError && (
                <div className="mt-2 text-[11px] text-rose-300">
                  Error: {(adjust.error as Error).message}
                </div>
              )}
            </Panel>

            {/* XP / VIP actions */}
            <Panel title="Ajustar XP (VIP)">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-purple-200/80">
                <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
                <span>Nivel actual recalculado automáticamente.</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  inputMode="numeric"
                  value={xpAmount}
                  onChange={(e) => setXpAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Cantidad de XP"
                  className="flex-1 rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white placeholder:text-purple-300/40"
                />
                <input
                  value={xpReason}
                  onChange={(e) => setXpReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="flex-1 rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white placeholder:text-purple-300/40"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => submitXp(1)}
                  disabled={adjustXp.isPending || !xpAmount}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-fuchsia-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Otorgar XP
                </button>
                <button
                  onClick={() => submitXp(-1)}
                  disabled={adjustXp.isPending || !xpAmount}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-purple-700 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  <Minus className="h-3.5 w-3.5" />
                  Quitar XP
                </button>
              </div>
              {adjustXp.data && (
                <div className="mt-2 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/5 p-2 text-[11px] text-fuchsia-200">
                  XP total: <b>{adjustXp.data.total_xp.toLocaleString("es-CO")}</b> · Nivel:{" "}
                  <b>{adjustXp.data.current_level}</b>
                </div>
              )}
              {adjustXp.isError && (
                <div className="mt-2 text-[11px] text-rose-300">
                  Error: {(adjustXp.error as Error).message}
                </div>
              )}
            </Panel>

            {/* Actions */}
            <Panel title="Acciones administrativas">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => blockMut.mutate(!detail.data!.profile?.is_blocked)}
                  disabled={blockMut.isPending}
                  className={`flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                    detail.data.profile?.is_blocked
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  }`}
                >
                  {detail.data.profile?.is_blocked ? (
                    <>
                      <LockOpen className="h-3.5 w-3.5" />
                      Desbloquear
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Bloquear
                    </>
                  )}
                </button>
                <button
                  onClick={() => resetMut.mutate()}
                  disabled={resetMut.isPending}
                  className="flex items-center justify-center gap-1 rounded-md border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-purple-200 hover:bg-purple-500/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset contraseña
                </button>
              </div>
              {resetMut.data?.ok && (
                <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[10px] text-emerald-200">
                  Enlace de recuperación enviado al correo del usuario.
                </div>
              )}
            </Panel>

            {/* History */}
            <Panel title="Historial reciente">
              {txs.isLoading ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
              ) : txs.isError ? (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">
                  No se pudo cargar el historial. {txs.error instanceof Error ? txs.error.message : ""}
                </div>
              ) : (
                <ul className="space-y-1">
                  {txs.data?.map(
                    (t: {
                      id: string;
                      type: string;
                      amount: number;
                      created_at: string;
                      game?: string | null;
                    }) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between rounded-md border border-purple-500/15 bg-[#150830]/50 px-2 py-1.5 text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              t.type === "win" || t.type === "deposit"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : t.type === "bet" || t.type === "withdrawal"
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-purple-500/15 text-purple-200"
                            }`}
                          >
                            {t.type}
                          </span>
                          <span className="text-purple-200/70">{t.game ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-display text-xs font-bold ${
                              Number(t.amount) >= 0 ? "text-emerald-300" : "text-rose-300"
                            }`}
                          >
                            {Number(t.amount) >= 0 ? "+" : ""}
                            {formatCOP(Number(t.amount))}
                          </span>
                          <span className="text-[9px] text-purple-300/50">
                            {t.created_at
                              ? new Date(t.created_at).toLocaleString("es-CO")
                              : ""}
                          </span>
                        </div>
                      </li>
                    ),
                  ) ?? null}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}