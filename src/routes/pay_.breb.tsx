import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Settings, Copy, Check, Info, CheckCircle2 } from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import nequiAstronaut from "@/assets/nequi-astronaut-wide.png";
import nequiLogo from "@/assets/nequi.svg";
import brebLogo from "@/assets/bre-b.svg";

type Method = "nequi" | "breb";

export const Route = createFileRoute("/pay_/breb")({
  validateSearch: (search: Record<string, unknown>) => {
    const m = search.method === "nequi" || search.method === "breb" ? (search.method as Method) : "nequi";
    const amount = Number(search.amount) || 20000;
    const bonus = Number(search.bonus) || 5000;
    return { method: m, amount, bonus };
  },
  head: () => ({
    meta: [
      { title: "Confirmar pago — BetSpaceman" },
      { name: "description", content: "Sigue las instrucciones para completar tu depósito de forma segura." },
    ],
  }),
  component: PayBrebPage,
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function genReference() {
  const part = () =>
    Math.random().toString(36).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4).padEnd(4, "X");
  return `SPM-${part()}-${part()}`;
}

function PayBrebPage() {
  const navigate = useNavigate();
  const { method, amount, bonus } = Route.useSearch();
  const [balance] = useState(100000);
  const [reference, setReference] = useState("SPM-XXXX-XXXX");
  useEffect(() => { setReference(genReference()); }, []);
  const brebAlias = "@spaceman.breb";

  const isNequi = method === "nequi";
  const brandName = isNequi ? "NEQUI" : "BRE-B";
  const brandLogo = isNequi ? nequiLogo : brebLogo;

  const [copied, setCopied] = useState<string | null>(null);
  function copy(key: string, value: string) {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  return (
    <div className="min-h-screen bg-[#060210] text-white font-pay">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-10 pt-4 sm:max-w-lg sm:px-4">
        {/* Header */}
        <header
          className="flex items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-1">
            <Link
              to="/pay"
              className="rounded-md p-2 text-white hover:bg-white/10"
              aria-label="Volver"
            >
              <ArrowLeft className="h-7 w-7" strokeWidth={3} />
            </Link>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/80">
              Pago <span className="text-purple-400/60">|</span> Depósito
            </div>
          </div>
          <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
            <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </header>

        <div className="mt-3 flex justify-center">
          <Link to="/home">
            <img src={betspaceLogo} alt="BETSPACEMAN" className="h-6 w-auto sm:h-7" />
          </Link>
        </div>

        {/* Stepper */}
        <Stepper step={1} />

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
                {brandName}
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
        <Field label={isNequi ? "NEQUI" : "BRE-B"}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-base font-bold tracking-wide text-white">
              {isNequi ? "3001234567" : brebAlias}
            </div>
            <CopyButton
              copied={copied === "alias"}
              onClick={() => copy("alias", isNequi ? "3001234567" : brebAlias)}
            />
          </div>
        </Field>

        {/* Reference */}
        <Field label="CÓDIGO DE REFERENCIA">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-base font-bold tracking-[0.15em] text-white">
              {reference}
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
        <button
          onClick={() => navigate({ to: "/pay" })}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_0_24px_-6px_rgba(168,85,247,0.8)] transition hover:from-purple-500 hover:to-purple-400"
        >
          <CheckCircle2 className="h-5 w-5" />
          Ya envié mi pago
        </button>

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