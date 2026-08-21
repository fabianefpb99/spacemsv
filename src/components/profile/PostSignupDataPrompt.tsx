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
        <div className="auth-panel data-prompt-panel relative box-border w-full max-w-[420px] rounded-[24px] p-6 sm:p-8 animate-scale-in">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="auth-close absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Premium icon cluster */}
          <div className="relative mx-auto mb-5 flex h-[88px] w-[88px] items-center justify-center">
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/20 blur-md" />
            <span className="absolute inset-0 rounded-2xl border border-purple-400/25 bg-purple-900/20 backdrop-blur-sm" />
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="relative z-10 h-11 w-11"
              aria-hidden="true"
            >
              <circle cx="24" cy="16" r="7" stroke="currentColor" strokeWidth="2" className="text-purple-200" />
              <path
                d="M10 42c0-7.732 6.268-14 14-14s14 6.268 14 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-purple-200"
              />
              <path
                d="M36 20l4 4-8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-fuchsia-300"
              />
            </svg>
          </div>

          <div className="text-center">
            <h2 className="auth-headline font-display text-[22px] font-extrabold leading-tight sm:text-[24px]">
              ¿Quieres completar tus datos ahora mismo?
            </h2>
            <p className="auth-sub mx-auto mt-2 max-w-[320px] text-[13px] leading-relaxed">
              Solo te tomará un minuto. Esta información será necesaria para verificar tu identidad y procesar futuros retiros.
            </p>
          </div>

          <div className="mt-5 space-y-2.5 rounded-2xl border border-purple-500/15 bg-purple-500/[0.06] p-4">
            <BenefitRow
              icon={<ShieldCheck className="h-4 w-4" />}
              text="Verificación de identidad segura"
            />
            <BenefitRow
              icon={<Wallet className="h-4 w-4" />}
              text="Retiros rápidos sin demoras"
            />
            <BenefitRow
              icon={<UserCircle className="h-4 w-4" />}
              text="Perfil protegido y completo"
            />
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onConfirm()}
              className="auth-cta flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold tracking-wide"
            >
              Sí, completar ahora
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="auth-skip h-11 w-full rounded-xl text-[13px] font-semibold tracking-wide transition-colors"
            >
              Ahora no
            </button>
          </div>

          <p className="auth-legal mt-4 text-center text-[11px] leading-snug">
            Puedes completar tus datos más tarde desde{" "}
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
    <div className="flex items-center gap-3 text-left">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-400/20 bg-purple-500/10 text-purple-200">
        {icon}
      </span>
      <span className="auth-sub text-[13px]">{text}</span>
    </div>
  );
}
