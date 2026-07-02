import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Loader2, RefreshCw, Search, X } from "lucide-react";
import astronaut from "@/assets/astronaut.svg";
import { useHistoryBackClose } from "@/hooks/useHistoryBackClose";
import {
  adminApproveDeposit,
  adminGetDeposit,
  adminListDeposits,
  adminRejectDeposit,
} from "@/lib/deposits/deposit.functions";
import {
  type DepositRow,
  Info2,
  Panel,
  depositStatusBadge,
  formatCOP,
  shortId,
} from "./shared";

const DEPOSIT_STATUSES = [
  { v: "all", l: "Todos" },
  { v: "pendiente_revision", l: "Pendiente Revisión" },
  { v: "pendiente_pago", l: "Pendiente Pago" },
  { v: "aprobada", l: "Aprobada" },
  { v: "rechazada", l: "Rechazada" },
  { v: "expirada", l: "Expirada" },
] as const;

export function DepositsSection() {
  const listFn = useServerFn(adminListDeposits);
  const qc = useQueryClient();
  const [status, setStatus] =
    useState<(typeof DEPOSIT_STATUSES)[number]["v"]>("pendiente_revision");
  const [method, setMethod] = useState<"all" | "nequi" | "breb">("all");
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["admin-deposits", status, method, range, debounced, page],
    queryFn: () =>
      listFn({ data: { status, method, range, search: debounced, page, pageSize: 25 } }),
  });

  useEffect(() => {
    // Realtime on deposit_requests is disabled to avoid broadcasting PII.
    // Poll for updates instead — payload was never consumed anyway.
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
    }, 15000);
    return () => clearInterval(t);
  }, [qc]);

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <Panel
        title="Recargas (depósitos manuales)"
        actions={
          <button
            onClick={() => q.refetch()}
            className="flex items-center gap-1 rounded-md border border-purple-500/30 px-2 py-1 text-[10px] uppercase tracking-widest text-purple-200 hover:bg-white/5"
          >
            <RefreshCw className="h-3 w-3" /> Actualizar
          </button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-300/60" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Referencia, correo, usuario o ID…"
              className="w-full rounded-md border border-purple-500/30 bg-[#150830] py-2 pl-7 pr-2 text-xs text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white"
          >
            {DEPOSIT_STATUSES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as typeof method);
              setPage(1);
            }}
            className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white"
          >
            <option value="all">Todos los métodos</option>
            <option value="nequi">Nequi</option>
            <option value="breb">BRE-B</option>
          </select>
          <select
            value={range}
            onChange={(e) => {
              setRange(e.target.value as typeof range);
              setPage(1);
            }}
            className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white"
          >
            <option value="all">Todo el tiempo</option>
            <option value="today">Hoy</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </div>

        {q.isLoading ? (
          <div className="flex items-center justify-center py-12 text-purple-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : q.data && q.data.rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-purple-200/60">Sin recargas.</div>
        ) : (
          <ul className="space-y-2">
            {(q.data?.rows as DepositRow[] | undefined)?.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setSelected(d.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-purple-500/20 bg-[#150830]/60 p-2.5 text-left transition hover:border-fuchsia-500/50 hover:bg-[#1a0b3a]/80"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{d.reference}</span>
                      <span className="text-[10px] text-purple-300/70">
                        #{shortId(d.user_id)}
                      </span>
                      <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple-200">
                        {d.method}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-purple-200/60">
                      {d.username ?? d.email} ·{" "}
                      {new Date(d.created_at).toLocaleString("es-CO")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xs font-bold text-white">
                      <span className="neon-green mr-0.5">$</span>
                      {formatCOP(Number(d.amount))}
                    </div>
                    {Number(d.bonus) > 0 && (
                      <div className="text-[9px] font-bold text-amber-300">
                        +${formatCOP(Number(d.bonus))}
                      </div>
                    )}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${depositStatusBadge(d.status)}`}
                  >
                    {d.status.replace("_", " ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between text-[10px] text-purple-200/70">
          <span>
            Página {page} de {totalPages} · {q.data?.total ?? 0} recargas
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

      {selected && <DepositDetailDrawer id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DepositDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  useHistoryBackClose(true, onClose);
  const getFn = useServerFn(adminGetDeposit);
  const approveFn = useServerFn(adminApproveDeposit);
  const rejectFn = useServerFn(adminRejectDeposit);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-deposit", id], queryFn: () => getFn({ data: { id } }) });
  const approve = useMutation({
    mutationFn: () => approveFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
      qc.invalidateQueries({ queryKey: ["admin-deposit", id] });
    },
  });
  const reject = useMutation({
    mutationFn: (reason: string) => rejectFn({ data: { id, reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
      qc.invalidateQueries({ queryKey: ["admin-deposit", id] });
    },
  });
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const d = q.data as DepositRow | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full flex-col overflow-y-auto border-l border-fuchsia-500/40 bg-gradient-to-b from-[#0c0620] to-[#060210] shadow-[0_0_30px_rgba(217,70,239,0.3)] sm:my-6 sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-2xl sm:border">
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
            Detalle de recarga
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-purple-200 hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {q.isLoading || !d ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-purple-300" />
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3 rounded-xl border border-fuchsia-500/40 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-fuchsia-400/60 bg-purple-900/40">
                <img src={astronaut} alt="" className="h-9 w-9 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-base font-black text-white">
                  {d.username ?? "—"}
                </div>
                <div className="truncate text-[11px] text-purple-200/70">{d.email}</div>
                <div className="text-[10px] text-purple-300/60">#{shortId(d.user_id)}</div>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${depositStatusBadge(d.status)}`}
              >
                {d.status.replace("_", " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info2 k="Monto" v={`$${formatCOP(Number(d.amount))}`} />
              <Info2 k="Bonus" v={`$${formatCOP(Number(d.bonus))}`} />
              <Info2 k="Método" v={d.method.toUpperCase()} />
              <Info2 k="Referencia" v={d.reference} mono />
              <Info2 k="Creada" v={new Date(d.created_at).toLocaleString("es-CO")} />
              <Info2
                k="Confirmada"
                v={d.confirmed_at ? new Date(d.confirmed_at).toLocaleString("es-CO") : "—"}
              />
            </div>

            <Panel title="Datos del pagador">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Info2
                  k="¿Es el titular?"
                  v={d.payer_self == null ? "—" : d.payer_self ? "Sí" : "No"}
                />
                <Info2 k="Teléfono" v={d.payer_phone ?? "—"} />
                <Info2 k="Nombres" v={d.payer_first_name ?? "—"} />
                <Info2 k="Apellidos" v={d.payer_last_name ?? "—"} />
              </div>
            </Panel>

            {d.status === "aprobada" && (
              <Panel title="Movimiento aplicado">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Info2 k="Saldo anterior" v={`$${formatCOP(Number(d.prev_balance ?? 0))}`} />
                  <Info2 k="Saldo nuevo" v={`$${formatCOP(Number(d.new_balance ?? 0))}`} />
                </div>
              </Panel>
            )}
            {d.status === "rechazada" && d.reject_reason && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-rose-200">
                <b className="uppercase tracking-widest text-[10px]">Motivo del rechazo:</b>
                <br />
                {d.reject_reason}
              </div>
            )}

            {d.status === "pendiente_revision" && (
              <>
                {!showReject ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => approve.mutate()}
                      disabled={approve.isPending}
                      className="flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => setShowReject(true)}
                      className="flex items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-500"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rechazar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Motivo del rechazo (obligatorio)"
                      rows={3}
                      maxLength={300}
                      className="w-full rounded-md border border-rose-500/30 bg-[#150830] px-2 py-2 text-xs text-white placeholder:text-purple-300/40"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setShowReject(false);
                          setReason("");
                        }}
                        className="rounded-md border border-purple-500/30 px-3 py-2 text-xs font-bold uppercase text-purple-200"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => reject.mutate(reason.trim())}
                        disabled={reason.trim().length < 3 || reject.isPending}
                        className="rounded-md bg-rose-600 px-3 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
                      >
                        Confirmar rechazo
                      </button>
                    </div>
                  </div>
                )}
                {approve.isError && (
                  <p className="text-xs text-rose-300">
                    Error: {(approve.error as Error).message}
                  </p>
                )}
                {reject.isError && (
                  <p className="text-xs text-rose-300">
                    Error: {(reject.error as Error).message}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}