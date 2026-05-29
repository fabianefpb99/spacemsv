import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Settings, Check, CreditCard, ChevronDown } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "Recargar saldo — BetSpaceman" },
      { name: "description", content: "Recarga tu saldo en BetSpaceman con Nequi, Daviplata, Bancolombia o tarjeta de débito." },
      { property: "og:title", content: "Recargar saldo — BetSpaceman" },
      { property: "og:description", content: "Recarga tu saldo en BetSpaceman con Nequi, Daviplata, Bancolombia o tarjeta de débito." },
    ],
  }),
  component: PayPage,
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

type Method = "nequi" | "daviplata" | "bancolombia" | "card";

const COMBOS = [
  { id: "c1", amount: 25000, bonus: 5000, tag: "BÁSICO", tagCls: "bg-purple-600/30 text-purple-200 border-purple-500/40" },
  { id: "c2", amount: 50000, bonus: 10000, tag: "POPULAR", tagCls: "bg-emerald-600/30 text-emerald-200 border-emerald-500/40" },
  { id: "c3", amount: 100000, bonus: 25000, tag: "MEJOR VALOR", tagCls: "bg-amber-600/30 text-amber-200 border-amber-500/40" },
  { id: "c4", amount: 200000, bonus: 60000, tag: "VIP", tagCls: "bg-pink-600/30 text-pink-200 border-pink-500/40" },
];

