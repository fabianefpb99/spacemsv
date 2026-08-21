import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck, Wallet, UserCircle, ArrowRight } from "lucide-react";

export function PostSignupDataPrompt({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="auth-scope fixed inset-0 z-[135] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Completar datos personales"
    >
      <div
        className="auth-backdrop absolute inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        className="auth-modal-scroll relative flex min-h-dvh w-full items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6"
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="auth-panel data-prompt-panel relative box-border w-full max-w-[380px] rounded-[22px] p-5 sm:p-6 animate-scale-in">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="auth-close absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Premium icon cluster */}
          <div className="relative mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center">
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/20 blur-md" />
            <span className="absolute inset-0 rounded-2xl border border-purple-400/25 bg-purple-900/20 backdrop-blur-sm" />
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="relative z-10 h-10 w-10"
              aria-hidden="true"
            >
              {/* Casino chip outer ring with segments */}
              <circle cx="24" cy="24" r="17" stroke="url(#chip-gradient)" strokeWidth="2.2" strokeDasharray="5 3" className="text-purple-300" />
              <circle cx="24" cy="24" r="13.5" stroke="currentColor" strokeWidth="1.2" className="text-purple-300/40" />
              {/* User silhouette */}
              <path
                d="M24 13c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5z"
                fill="url(#user-gradient)"
              />
              <path
                d="M15 34.5c0-4.5 4-8 9-8s9 3.5 9 8"
                stroke="url(#user-gradient)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {/* Small slot/dice sparkle accents */}
              <path
                d="M37 10l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.3-1.2-2.3 1.2.5-2.6-1.9-1.8 2.6-.4z"
                fill="url(#sparkle-gradient)"
              />
              <circle cx="11" cy="16" r="2" fill="url(#sparkle-gradient)" />
              <path
                d="M9 36l1.5-1.5M9 36l-1.5-1.5M9 36v2.2"
                stroke="url(#sparkle-gradient)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="chip-gradient" x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#e879f9" />
                </linearGradient>
                <linearGradient id="user-gradient" x1="14" y1="12" x2="34" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#e9d5ff" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
                <linearGradient id="sparkle-gradient" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f0abfc" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="text-center">
            <h2 className="auth-headline font-display text-[19px] font-extrabold leading-[1.02] sm:text-[21px]">
              ¿Completas tus datos?
            </h2>
            <p className="auth-sub mx-auto mt-1.5 max-w-[300px] text-[12.5px] leading-snug">
              Un minuto. Necesario para verificar tu identidad y retirar ganancias.
            </p>
          </div>

          <div className="mt-4 space-y-2 rounded-2xl border border-purple-500/15 bg-purple-500/[0.06] p-3.5">
            <BenefitRow
              icon={<ShieldCheck className="h-4 w-4" />}
              text="Verificación segura"
            />
            <BenefitRow
              icon={<Wallet className="h-4 w-4" />}
              text="Retiros sin demoras"
            />
            <BenefitRow
              icon={<UserCircle className="h-4 w-4" />}
              text="Perfil protegido"
            />
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onConfirm()}
              className="auth-cta flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold tracking-wide"
            >
              Sí, completar
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="auth-secondary flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-semibold tracking-wide"
            >
              No, quiero jugar ahora
            </button>
          </div>

          <p className="auth-legal mt-3 text-center text-[11px] leading-snug">
            También lo encontrarás en{" "}
            <span className="auth-switch-link font-semibold">Perfil</span>.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BenefitRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-left">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-purple-400/20 bg-purple-500/10 text-purple-200">
        {icon}
      </span>
      <span className="auth-sub text-[12.5px]">{text}</span>
    </div>
  );
}
