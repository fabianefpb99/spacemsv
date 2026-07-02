import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  Clock,
  Info,
  Lock,
  ShieldCheck,
  UserCircle2,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import betspaceLogo from "@/assets/betspace-logo.svg";
import nequiLogo from "@/assets/nequi.svg";
import brebLogo from "@/assets/bre-b.svg";
import { AuthControl } from "@/components/auth/AuthControl";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useMe } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PersonalDataDialog } from "@/components/profile/PersonalDataDialog";
import {
  cancelMyWithdrawal,
  createWithdrawal,
  listMyWithdrawalAccounts,
  listMyWithdrawals,
  upsertMyWithdrawalAccount,
} from "@/lib/withdrawals/withdrawal.functions";

const MIN_WITHDRAW = 20_000;

export const Route = createFileRoute("/retiros")({
  head: () => ({
    meta: [
      { title: "Retiros — BETSPACE Casino" },
      { name: "description", content: "Solicita el retiro de tus ganancias a Nequi o BRE-B de forma rápida y segura." },
      { property: "og:title", content: "Retiros — BETSPACE Casino" },
      { property: "og:description", content: "Solicita el retiro de tus ganancias a Nequi o BRE-B de forma rápida y segura." },
    ],
  }),
  component: RetirosGated,
});

function RetirosGated() {
  return (
    <RequireAuth>
      <RetirosPage />
    </RequireAuth>
  );
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(Math.max(0, n)));
}

function maskAccount(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return `•••• ${digits}`;
  return `•••• ${digits.slice(-4)}`;
}