function PayPage() {
  const navigate = useNavigate();
  const [balance] = useState(100000);
  const [method, setMethod] = useState<Method | null>(null);
  const [combo, setCombo] = useState<string | null>(null);

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [savedCard, setSavedCard] = useState<{ last4: string; name: string } | null>(null);

  const cardReady = method !== "card" || savedCard !== null;
  const canContinue = method !== null && combo !== null && cardReady;

  function handleSaveCard() {
    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 12) return;
    setSavedCard({ last4: digits.slice(-4), name: cardName || "Titular" });
    setCardNumber("");
    setCardName("");
    setCardExp("");
    setCardCvv("");
  }

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-10 pt-4 sm:max-w-lg sm:px-4">
        {/* Header — same as Home */}
        <header
          className="flex items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <button
            onClick={() => navigate({ to: "/home" })}
            className="rounded-md p-2 text-white hover:bg-white/10"
            aria-label="Volver"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={3} />
          </button>
          <Link to="/home">
            <h1 className="font-display text-sm font-black leading-tight tracking-widest sm:text-base">
              BETSPACEMAN
            </h1>
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="font-display text-xs font-bold sm:text-sm text-white">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </header>

        {/* Title */}
        <h2 className="mt-5 text-center font-display text-xl font-black uppercase tracking-widest text-white sm:text-2xl">
          Recargar saldo
        </h2>

        {/* Current balance pill */}
        <div className="mt-4 rounded-2xl border border-purple-500/30 bg-[#0c0620] px-4 py-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-purple-200/70">Saldo actual</div>
          <div className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            <span className="neon-green mr-1">$</span>
            <span className="neon-green">{formatCOP(balance)} COP</span>
          </div>
        </div>

        {/* Step 1: payment method */}
        <h3 className="mt-6 font-display text-sm font-bold uppercase tracking-widest text-white">
          1. Selecciona tu medio de pago
        </h3>
        <div className="mt-3 flex flex-col gap-2.5">
          <MethodCard
            selected={method === "nequi"}
            onClick={() => setMethod("nequi")}
            logo={<NequiLogo />}
            title="NEQUI"
            subtitle="Pago instantáneo"
          />
          <MethodCard
            selected={method === "daviplata"}
            onClick={() => setMethod("daviplata")}
            logo={<DaviplataLogo />}
            title="DAVIPLATA"
            subtitle="Pago instantáneo"
          />
          <MethodCard
            selected={method === "bancolombia"}
            onClick={() => setMethod("bancolombia")}
            logo={<BancolombiaLogo />}
            title="BANCOLOMBIA (PSE)"
            subtitle="Transferencia PSE"
          />
          <MethodCard
            selected={method === "card"}
            onClick={() => setMethod("card")}
            logo={<CardLogo />}
            title="TARJETA DE DÉBITO"
            subtitle="Visa, Mastercard, Débito"
            expandable
          >
            {method === "card" && (
              <div className="mt-3 rounded-xl border border-purple-500/30 bg-[#0a0420] p-3">
                {savedCard ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-12 items-center justify-center rounded-md bg-gradient-to-br from-purple-700 to-purple-900 ring-1 ring-purple-400/40">
                        <CreditCard className="h-4 w-4 text-purple-100" />
                      </div>
                      <div>
                        <div className="font-mono text-sm tracking-widest text-white">
                          ********{savedCard.last4}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-purple-200/70">
                          {savedCard.name} · Modo seguro
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/50">
                        <Check className="h-4 w-4 text-emerald-300" strokeWidth={3} />
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSavedCard(null); }}
                        className="text-[10px] font-semibold uppercase tracking-wider text-purple-300 hover:text-purple-200"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5" onClick={(e) => e.stopPropagation()}>
                    <label className="text-[10px] uppercase tracking-widest text-purple-200/70">
                      Número de tarjeta
                      <input
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="0000 0000 0000 0000"
                        value={cardNumber}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 19);
                          setCardNumber(v.replace(/(.{4})/g, "$1 ").trim());
                        }}
                        className="mt-1 w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 font-mono text-sm tracking-widest text-white placeholder:text-purple-300/30 focus:border-purple-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-widest text-purple-200/70">
                      Nombre del titular
                      <input
                        autoComplete="cc-name"
                        placeholder="Como aparece en la tarjeta"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value.toUpperCase())}
                        className="mt-1 w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 text-sm text-white placeholder:text-purple-300/30 focus:border-purple-400 focus:outline-none"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-purple-200/70">
                        Vencimiento
                        <input
                          inputMode="numeric"
                          placeholder="MM/AA"
                          value={cardExp}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setCardExp(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
                          }}
                          className="mt-1 w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 font-mono text-sm tracking-widest text-white placeholder:text-purple-300/30 focus:border-purple-400 focus:outline-none"
                        />
                      </label>
                      <label className="text-[10px] uppercase tracking-widest text-purple-200/70">
                        CVV
                        <input
                          inputMode="numeric"
                          placeholder="123"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="mt-1 w-full rounded-md border border-purple-500/30 bg-[#150830] px-3 py-2 font-mono text-sm tracking-widest text-white placeholder:text-purple-300/30 focus:border-purple-400 focus:outline-none"
                        />
                      </label>
                    </div>
                    <button
                      onClick={handleSaveCard}
                      disabled={cardNumber.replace(/\D/g, "").length < 12}
                      className="mt-1 inline-flex items-center justify-center rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/50 transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-purple-600/30 disabled:text-purple-200/40 disabled:shadow-none"
                    >
                      Guardar tarjeta
                    </button>
                    <p className="text-center text-[9px] uppercase tracking-wider text-purple-300/60">
                      Se almacenará en modo seguro
                    </p>
                  </div>
                )}
              </div>
            )}
          </MethodCard>
        </div>

        {/* Step 2: combos */}
        <h3 className="mt-6 font-display text-sm font-bold uppercase tracking-widest text-white">
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
                    ? "border-emerald-400/70 ring-1 ring-emerald-400/40 shadow-[0_0_20px_-8px_rgba(52,211,153,0.6)]"
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
                    <div className="font-display text-base font-bold">
                      <span className="neon-green mr-1">$</span>
                      <span className="text-white">{formatCOP(c.amount)} COP</span>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${c.tagCls}`}>
                      {c.tag}
                    </span>
                  </div>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-300">
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
                      <div className="font-display text-sm font-bold">
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
          disabled={!canContinue}
          className={`mt-6 inline-flex items-center justify-center rounded-xl px-4 py-3.5 font-display text-sm font-black uppercase tracking-widest transition ${
            canContinue
              ? "bg-emerald-500 text-[#04130c] shadow-[0_0_24px_-6px_rgba(52,211,153,0.8)] hover:bg-emerald-400"
              : "cursor-not-allowed bg-emerald-900/40 text-emerald-200/40 ring-1 ring-emerald-700/40"
          }`}
        >
          Continuar al pago
        </button>

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
  logo,
  title,
  subtitle,
  expandable,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  logo: React.ReactNode;
  title: string;
  subtitle: string;
  expandable?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border bg-[#0c0620] p-3 transition ${
        selected
          ? "border-emerald-400/70 ring-1 ring-emerald-400/40 shadow-[0_0_20px_-8px_rgba(52,211,153,0.6)]"
          : "border-purple-500/25 hover:border-purple-400/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#150830] ring-1 ring-purple-500/20">
          {logo}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-bold tracking-wider text-white">{title}</div>
          <div className="text-[11px] text-purple-200/70">{subtitle}</div>
        </div>
        {expandable ? (
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
    <svg viewBox="0 0 40 40" className="h-8 w-8">
      <defs>
        <linearGradient id="nequiGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff2d87" />
          <stop offset="50%" stopColor="#c2185b" />
          <stop offset="100%" stopColor="#3d0a8a" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#nequiGrad)" />
      <circle cx="20" cy="20" r="6.5" fill="none" stroke="#fff" strokeWidth="2.4" />
      <circle cx="20" cy="9.5" r="2.2" fill="#fff" />
      <circle cx="20" cy="30.5" r="2.2" fill="#fff" />
      <circle cx="9.5" cy="20" r="2.2" fill="#fff" />
      <circle cx="30.5" cy="20" r="2.2" fill="#fff" />
    </svg>
  );
}

function DaviplataLogo() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8">
      <rect width="40" height="40" rx="8" fill="#fff" />
      {/* Stylized red elephant silhouette */}
      <path
        d="M9 24c0-5 4-9 9-9 3 0 5 1 7 3l3-2c1 0 2 1 2 2l-1 3 2 1c1 1 0 3-1 3l-3 0-1 3c0 1-1 2-2 2h-2v-3h-3v3h-3v-3c-3 0-6-1-7-3z"
        fill="#e30613"
      />
      <circle cx="15" cy="20" r="1.3" fill="#fff" />
    </svg>
  );
}

function BancolombiaLogo() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8">
      <rect width="40" height="40" rx="6" fill="#1a1a1a" />
      {/* Yellow stylized brand mark */}
      <path d="M8 28 L20 8 L32 28 Z" fill="#ffd100" />
      <path d="M14 28 L20 18 L26 28 Z" fill="#1a1a1a" />
      <rect x="8" y="28" width="24" height="3" fill="#ffd100" />
    </svg>
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