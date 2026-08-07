import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import nequiLogo from "@/assets/nequi.svg";
import bancolombiaLogo from "@/assets/bancolombia.svg";
import brebLogo from "@/assets/bre-b.svg";
import { useServerFn } from "@tanstack/react-start";
import { createDeposit, getMyPendingReview } from "@/lib/deposits/deposit.functions";
import { useQuery } from "@tanstack/react-query";
import { AuthControl } from "@/components/auth/AuthControl";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useMe } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "Recargar Saldo Nequi y Bancolombia | BETSPACE Casino" },
      { name: "description", content: "Recarga tu saldo en BETSPACE Casino con Nequi o Bre-B de forma rápida y segura." },
      { property: "og:title", content: "Recargar Saldo Nequi y Bancolombia | BETSPACE Casino" },
      { property: "og:description", content: "Recarga tu saldo en BETSPACE Casino con Nequi o Bre-B de forma rápida y segura." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PayPageGated,
});

function PayPageGated() {
  return (
    <RequireAuth>
      <PayPage />
    </RequireAuth>
  );
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

type Method = "nequi" | "breb" | "bancolombia" | "card";

const COMBOS = [
  { id: "c1", amount: 25000, bonus: 2000, tag: "BÁSICO", tagCls: "bg-purple-600/30 text-purple-200 border-purple-500/40" },
  { id: "c2", amount: 50000, bonus: 5000, tag: "POPULAR", tagCls: "bg-emerald-600/30 text-emerald-200 border-emerald-500/40" },
  { id: "c3", amount: 100000, bonus: 10000, tag: "MEJOR VALOR", tagCls: "bg-amber-600/30 text-amber-200 border-amber-500/40" },
  { id: "c4", amount: 200000, bonus: 20000, tag: "VIP", tagCls: "bg-pink-600/30 text-pink-200 border-pink-500/40" },
];

function PayPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = useMe();
  const balanceText = user && me.data ? formatCOP(me.data.balance) : "—";
  const [method, setMethod] = useState<Method | null>(null);
  const [combo, setCombo] = useState<string | null>(null);
  const createFn = useServerFn(createDeposit);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const pendingFn = useServerFn(getMyPendingReview);
  const pendingQ = useQuery({
    queryKey: ["my-pending-review"],
    queryFn: () => pendingFn(),
    refetchInterval: 10000,
    enabled: !!user,
  });
  const pendingReview = pendingQ.data as { id: string; method: string } | null | undefined;
  const blocked = !!pendingReview;

  useEffect(() => {
    if (pendingReview?.id) {
      setSubmitting(false);
    }
  }, [pendingReview?.id]);

  // Bonus countdown: 10 minutes, restarts every time PAY is opened, and
  // auto-restarts when it hits 00:00 (psychological urgency).
  const BONUS_MS = 10 * 60 * 1000;
  const [bonusLeft, setBonusLeft] = useState(BONUS_MS);
  const bonusDeadlineRef = useRef<number>(0);
  useEffect(() => {
    bonusDeadlineRef.current = Date.now() + BONUS_MS;
    setBonusLeft(BONUS_MS);
  }, []);
  useVisibleInterval(() => {
    let left = bonusDeadlineRef.current - Date.now();
    if (left <= 0) {
      bonusDeadlineRef.current = Date.now() + BONUS_MS;
      left = BONUS_MS;
    }
    setBonusLeft(left);
  }, 1000);
  const bonusMin = Math.floor(bonusLeft / 60000);
  const bonusSec = Math.floor((bonusLeft % 60000) / 1000);
  const bonusLabel = `${String(bonusMin).padStart(2, "0")}:${String(bonusSec).padStart(2, "0")}`;

  const canContinue = method !== null && combo !== null;

  return (
    <div className="theme-dark-fixed min-h-screen bg-[#060210] text-white font-pay">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-10 pt-4 sm:max-w-lg sm:px-4">
        {/* Header — same as Home */}
        <header
          className="flex items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate({ to: "/" })}
              className="rounded-md p-2 text-white hover:bg-white/10"
              aria-label="Volver"
            >
              <ArrowLeft className="h-7 w-7" strokeWidth={3} />
            </button>
            <Link to="/">
              <img
                src={betspaceLogo}
                alt="BETSPACE"
                className="h-6 w-auto sm:h-7 translate-y-px"
              />
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

        {/* Title */}
        <div className="mt-5 flex flex-col items-center">
          <h2 className="text-center text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Recargar saldo
          </h2>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-[#0c0620] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_0_18px_-8px_rgba(168,85,247,0.7)] sm:text-xs">
            <span className="text-purple-100/90">
              Tiempo para aprovechar{" "}
              <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text font-bold uppercase tracking-wide text-transparent drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]">
                bonus
              </span>
            </span>
            <span className="text-purple-300/60">|</span>
            <span className="font-mono tabular-nums text-emerald-300">{bonusLabel}</span>
          </div>
          <div className="mt-1 animate-bounce-slow -mb-2">
            <svg viewBox="0 0 64 20" className="h-4 w-12 text-emerald-400/90" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="4,4 32,16 60,4" />
            </svg>
          </div>
        </div>

        {/* Step 1: payment method */}
        <h3 className="mt-6 text-sm font-semibold text-white">
          1. Selecciona tu medio de pago
        </h3>
        {blocked && (
          <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p className="text-center">
              Tienes un pago en <b>verificación</b>. Espera la confirmación antes de iniciar otro.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => navigate({ to: "/pay/breb", search: { id: pendingReview!.id } })}
                className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-100 hover:bg-amber-500/20"
              >
                Ver mi solicitud
              </button>
              <Link
                to="/mis-recargas"
                className="rounded-md border border-purple-400/50 bg-purple-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/20"
              >
                Ver mis recargas
              </Link>
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2.5">
          <MethodCard
            selected={method === "nequi"}
            disabled={blocked}
            onClick={() => !blocked && setMethod("nequi")}
            logo={<NequiLogo />}
            title="NEQUI"
            subtitle="Pago instantáneo"
          />
          <MethodCard
            selected={method === "breb"}
            disabled={blocked}
            onClick={() => !blocked && setMethod("breb")}
            logo={<BrebLogo />}
            title="BRE-B"
            subtitle="Pago instantáneo interbancario"
          />
          <MethodCard
            disabled
            selected={false}
            onClick={() => {}}
            logo={<BancolombiaLogo />}
            title="BANCOLOMBIA (PSE)"
            subtitle="No disponible"
          />
          <MethodCard
            disabled
            selected={false}
            onClick={() => {}}
            logo={<CardLogo />}
            title="TARJETA DE DÉBITO"
            subtitle="No disponible"
          />
        </div>

        {/* Step 2: combos */}
        <h3 className="mt-6 text-sm font-semibold text-white">
          2. Selecciona el monto
        </h3>
        <div className="mt-3 flex flex-col gap-2.5">
          {COMBOS.map((c) => {
            const selected = combo === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCombo(c.id)}
                className={`flex items-center gap-3 rounded-xl border bg-[#0c0620] p-3 text-left transition ${
                  selected
                    ? "border-emerald-400/80 ring-2 ring-emerald-400/60 shadow-[0_0_22px_-6px_rgba(52,211,153,0.55)]"
                    : "border-purple-500/25 hover:border-purple-400/50"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? "border-emerald-400 bg-emerald-400/20" : "border-purple-400/50"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-emerald-300" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[17px] font-bold leading-tight sm:text-lg">
                      <span className="neon-green mr-1">$</span>
                      <span className="text-white">{formatCOP(c.amount)} COP</span>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${c.tagCls}`}>
                      {c.tag}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold leading-tight text-emerald-300">
                        + ${formatCOP(c.bonus)} COP
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-purple-200/60">
                        Saldo promocional
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-purple-200/60">
                        Recibes en total
                      </div>
                      <div className="text-sm font-bold leading-tight">
                        <span className="neon-green mr-0.5">$</span>
                        <span className="neon-green">{formatCOP(c.amount + c.bonus)} COP</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue button */}
        <button
          disabled={!canContinue || submitting || blocked}
          onClick={async () => {
            if (!canContinue || !combo || !method || blocked) return;
            const c = COMBOS.find((x) => x.id === combo)!;
            if (method === "nequi" || method === "breb") {
              setSubmitting(true); setErrMsg(null);
              try {
                const row = await createFn({ data: { amount: c.amount, bonus: c.bonus, method } });
                navigate({ to: "/pay/breb", search: { id: row.id } });
              } catch (e) {
                const msg = (e as Error).message || "Error al crear la recarga";
                if (msg.includes("has_pending_review")) {
                  setErrMsg("Tienes un pago en verificación. Espera la confirmación antes de iniciar otro.");
                  pendingQ.refetch();
                } else if (msg.includes("duplicate") || msg.includes("multiple") || msg.includes("JSON object requested")) {
                  setErrMsg("Ya tienes una solicitud abierta. Te llevaremos a esa recarga para continuar.");
                  pendingQ.refetch();
                } else setErrMsg(msg);
              } finally { setSubmitting(false); }
            }
          }}
          className={`mt-6 inline-flex items-center justify-center rounded-xl px-4 py-3.5 text-sm font-bold tracking-tight transition ${
            canContinue && !blocked
              ? "bg-emerald-500 text-[#04130c] shadow-[0_0_24px_-6px_rgba(52,211,153,0.8)] hover:bg-emerald-400"
              : "cursor-not-allowed bg-emerald-900/40 text-emerald-200/40 ring-1 ring-emerald-700/40"
          }`}
        >
          {submitting ? "Generando..." : "Continuar al pago"}
        </button>
        {errMsg && <p className="mt-2 text-center text-xs text-rose-300">{errMsg}</p>}

        <p className="mt-3 text-center text-[10px] uppercase tracking-wider text-purple-300/50">
          Pago 100% seguro · Procesado por pasarela certificada
        </p>
      </div>
    </div>
  );
}

function MethodCard({
  selected,
  onClick,
  disabled,
  logo,
  title,
  subtitle,
  expandable,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  logo: React.ReactNode;
  title: string;
  subtitle: string;
  expandable?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`relative rounded-xl border bg-[#0c0620] p-3 transition ${
        disabled
          ? "border-purple-500/15 opacity-60 cursor-not-allowed"
          : selected
            ? "border-emerald-400/80 ring-2 ring-emerald-400/60 shadow-[0_0_22px_-6px_rgba(52,211,153,0.55)] cursor-pointer"
            : "border-purple-500/25 hover:border-purple-400/50 cursor-pointer"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#150830] ring-1 ring-purple-500/20">
          {logo}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="text-[11px] text-purple-200/70">{subtitle}</div>
        </div>
        {disabled ? (
          <span className="shrink-0 rounded-full border border-purple-500/30 bg-purple-900/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-200/70">
            Próximamente
          </span>
        ) : expandable ? (
          <ChevronDown
            className={`h-5 w-5 text-purple-300/70 transition-transform ${selected ? "rotate-180" : ""}`}
          />
        ) : (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              selected ? "border-emerald-400 bg-emerald-400" : "border-purple-400/50"
            }`}
          >
            {selected && <Check className="h-3 w-3 text-[#04130c]" strokeWidth={4} />}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ============ Brand-faithful SVG logos (recreated) ============ */

function NequiLogo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
      <img src={nequiLogo} alt="Nequi" className="h-7 w-7 object-contain" />
    </div>
  );
}

function BrebLogo() {
  return (
    <img src={brebLogo} alt="BRE-B" className="h-8 w-8 object-contain" />
  );
}

function BancolombiaLogo() {
  return (
    <img src={bancolombiaLogo} alt="Bancolombia" className="h-9 w-9 object-contain" />
  );
}

function CardLogo() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8">
      <rect x="4" y="9" width="32" height="22" rx="4" fill="#a78bfa" />
      <rect x="4" y="14" width="32" height="4" fill="#1a0b3a" />
      <rect x="8" y="23" width="10" height="3" rx="1" fill="#1a0b3a" />
      <rect x="22" y="23" width="10" height="3" rx="1" fill="#c4b5fd" />
    </svg>
  );
}