function formatRel(s: string) {
  try {
    const t = new Date(s).getTime();
    const diff = Date.now() - t;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Hace instantes";
    if (mins < 60) return `Hace ${mins} minuto${mins === 1 ? "" : "s"}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} hora${hours === 1 ? "" : "s"}`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} día${days === 1 ? "" : "s"}`;
  } catch {
    return "";
  }
}

type MethodId = "nequi" | "breb";

type Account = {
  method: MethodId;
  identifier: string;
  bankLabel?: string;
  isDefault?: boolean;
};

function RetirosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = useMe();
  const balance = me.data?.balance ?? 0;
  const balanceText = me.data ? formatCOP(balance) : "—";
  const qc = useQueryClient();

  // Personal data gate — withdrawals require a fully completed profile
  const fullProfile = useQuery({
    queryKey: ["perfil-full", user?.id ?? null],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "first_name, second_name, last_name, second_last_name, gender, birth_date, phone, document_type, document_number, document_issue_date, terms_accepted_at, profile_completed",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [dataDialogOpen, setDataDialogOpen] = useState(false);
  const profileBlocked = !!user && fullProfile.isSuccess && !fullProfile.data?.profile_completed;

  const listAccountsFn = useServerFn(listMyWithdrawalAccounts);
  const listWdFn = useServerFn(listMyWithdrawals);
  const createWdFn = useServerFn(createWithdrawal);
  const cancelWdFn = useServerFn(cancelMyWithdrawal);
  const upsertAccountFn = useServerFn(upsertMyWithdrawalAccount);

  // Saved accounts from backend
  const accountsQ = useQuery({
    queryKey: ["my-withdrawal-accounts", user?.id ?? null],
    enabled: !!user,
    queryFn: () => listAccountsFn(),
  });
  const accounts: Account[] = useMemo(() => {
    return (accountsQ.data ?? []).map((a: any) => ({
      method: a.method as MethodId,
      identifier: a.identifier,
      bankLabel: a.bank_label ?? undefined,
      isDefault: a.is_default,
    }));
  }, [accountsQ.data]);

  const defaultAcc = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
  const [selectedMethod, setSelectedMethod] = useState<MethodId>(defaultAcc?.method ?? "nequi");
  useEffect(() => {
    if (defaultAcc) setSelectedMethod(defaultAcc.method);
  }, [defaultAcc?.method]);

  const selectedAccount = accounts.find((a) => a.method === selectedMethod) ?? null;

  // Amount state
  const [amount, setAmount] = useState<number>(0);
  function addAmount(n: number) {
    setAmount((v) => Math.min(balance, v + n));
  }
  function setMax() { setAmount(balance); }

  // Pending add-account form (only saved when the request is submitted)
  const [openAdd, setOpenAdd] = useState<{ method: MethodId; initial?: Account | null } | null>(null);
  const [pendingAccount, setPendingAccount] = useState<Account | null>(null);

  // After saving the form locally, ensure the chosen method is selected
  useEffect(() => {
    if (pendingAccount) setSelectedMethod(pendingAccount.method);
  }, [pendingAccount]);

  const activeAccount: Account | null =
    pendingAccount && pendingAccount.method === selectedMethod
      ? pendingAccount
      : selectedAccount;

  // Submit feedback (no backend yet)
  const [toast, setToast] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const belowMin = amount > 0 && amount < MIN_WITHDRAW;
  const overBalance = amount > balance;

  // Withdrawals history (from withdrawal_requests)
  const recentQ = useQuery({
    queryKey: ["my-withdrawals", user?.id ?? null],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: () => listWdFn(),
  });
  const recentRows = (recentQ.data ?? []) as Array<{
    id: string;
    amount: number;
    net_amount: number;
    method: MethodId;
    account_identifier: string;
    status: string;
    reject_reason: string | null;
    created_at: string;
  }>;

  const createMut = useMutation({
    mutationFn: (vars: { amount: number; account: Account }) =>
      createWdFn({
        data: {
          amount: vars.amount,
          method: vars.account.method,
          account_identifier: vars.account.identifier,
          account_label: vars.account.bankLabel ?? null,
        },
      }),
    onSuccess: () => {
      setAmount(0);
      setPendingAccount(null);
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["my-withdrawal-accounts"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      setToast({ kind: "ok", text: "Solicitud enviada. Un administrador la revisará pronto." });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      const text = msg.includes("insufficient_funds")
        ? "Saldo insuficiente."
        : msg.includes("has_pending_withdrawal")
        ? "Ya tienes un retiro pendiente. Espera o cancélalo."
        : msg.includes("invalid_amount")
        ? `Monto inválido. Mínimo $${formatCOP(MIN_WITHDRAW)} COP.`
        : "No se pudo procesar la solicitud.";
      setToast({ kind: "err", text });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelWdFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      setToast({ kind: "ok", text: "Solicitud cancelada. Tu saldo fue devuelto." });
    },
    onError: () => setToast({ kind: "err", text: "No se pudo cancelar." }),
  });

  const upsertMut = useMutation({
    mutationFn: (acc: Account) =>
      upsertAccountFn({
        data: {
          method: acc.method,
          identifier: acc.identifier,
          bank_label: acc.bankLabel ?? null,
        },
      }),
    onSuccess: (_row, acc) => {
      setPendingAccount(null);
      setSelectedMethod(acc.method);
      qc.invalidateQueries({ queryKey: ["my-withdrawal-accounts"] });
      setToast({ kind: "ok", text: "Cuenta guardada." });
    },
    onError: () => setToast({ kind: "err", text: "No se pudo guardar la cuenta." }),
  });

  const canSubmit =
    !!activeAccount && amount >= MIN_WITHDRAW && !overBalance && !createMut.isPending;

  function handleSubmit() {
    if (createMut.isPending) return;
    if (!activeAccount) {
      setToast({ kind: "warn", text: "Agrega una cuenta de retiro antes de continuar." });
      return;
    }
    if (amount < MIN_WITHDRAW) {
      setToast({ kind: "warn", text: `El monto mínimo de retiro es $${formatCOP(MIN_WITHDRAW)} COP.` });
      return;
    }
    if (overBalance) {
      setToast({ kind: "err", text: "El monto supera tu balance disponible." });
      return;
    }
    createMut.mutate({ amount, account: activeAccount });
  }

  return (
    <div className="theme-dark-fixed min-h-screen bg-[#060210] text-white font-pay">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-10 pt-4 sm:max-w-lg sm:px-4">
        {/* Header */}
        <header
          className="flex items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate({ to: "/perfil" })}
              className="rounded-md p-2 text-white hover:bg-white/10"
              aria-label="Volver"
            >
              <ArrowLeft className="h-7 w-7" strokeWidth={3} />
            </button>
            <Link to="/home">
              <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7 translate-y-px" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-sm font-black uppercase tracking-[0.22em] text-white">
              Retiros
            </h1>
            <AuthControl />
          </div>
        </header>

        {profileBlocked ? (
          <ProfileGate
            onOpen={() => setDataDialogOpen(true)}
            balanceText={balanceText}
          />
        ) : (
        <>
        {/* Balance card */}
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-b from-[#180a3a] to-[#0a0420] p-4 shadow-[0_0_30px_-10px_rgba(168,85,247,0.55)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/15 shadow-[0_0_18px_-4px_rgba(217,70,239,0.7)]">
              <WalletIcon className="h-6 w-6 text-fuchsia-200" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-200/70">
                Balance disponible
              </div>
              <div className="mt-0.5 text-2xl font-extrabold leading-none">
                <span className="neon-green mr-1">$</span>
                <span className="text-white">{balanceText}</span>
                <span className="ml-1 text-sm font-bold text-purple-200/80">COP</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-purple-200/60">
                <Info className="h-3 w-3" /> Retiro mínimo: ${formatCOP(MIN_WITHDRAW)} COP
              </div>
            </div>
            <button
              onClick={() => setAmount(balance)}
              disabled={balance < MIN_WITHDRAW}
              className="shrink-0 rounded-lg border border-fuchsia-400/60 bg-fuchsia-500/10 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Retirar todo
            </button>
          </div>
        </div>

        {/* Step 1: método de retiro */}
        <SectionTitle>Método de retiro</SectionTitle>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          <MethodTile
            selected={selectedMethod === "nequi"}
            logo={<img src={nequiLogo} alt="Nequi" className="h-5 w-auto" />}
            title="NEQUI"
            account={
              (pendingAccount?.method === "nequi" ? pendingAccount : undefined) ??
              accounts.find((a) => a.method === "nequi")
            }
            onSelect={() => {
              const a =
                (pendingAccount?.method === "nequi" ? pendingAccount : undefined) ??
                accounts.find((x) => x.method === "nequi");
              if (a) setSelectedMethod("nequi");
              else setOpenAdd("nequi");
            }}
            onAdd={() => setOpenAdd("nequi")}
          />
          <MethodTile
            selected={selectedMethod === "breb"}
            logo={<img src={brebLogo} alt="BRE-B" className="h-5 w-auto" />}
            title="BRE-B"
            account={
              (pendingAccount?.method === "breb" ? pendingAccount : undefined) ??
              accounts.find((a) => a.method === "breb")
            }
            onSelect={() => {
              const a =
                (pendingAccount?.method === "breb" ? pendingAccount : undefined) ??
                accounts.find((x) => x.method === "breb");
              if (a) setSelectedMethod("breb");
              else setOpenAdd("breb");
            }}
            onAdd={() => setOpenAdd("breb")}
          />
        </div>

        {/* Step 2: monto */}
        <SectionTitle>Monto a retirar</SectionTitle>
        <div className="mt-2 rounded-2xl border border-purple-500/30 bg-[#0c0620] p-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1">
              <span className="text-2xl font-extrabold text-white">$</span>
              <input
                inputMode="numeric"
                placeholder="0"
                value={amount ? formatCOP(amount) : ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                  setAmount(Math.min(balance, isNaN(v) ? 0 : v));
                }}
                className="w-full bg-transparent text-2xl font-extrabold tracking-tight text-white placeholder:text-purple-300/30 focus:outline-none"
              />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200/70">COP</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <QuickChip label="+10.000" onClick={() => addAmount(10_000)} />
            <QuickChip label="+20.000" onClick={() => addAmount(20_000)} />
            <QuickChip label="+50.000" onClick={() => addAmount(50_000)} />
            <QuickChip label="MAX" tone="accent" onClick={setMax} />
          </div>

          {belowMin && (
            <p className="mt-2 text-[11px] text-amber-300/90">
              <CircleAlert className="-mt-0.5 mr-1 inline-block h-3 w-3" />
              Mínimo ${formatCOP(MIN_WITHDRAW)} COP.
            </p>
          )}
          {overBalance && (
            <p className="mt-2 text-[11px] text-rose-300/90">
              <CircleAlert className="-mt-0.5 mr-1 inline-block h-3 w-3" />
              Supera tu balance disponible.
            </p>
          )}
        </div>

        {/* Resumen */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <SummaryCell
            icon={<WalletIcon className="h-4 w-4 text-emerald-300" />}
            label="Recibirás"
            value={
              <span className="text-emerald-300">
                ${formatCOP(amount - Math.round(amount * 0.01))} <span className="text-[10px] font-bold text-emerald-300/80">COP</span>
              </span>
            }
          />
          <SummaryCell
            label="Comisión (1%)"
            value={
              <span className="text-white">
                ${formatCOP(Math.round(amount * 0.01))} <span className="text-[10px] font-bold text-purple-200/70">COP</span>
              </span>
            }
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_0_24px_-6px_rgba(217,70,239,0.85)] transition hover:from-fuchsia-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:from-purple-900/40 disabled:to-purple-900/40 disabled:text-purple-200/40 disabled:shadow-none"
        >
          {createMut.isPending ? "Enviando…" : "Solicitar retiro"}
        </button>
        <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-purple-200/60">
          <Lock className="h-3 w-3" /> Tu retiro será revisado por un administrador
        </p>

        {/* Últimos retiros */}
        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-200/80">
            Últimos retiros
          </h3>
          <button
            onClick={() => setToast({ kind: "warn", text: "El historial completo estará disponible pronto." })}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300 hover:text-fuchsia-200"
          >
            Ver todo <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <ul className="mt-2 space-y-1.5">
          {recentQ.isLoading ? (
            <li className="rounded-xl border border-purple-500/25 bg-[#0c0620] p-3 text-[11px] text-purple-200/60">
              Cargando…
            </li>
          ) : recentRows.length === 0 ? (
            <li className="rounded-xl border border-purple-500/25 bg-[#0c0620] p-4 text-center">
              <p className="text-[11px] text-purple-200/70">Aún no has realizado retiros.</p>
            </li>
          ) : (
            recentRows.map((r) => (
              <HistoryRow
                key={r.id}
                status={r.status}
                method={r.method}
                accountTail={r.account_identifier ? maskAccount(r.account_identifier) : "Retiro"}
                amount={Math.abs(Number(r.amount) || 0)}
                when={formatRel(r.created_at)}
                rejectReason={r.reject_reason}
                canCancel={r.status === "pendiente"}
                onCancel={() => cancelMut.mutate(r.id)}
              />
            ))
          )}
        </ul>

        {/* Footer reassurance */}
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-purple-500/25 bg-[#0c0620] p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <p className="text-[11px] leading-snug text-purple-100/80">
            Todos los retiros son procesados de forma segura.
            <br />
            <span className="text-purple-200/60">Tiempo estimado: 10 minutos a 24 horas hábiles.</span>
          </p>
        </div>
        </>
        )}
      </div>

      {/* Add-account modal */}
      {openAdd && (
        <AddAccountModal
          method={openAdd}
          onClose={() => setOpenAdd(null)}
          onSave={(acc) => {
            // Saved permanently when the withdrawal request is submitted.
            setPendingAccount({ ...acc, isDefault: true });
            setSelectedMethod(acc.method);
            setOpenAdd(null);
          }}
        />
      )}

      {user && (
        <PersonalDataDialog
          open={dataDialogOpen}
          onOpenChange={setDataDialogOpen}
          userId={user.id}
          initial={fullProfile.data ?? undefined}
          title="Completa tus datos para retirar"
          subtitle="Es obligatorio registrar tu información personal antes de solicitar retiros."
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["perfil-full", user.id] });
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            className={
              "pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px] shadow-xl backdrop-blur " +
              (toast.kind === "ok"
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                : toast.kind === "warn"
                ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
                : "border-rose-400/50 bg-rose-500/15 text-rose-100")
            }
          >
            {toast.kind === "ok" ? (
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="leading-snug">{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */

function ProfileGate({ onOpen, balanceText }: { onOpen: () => void; balanceText: string }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-b from-[#2a1306] to-[#0a0420] p-5 shadow-[0_0_30px_-10px_rgba(251,191,36,0.55)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/15">
            <UserCircle2 className="h-7 w-7 text-amber-200" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
              Verificación requerida
            </div>
            <h2 className="mt-1 font-display text-base font-black leading-tight text-white">
              Completa tus datos personales para retirar
            </h2>
            <p className="mt-1.5 text-[12px] leading-snug text-purple-100/80">
              Por seguridad y cumplimiento, necesitamos tus datos completos antes de procesar
              cualquier retiro. Solo te tomará un minuto.
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-purple-500/25 bg-[#0c0620]/70 px-3 py-2 text-[11px] text-purple-200/80">
          <span className="text-purple-200/60">Balance disponible:</span>{" "}
          <span className="font-display font-bold text-white">${balanceText} COP</span>
        </div>
        <button
          onClick={onOpen}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-fuchsia-500 px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_0_24px_-6px_rgba(251,191,36,0.75)] transition hover:from-amber-300 hover:to-fuchsia-400"
        >
          <UserCircle2 className="h-4 w-4" />
          Completar datos ahora
        </button>
      </div>
      <div className="flex items-start gap-2 rounded-2xl border border-purple-500/25 bg-[#0c0620] p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-[11px] leading-snug text-purple-100/80">
          Tus datos están protegidos y solo se usan para verificar tu identidad y procesar tus
          pagos.
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-purple-200/80">
      {children}
    </h3>
  );
}

function MethodTile({
  selected, logo, title, account, onSelect, onAdd,
}: {
  selected: boolean;
  logo: React.ReactNode;
  title: string;
  account?: Account;
  onSelect: () => void;
  onAdd: () => void;
}) {
  const hasAccount = !!account;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "relative flex flex-col gap-1.5 rounded-2xl border p-3 text-left transition " +
        (selected && hasAccount
          ? "border-fuchsia-400/70 bg-fuchsia-500/10 shadow-[0_0_22px_-10px_rgba(217,70,239,0.85)]"
          : "border-purple-500/25 bg-[#0c0620] hover:border-purple-400/50")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logo}
          <span className="text-[12px] font-extrabold tracking-wide text-white">{title}</span>
        </div>
        <span
          className={
            "flex h-5 w-5 items-center justify-center rounded-full border-2 " +
            (selected && hasAccount
              ? "border-fuchsia-300 bg-fuchsia-400/30"
              : "border-purple-400/50")
          }
        >
          {selected && hasAccount && <Check className="h-3 w-3 text-fuchsia-100" strokeWidth={3} />}
        </span>
      </div>
      {hasAccount ? (
        <>
          <div className="font-mono text-[12px] tracking-wider text-purple-100">
            {maskAccount(account!.identifier)}
          </div>
          {account!.bankLabel && (
            <div className="text-[10px] text-purple-200/60">{account!.bankLabel}</div>
          )}
          {account!.isDefault && (
            <span className="mt-0.5 inline-flex w-fit rounded-md bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fuchsia-200">
              Predeterminado
            </span>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="mt-0.5 self-start rounded-md border border-purple-400/50 bg-purple-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/20"
        >
          + Agregar cuenta
        </button>
      )}
    </button>
  );
}

function QuickChip({ label, onClick, tone }: { label: string; onClick: () => void; tone?: "accent" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition " +
        (tone === "accent"
          ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20"
          : "border-purple-500/40 bg-[#150830] text-purple-100 hover:border-purple-400/60 hover:bg-purple-500/15")
      }
    >
      {label}
    </button>
  );
}

function SummaryCell({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-purple-500/25 bg-[#0c0620] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200/70">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-extrabold">{value}</div>
    </div>
  );
}

function HistoryRow({
  status, method, accountTail, amount, when, rejectReason, canCancel, onCancel,
}: {
  status: string;
  method?: MethodId;
  accountTail: string;
  amount: number;
  when: string;
  rejectReason?: string | null;
  canCancel?: boolean;
  onCancel?: () => void;
}) {
  const isOk = status === "completed" || status === "approved" || status === "aprobada";
  const isPending = status === "pending" || status === "pendiente" || status === "pendiente_revision";
  const isReject = status === "rejected" || status === "rechazada" || status === "failed";
  const isCancel = status === "cancelada" || status === "cancelled";

  const statusMeta = isOk
    ? { Icon: CircleCheck, label: "Aprobado", cls: "text-emerald-300", border: "border-emerald-400/50", amountCls: "text-emerald-300" }
    : isPending
    ? { Icon: Clock, label: "Pendiente", cls: "text-amber-300", border: "border-amber-400/50", amountCls: "text-amber-300" }
    : isReject
    ? { Icon: CircleAlert, label: "Rechazado", cls: "text-rose-300", border: "border-rose-400/50", amountCls: "text-rose-300" }
    : isCancel
    ? { Icon: X, label: "Cancelado", cls: "text-purple-200", border: "border-purple-400/50", amountCls: "text-purple-200" }
    : { Icon: CircleCheck, label: "Registrado", cls: "text-purple-200", border: "border-purple-400/50", amountCls: "text-white" };

  return (
    <li className="rounded-xl border border-purple-500/25 bg-[#0c0620] p-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-black/30 ${statusMeta.border}`}>
          <statusMeta.Icon className={`h-4 w-4 ${statusMeta.cls}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[12px] font-bold ${statusMeta.cls}`}>{statusMeta.label}</div>
          <div className="truncate text-[10px] text-purple-200/70">
            {method === "nequi" ? "Nequi" : method === "breb" ? "BRE-B" : "Retiro"} {accountTail}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[13px] font-extrabold ${statusMeta.amountCls}`}>
            ${formatCOP(amount)} <span className="text-[10px] font-bold opacity-80">COP</span>
          </div>
          <div className="text-[10px] text-purple-200/60">{when}</div>
        </div>
      </div>
      {isReject && rejectReason && (
        <p className="mt-2 rounded-md border border-rose-400/30 bg-rose-500/5 px-2 py-1.5 text-[10px] text-rose-200/90">
          <b>Motivo:</b> {rejectReason}
        </p>
      )}
      {canCancel && onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 w-full rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-500/20"
        >
          Cancelar solicitud
        </button>
      )}
    </li>
  );
}

function AddAccountModal({
  method, onClose, onSave,
}: {
  method: MethodId;
  onClose: () => void;
  onSave: (acc: Account) => void;
}) {
  const isNequi = method === "nequi";
  const [id, setId] = useState("");
  const [bank, setBank] = useState("");
  const [confirm, setConfirm] = useState(false);

  const idDigits = id.replace(/\D/g, "");
  const valid = isNequi
    ? idDigits.length === 10
    : id.trim().length >= 4 && id.trim().length <= 40;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl border border-fuchsia-500/40 bg-gradient-to-b from-[#180a3a] to-[#0a0410] p-4 shadow-[0_0_30px_rgba(217,70,239,0.4)] sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <img src={isNequi ? nequiLogo : brebLogo} alt="" className="h-5 w-auto" />
            <h3 className="font-display text-base font-black uppercase tracking-widest text-white">
              Cuenta {isNequi ? "Nequi" : "BRE-B"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-purple-200 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-[11px] text-purple-200/75">
          {isNequi
            ? "Ingresa el número de celular asociado a tu cuenta Nequi (10 dígitos)."
            : "Ingresa tu alias o llave BRE-B (correo, celular o cédula)."}
        </p>

        <div className="mt-3 space-y-2.5">
          <label className="block text-[10px] uppercase tracking-widest text-purple-200/70">
            {isNequi ? "Número de celular" : "Alias / Llave BRE-B"}
            <input
              inputMode={isNequi ? "numeric" : "text"}
              value={id}
              onChange={(e) => {
                const v = isNequi
                  ? e.target.value.replace(/\D/g, "").slice(0, 10)
                  : e.target.value.slice(0, 40);
                setId(v);
              }}
              placeholder={isNequi ? "300 000 0000" : "tu.alias@banco"}
              className="mt-1 w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 font-mono text-sm tracking-wider text-white placeholder:text-purple-300/30 focus:border-fuchsia-400 focus:outline-none"
            />
          </label>
          {!isNequi && (
            <label className="block text-[10px] uppercase tracking-widest text-purple-200/70">
              Banco (opcional)
              <input
                value={bank}
                onChange={(e) => setBank(e.target.value.slice(0, 60))}
                placeholder="Bancolombia · Ahorros"
                className="mt-1 w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 text-sm text-white placeholder:text-purple-300/30 focus:border-fuchsia-400 focus:outline-none"
              />
            </label>
          )}

          <label className="flex items-start gap-2 text-[11px] text-purple-100/90">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-fuchsia-400"
            />
            <span>
              Confirmo que la cuenta está a <b>mi nombre</b> y los datos son correctos.
            </span>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-purple-500/40 bg-[#0c0620] px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-purple-200 hover:bg-purple-500/10"
          >
            Cancelar
          </button>
          <button
            onClick={() => valid && confirm && onSave({ method, identifier: id, bankLabel: bank || undefined })}
            disabled={!valid || !confirm}
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-white shadow-[0_0_22px_-6px_rgba(217,70,239,0.85)] hover:from-fuchsia-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:from-purple-900/40 disabled:to-purple-900/40 disabled:text-purple-200/40 disabled:shadow-none"
          >
            Guardar cuenta
          </button>
        </div>
      </div>
    </div>
  );
}