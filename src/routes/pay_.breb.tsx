import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Check, Info, CheckCircle2, Loader2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { confirmDeposit, getMyDeposit, cancelMyDeposit } from "@/lib/deposits/deposit.functions";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { AuthControl } from "@/components/auth/AuthControl";
import { RequireAuth } from "@/components/auth/RequireAuth";
import nequiAstronaut from "@/assets/nequi-astronaut-wide.png";
import nequiLogo from "@/assets/nequi.svg";
import brebLogo from "@/assets/bre-b.svg";

export const Route = createFileRoute("/pay_/breb")({
  validateSearch: (search: Record<string, unknown>) => {
    const id = typeof search.id === "string" ? search.id : "";
    return { id };
  },
  head: () => ({
    meta: [
      { title: "Confirmar Depósito BRE-B | BETSPACE Casino Online" },
      { name: "description", content: "Sigue las instrucciones para completar tu depósito de forma segura." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PayBrebGated,
});

function PayBrebGated() {
  return (
    <RequireAuth>
      <PayBrebPage />
    </RequireAuth>
  );
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function shortId(id: string) {
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(-6);
  const n = parseInt(hex || "0", 16) % 100000;
  return String(n).padStart(5, "0");
}

function PayBrebPage() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { user } = useAuth();
  const me = useMe();
  const getFn = useServerFn(getMyDeposit);
  const confirmFn = useServerFn(confirmDeposit);
  const cancelFn = useServerFn(cancelMyDeposit);

  // Payer modal state
  const [openPayer, setOpenPayer] = useState(false);
  const [payerSelf, setPayerSelf] = useState(true);
  const [pFirst, setPFirst] = useState("");
  const [pLast, setPLast] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);

  // Cancel modal state
  const [openCancel, setOpenCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const shouldPollDeposit = submitting;

  const q = useQuery({
    queryKey: ["my-deposit", id],
    enabled: !!id,
    queryFn: () => getFn({ data: { id } }),
    refetchInterval: (query) => {
      const s = (query.state.data as { status?: string } | undefined)?.status;
      if (shouldPollDeposit) return 2000;
      return s === "pendiente_revision" || s === "aprobada" || s === "rechazada" ? 5000 : false;
    },
  });
  const row = q.data;
  const method = row?.method ?? "nequi";
  const amount = Number(row?.amount ?? 0);
  const bonus = Number(row?.bonus ?? 0);
  const reference = row?.reference ?? "SPM-XXXX-XXXX";
  const balance = me.data?.balance ?? 0;
  const balanceText = user && me.data ? formatCOP(me.data.balance) : "—";
  // Both NEQUI and BRE-B share the same destination account number.
  const destinationAccount = "0092255552";

  const isNequi = method === "nequi";
  const brandName = isNequi ? "NEQUI" : "BRE-B";
  const brandLogo = isNequi ? nequiLogo : brebLogo;

  const [copied, setCopied] = useState<string | null>(null);
  function copy(key: string, value: string) {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  const isAlreadyConfirmed = row?.status && row.status !== "pendiente_pago";
  const isExpired = row?.status === "expirada";
  const isApproved = row?.status === "aprobada";
  const isRejected = row?.status === "rechazada";
  const isReview = row?.status === "pendiente_revision";

  useEffect(() => {
    if (row?.status === "pendiente_revision") {
      setSubmitting(false);
      setOpenPayer(false);
    }
  }, [row?.status]);

  async function submitConfirm() {
    if (!id || submitting) return;
    setSubmitting(true); setConfirmErr(null);
    try {
      const nextRow = await confirmFn({ data: {
        id, payer_self: payerSelf,
        first_name: payerSelf ? null : pFirst,
        last_name: payerSelf ? null : pLast,
        phone: payerSelf ? null : (pPhone || null),
      } });
      if (nextRow?.status === "pendiente_revision") {
        setOpenPayer(false);
      }
      setOpenPayer(false);
      q.refetch();
    } catch (e) {
      setConfirmErr((e as Error).message || "Error al confirmar");
    } finally { setSubmitting(false); }
  }

  async function submitCancel() {
    if (!id || cancelling || !confirmCancel) return;
    setCancelling(true); setCancelErr(null);
    try {
      await cancelFn({ data: { id } });
      setOpenCancel(false);
      navigate({ to: "/mis-recargas" });
    } catch (e) {
      setCancelErr((e as Error).message || "Error al cancelar");
    } finally { setCancelling(false); }
  }

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060210] text-purple-200">
        <div className="text-center">
          <p className="text-sm">Solicitud inválida.</p>
          <Link to="/pay" className="mt-3 inline-block rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase text-white">Volver</Link>
        </div>
      </div>
    );
  }
  if (q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060210] text-purple-200">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060210] px-4 text-purple-200">
        <div className="max-w-sm rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 text-center">
          <p className="text-sm font-semibold text-amber-100">No encontramos esa solicitud.</p>
          <p className="mt-2 text-xs text-amber-200/80">
            Si ya habías iniciado una recarga, entra a <b>Mis recargas</b> para retomarla o revisa si fue cancelada.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/mis-recargas" className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-100 hover:bg-amber-500/20">
              Ver mis recargas
            </Link>
            <Link to="/pay" className="rounded-md border border-purple-400/50 bg-purple-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/20">
              Volver a recargar
            </Link>
          </div>
        </div>
      </div>
    );
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
            <Link to="/pay" className="rounded-md p-2 text-white hover:bg-white/10" aria-label="Volver">
              <ArrowLeft className="h-7 w-7" strokeWidth={3} />
            </Link>
            <Link to="/">
              <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7 translate-y-px" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="text-[11px] font-bold sm:text-xs text-white">
                <span className="neon-green mr-0.5">$</span>{balanceText} COP
              </div>
            </div>
            <AuthControl />
          </div>
        </header>

        {/* Stepper */}
        <Stepper step={isApproved || isRejected ? 3 : isReview ? 3 : 1} />

        {/* Status banners */}
        {isReview && (
          <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-200">
            <p className="text-center">
              Hay un pago en <b>verificación</b> en este momento. Te notificaremos cuando sea aprobado.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Link
                to="/mis-recargas"
                className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-100 hover:bg-amber-500/20"
              >
                Ver mis recargas
              </Link>
              <button
                onClick={() => { setConfirmCancel(false); setCancelErr(null); setOpenCancel(true); }}
                className="rounded-md border border-rose-400/60 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-100 hover:bg-rose-500/20"
              >
                Cancelar solicitud
              </button>
            </div>
          </div>
        )}
        {isApproved && (
          <div className="mt-3 rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-3 text-center text-xs text-emerald-200">
            ¡Recarga <b>aprobada</b>! Tu saldo ya está disponible.
          </div>
        )}
        {isRejected && (
          <div className="mt-3 rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-center text-xs text-rose-200">
            Recarga <b>rechazada</b>. {row.reject_reason ?? ""}
          </div>
        )}
        {isExpired && (
          <div className="mt-3 rounded-xl border border-purple-400/50 bg-purple-500/10 p-3 text-center text-xs text-purple-200">
            Esta solicitud <b>expiró</b>. Genera una nueva recarga.
          </div>
        )}

        {/* Main card */}
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#160838] to-[#0a0420] shadow-[0_0_30px_-12px_rgba(168,85,247,0.5)]">
          {/* Background astronaut */}
          <img
            src={nequiAstronaut}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0420] via-[#0a0420]/75 to-transparent" />

          <div className="relative p-4">
            <img src={brandLogo} alt={brandName} className="h-8 w-auto" />
            <h1 className="mt-3 text-2xl font-extrabold leading-none tracking-tight sm:text-3xl">
              PAGO CON
              <br />
              <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                {isNequi ? "NEQUI / BRE-B" : brandName}
              </span>
            </h1>
            <p className="mt-3 max-w-[55%] text-[11px] leading-snug text-purple-200/80 sm:text-xs">
              Sigue las instrucciones para realizar tu depósito de forma{" "}
              <span className="font-semibold text-purple-300">segura.</span>
            </p>
          </div>
        </div>

        {/* Monto a enviar */}
        <Field label="MONTO A ENVIAR">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-extrabold">
                <span className="neon-green mr-1">$</span>
                <span className="neon-green">{formatCOP(amount)} COP</span>
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-purple-200/80">
                Bonus{" "}
                <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text font-bold text-transparent drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]">
                  +${formatCOP(bonus)} COP
                </span>{" "}
                🎁
              </div>
            </div>
            <div className="text-2xl">💵</div>
          </div>
        </Field>

        {/* Alias */}
        <Field label={isNequi ? "UTILIZA ENVIAR POR BRE-B:" : "NÚMERO DE CUENTA"}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-base font-bold tracking-wide text-white">
              {destinationAccount}
            </div>
            <CopyButton
              copied={copied === "alias"}
              onClick={() => copy("alias", destinationAccount)}
            />
          </div>
        </Field>

        {/* Reference */}
        <Field label="CÓDIGO DE REFERENCIA">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-sm font-bold tracking-[0.15em] text-white">
              {reference} <span className="text-purple-300/70">/ #{user ? shortId(user.id) : "00000"}</span>
            </div>
            <CopyButton copied={copied === "ref"} onClick={() => copy("ref", reference)} />
          </div>
        </Field>

        {/* Importante */}
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-purple-500/25 bg-[#0c0620] p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />
          <p className="text-[11px] leading-snug text-purple-100/85">
            <span className="font-bold text-purple-200">IMPORTANTE:</span> No es necesario adjuntar el código de referencia en el mensaje o nota del pago.
          </p>
        </div>

        {/* CTA */}
        {!isAlreadyConfirmed ? (
          <button
            onClick={() => setOpenPayer(true)}
            disabled={isExpired}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_0_24px_-6px_rgba(168,85,247,0.8)] transition hover:from-purple-500 hover:to-purple-400 disabled:opacity-50"
          >
            <CheckCircle2 className="h-5 w-5" />
            Ya envié mi pago
          </button>
        ) : isReview ? (
          <button
            disabled
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-[#0c0620] px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-purple-300/60 cursor-not-allowed"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Pago en verificación
          </button>
        ) : (
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-[#0c0620] px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-purple-200"
          >
            Volver al inicio
          </button>
        )}

        <p className="mt-3 text-center text-[10px] leading-relaxed text-purple-300/70">
          Una vez hecho el pago, vuelva inmediatamente aquí y confirme el pago.
          <br />
          Asegúrese de que su pago sea exitoso.
        </p>

        {/* Balance footer chip */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider text-purple-200/60">
          <span>Balance actual</span>
          <span className="font-bold text-white">
            <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
          </span>
        </div>
      </div>

      {openPayer && (
        <PayerModal
          onClose={() => setOpenPayer(false)}
          self={payerSelf} setSelf={setPayerSelf}
          first={pFirst} setFirst={setPFirst}
          last={pLast} setLast={setPLast}
          phone={pPhone} setPhone={setPPhone}
          onSubmit={submitConfirm}
          submitting={submitting}
          error={confirmErr}
          username={me.data?.profile?.username ?? (user?.email?.split("@")[0] ?? "Usuario")}
          userShortId={user ? shortId(user.id) : "00000"}
        />
      )}

      {openCancel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => !cancelling && setOpenCancel(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl border border-rose-500/40 bg-gradient-to-b from-[#1a0820] to-[#0a0410] p-4 shadow-[0_0_30px_rgba(244,63,94,0.35)] sm:rounded-2xl">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-base font-black uppercase tracking-widest text-white">
                Cancelar solicitud
              </h3>
              <button onClick={() => !cancelling && setOpenCancel(false)} className="rounded-md p-1 text-purple-200 hover:bg-white/5">
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
                checked={confirmCancel}
                onChange={(e) => setConfirmCancel(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-rose-400"
              />
              <span>Confirmo que <b>no he enviado</b> el pago y deseo cancelar esta solicitud.</span>
            </label>

            {cancelErr && <p className="mt-2 text-center text-xs text-rose-300">{cancelErr}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => !cancelling && setOpenCancel(false)}
                className="rounded-xl border border-purple-500/40 bg-[#0c0620] px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-purple-200 hover:bg-purple-500/10"
              >
                Volver
              </button>
              <button
                onClick={submitCancel}
                disabled={!confirmCancel || cancelling}
                className="rounded-xl bg-rose-500 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#1a0408] shadow-[0_0_24px_-6px_rgba(244,63,94,0.8)] transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-rose-900/40 disabled:text-rose-200/40"
              >
                {cancelling ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PayerModal(props: {
  onClose: () => void;
  self: boolean; setSelf: (v: boolean) => void;
  first: string; setFirst: (v: string) => void;
  last: string; setLast: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  username: string;
  userShortId: string;
}) {
  const canSubmit = props.self || (props.first.trim().length > 0 && props.last.trim().length > 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/75" onClick={() => !props.submitting && props.onClose()} />
      <div className="relative w-full max-w-md rounded-t-2xl border border-purple-500/40 bg-gradient-to-b from-[#160838] to-[#0a0420] p-4 shadow-[0_0_30px_rgba(168,85,247,0.4)] sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <h3 className="font-display text-base font-black uppercase tracking-widest text-white">
            ¿Quién realizó el pago?
          </h3>
          <button onClick={() => !props.submitting && props.onClose()} className="rounded-md p-1 text-purple-200 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Option 1 */}
        <label
          className={`mt-4 block cursor-pointer rounded-xl border p-3 transition ${
            props.self ? "border-emerald-400/70 bg-emerald-500/5 shadow-[0_0_18px_-8px_rgba(52,211,153,0.6)]" : "border-purple-500/30 bg-[#0c0620]"
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="radio" checked={props.self} onChange={() => props.setSelf(true)}
              className="h-4 w-4 accent-emerald-400"
            />
            <span className="text-sm font-bold text-white">Lo hice yo mismo</span>
          </div>
          {props.self && (
            <div className="mt-2 space-y-1 text-[11px] text-purple-200/80">
              <p>Se utilizarán los datos de tu cuenta registrada para validar el pago.</p>
              <div className="mt-2 rounded-md bg-[#150830] p-2">
                <div><span className="text-purple-300/70 uppercase tracking-wider text-[9px]">Nombre:</span> <span className="font-bold text-white">{props.username}</span></div>
                <div><span className="text-purple-300/70 uppercase tracking-wider text-[9px]">ID:</span> <span className="font-mono font-bold text-white">#{props.userShortId}</span></div>
              </div>
            </div>
          )}
        </label>

        {/* Option 2 */}
        <label
          className={`mt-2 block cursor-pointer rounded-xl border p-3 transition ${
            !props.self ? "border-emerald-400/70 bg-emerald-500/5" : "border-purple-500/30 bg-[#0c0620]"
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="radio" checked={!props.self} onChange={() => props.setSelf(false)}
              className="h-4 w-4 accent-emerald-400"
            />
            <span className="text-sm font-bold text-white">Lo realizó otra persona</span>
          </div>
          {!props.self && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-purple-200/80">
                Utiliza esta opción si el pago fue realizado desde una cuenta diferente a la del titular registrado.
              </p>
              <input
                value={props.first} onChange={(e) => props.setFirst(e.target.value)}
                placeholder="Nombres" maxLength={80}
                className="w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 text-sm text-white placeholder:text-purple-300/40 focus:border-fuchsia-400 focus:outline-none"
              />
              <input
                value={props.last} onChange={(e) => props.setLast(e.target.value)}
                placeholder="Apellidos" maxLength={80}
                className="w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 text-sm text-white placeholder:text-purple-300/40 focus:border-fuchsia-400 focus:outline-none"
              />
              <input
                value={props.phone} onChange={(e) => props.setPhone(e.target.value.replace(/[^0-9+ ]/g, ""))}
                placeholder="Teléfono desde el que realizó el pago (opcional)" maxLength={30} inputMode="tel"
                className="w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 text-sm text-white placeholder:text-purple-300/40 focus:border-fuchsia-400 focus:outline-none"
              />
            </div>
          )}
        </label>

        {props.error && <p className="mt-2 text-center text-xs text-rose-300">{props.error}</p>}

        <button
          onClick={props.onSubmit}
          disabled={!canSubmit || props.submitting}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-[#04130c] shadow-[0_0_24px_-6px_rgba(52,211,153,0.8)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900/40 disabled:text-emerald-200/40"
        >
          {props.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Confirmar pago enviado
        </button>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: "INSTRUCCIONES" },
    { n: 2, label: "ENVÍA EL PAGO" },
    { n: 3, label: "ESPERA CONFIRMACIÓN" },
  ];
  return (
    <div className="mt-4 flex items-start justify-between gap-1">
      {items.map((it, i) => {
        const active = it.n === step;
        const done = it.n < step;
        return (
          <div key={it.n} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className={`h-px flex-1 ${i === 0 ? "opacity-0" : done ? "bg-purple-400" : "bg-purple-500/20"}`} />
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-purple-500 text-white shadow-[0_0_18px_-4px_rgba(168,85,247,0.9)]"
                    : done
                    ? "bg-purple-700/60 text-white"
                    : "border border-purple-500/30 bg-[#0c0620] text-purple-300/60"
                }`}
              >
                {it.n}
              </div>
              <div className={`h-px flex-1 ${i === items.length - 1 ? "opacity-0" : "bg-purple-500/20"}`} />
            </div>
            <div className={`mt-1.5 text-center text-[8.5px] font-bold uppercase tracking-wider ${active ? "text-white" : "text-purple-300/50"}`}>
              {it.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-purple-500/25 bg-[#0c0620] p-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300/80">
        {label}
      </div>
      {children}
    </div>
  );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-purple-900/50 transition hover:bg-purple-500"
    >
      {copied ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}