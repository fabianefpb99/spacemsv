import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Wallet as WalletIcon, Copy, Check, X } from "lucide-react";
import { useState } from "react";
import { listMyDeposits, cancelMyDeposit } from "@/lib/deposits/deposit.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/mis-recargas")({
  head: () => ({
    meta: [
      { title: "Mis Recargas — BetSpaceman" },
      { name: "description", content: "Historial de tus depósitos y recargas." },
    ],
  }),
  component: MisRecargasPage,
});

function formatCOP(n: number | null | undefined) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(Number(n ?? 0)));
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

type Status = "pendiente_pago" | "pendiente_revision" | "aprobada" | "rechazada" | "expirada";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pendiente_pago:     { label: "Pendiente de pago",   cls: "border-amber-400/60 bg-amber-500/10 text-amber-200" },
  pendiente_revision: { label: "En revisión",          cls: "border-sky-400/60 bg-sky-500/10 text-sky-200" },
  aprobada:           { label: "Aprobada",             cls: "border-emerald-400/60 bg-emerald-500/10 text-emerald-200" },
  rechazada:          { label: "Rechazada",            cls: "border-rose-400/60 bg-rose-500/10 text-rose-200" },
  expirada:           { label: "Expirada",             cls: "border-zinc-400/40 bg-zinc-500/10 text-zinc-300" },
};

function MisRecargasPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fn = useServerFn(listMyDeposits);
  const q = useQuery({
    queryKey: ["my-deposits", user?.id ?? null],
    enabled: !!user,
    queryFn: () => fn(),
    refetchInterval: 15_000,
  });

  if (!authLoading && !user) {
    navigate({ to: "/perfil" });
    return null;
  }

  const rows = (q.data ?? []) as Array<{
    id: string; reference: string; method: "nequi" | "breb";
    amount: number; bonus: number; status: Status; created_at: string;
    reject_reason: string | null;
  }>;

  return (
    <div className="min-h-screen bg-[#0b0420] text-white">
      <header className="sticky top-0 z-30 border-b border-purple-500/30 bg-[#0b0420]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/40 bg-[#150830] text-purple-200 hover:border-fuchsia-400/60">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-sm font-bold uppercase tracking-widest text-white">Mis Recargas</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-purple-200/70">Últimas 50 solicitudes</p>
          <Link to="/pay" className="rounded-md bg-purple-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-purple-500">
            + Nueva recarga
          </Link>
        </div>

        {q.isLoading ? (
          <div className="flex items-center justify-center py-16 text-purple-200/70">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-purple-500/30 bg-[#0c0620]/80 py-12 text-center">
            <WalletIcon className="mb-2 h-6 w-6 text-purple-300" />
            <p className="text-sm text-purple-100">Aún no tienes recargas</p>
            <p className="mt-1 text-xs text-purple-200/60">Haz tu primer depósito para empezar a jugar.</p>
            <Link to="/pay" className="mt-4 rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-purple-500">
              Depositar ahora
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <DepositRow key={r.id} row={r} onCancelled={() => q.refetch()} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function DepositRow({ row, onCancelled }: {
  row: {
    id: string; reference: string; method: "nequi" | "breb";
    amount: number; bonus: number; status: Status; created_at: string;
    reject_reason: string | null;
  };
  onCancelled: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const meta = STATUS_META[row.status];
  const canPay = row.status === "pendiente_pago";
  const canCancel = row.status === "pendiente_pago" || row.status === "pendiente_revision";
  const [openCancel, setOpenCancel] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(row.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <li className="rounded-2xl border border-purple-500/30 bg-[#0c0620]/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-purple-500/40 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-200">
              {row.method === "nequi" ? "Nequi" : "BRE-B"}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
              {meta.label}
            </span>
          </div>
          <button
            onClick={copy}
            className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-purple-100 hover:text-fuchsia-200"
            title="Copiar referencia"
          >
            <span className="font-mono">{row.reference}</span>
            {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3 opacity-70" />}
          </button>
          <div className="mt-0.5 text-[10px] text-purple-200/60">{formatDate(row.created_at)}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-base font-black text-white">
            <span className="neon-green mr-0.5">$</span>{formatCOP(row.amount)}
          </div>
          {Number(row.bonus) > 0 && (
            <div className="text-[10px] font-semibold text-amber-300">+ ${formatCOP(row.bonus)} bono</div>
          )}
        </div>
      </div>

      {row.status === "rechazada" && row.reject_reason && (
        <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
          Motivo: {row.reject_reason}
        </div>
      )}

      {canPay && (
        <Link
          to="/pay_/breb"
          search={{ id: row.id }}
          className="mt-2 flex w-full items-center justify-center rounded-md bg-gradient-to-r from-fuchsia-500 to-purple-600 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:brightness-110"
        >
          Continuar pago
        </Link>
      )}

      {canCancel && (
        <button
          onClick={() => setOpenCancel(true)}
          className="mt-2 flex w-full items-center justify-center rounded-md border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-rose-100 hover:bg-rose-500/20"
        >
          Cancelar solicitud
        </button>
      )}

      {openCancel && (
        <CancelModal
          depositId={row.id}
          onClose={() => setOpenCancel(false)}
          onCancelled={() => { setOpenCancel(false); onCancelled(); }}
        />
      )}
    </li>
  );
}

function CancelModal({ depositId, onClose, onCancelled }: {
  depositId: string; onClose: () => void; onCancelled: () => void;
}) {
  const cancelFn = useServerFn(cancelMyDeposit);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!confirmed || submitting) return;
    setSubmitting(true); setErr(null);
    try {
      await cancelFn({ data: { id: depositId } });
      onCancelled();
    } catch (e) {
      setErr((e as Error).message || "Error al cancelar");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/75" onClick={() => !submitting && onClose()} />
      <div className="relative w-full max-w-md rounded-t-2xl border border-rose-500/40 bg-gradient-to-b from-[#1a0820] to-[#0a0410] p-4 shadow-[0_0_30px_rgba(244,63,94,0.35)] sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <h3 className="font-display text-base font-black uppercase tracking-widest text-white">
            Cancelar solicitud
          </h3>
          <button onClick={() => !submitting && onClose()} className="rounded-md p-1 text-purple-200 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-[11px] leading-snug text-amber-100/90">
          <p className="font-bold uppercase tracking-wider text-amber-200">¿Confirmaste por error?</p>
          <p className="mt-1">
            Si confirmaste la solicitud por error y <b>no llegaste a enviar el pago</b>, te recomendamos cancelarla y repetir los pasos nuevamente.
          </p>
        </div>

        <div className="mt-2 rounded-xl border border-rose-500/50 bg-rose-500/10 p-3 text-[11px] leading-snug text-rose-100/90">
          <p className="font-bold uppercase tracking-wider text-rose-200">⚠ Si ya enviaste el pago</p>
          <p className="mt-1">
            <b>No canceles esta solicitud.</b> Si ya transferiste el dinero y cancelas, no podremos asociar el pago a tu cuenta y los fondos podrían <b>perderse</b>. Espera a que el administrador verifique tu depósito.
          </p>
        </div>

        <label className="mt-3 flex items-start gap-2 text-[11px] text-purple-100/90">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-rose-400"
          />
          <span>Confirmo que <b>no he enviado</b> el pago y deseo cancelar esta solicitud.</span>
        </label>

        {err && <p className="mt-2 text-center text-xs text-rose-300">{err}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => !submitting && onClose()}
            className="rounded-xl border border-purple-500/40 bg-[#0c0620] px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-purple-200 hover:bg-purple-500/10"
          >
            Volver
          </button>
          <button
            onClick={submit}
            disabled={!confirmed || submitting}
            className="rounded-xl bg-rose-500 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#1a0408] shadow-[0_0_24px_-6px_rgba(244,63,94,0.8)] transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-rose-900/40 disabled:text-rose-200/40"
          >
            {submitting ? "Cancelando…" : "Sí, cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}