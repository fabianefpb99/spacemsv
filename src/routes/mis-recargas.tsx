import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Wallet as WalletIcon, Copy, Check } from "lucide-react";
import { useState } from "react";
import { listMyDeposits } from "@/lib/deposits/deposit.functions";
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
              <DepositRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function DepositRow({ row }: {
  row: {
    id: string; reference: string; method: "nequi" | "breb";
    amount: number; bonus: number; status: Status; created_at: string;
    reject_reason: string | null;
  };
}) {
  const [copied, setCopied] = useState(false);
  const meta = STATUS_META[row.status];
  const canPay = row.status === "pendiente_pago";

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
    </li>
  );
}