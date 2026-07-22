import { useEffect } from "react";
import { createPortal } from "react-dom";
import { PersonalDataForm, type PersonalDataInitial } from "./PersonalDataForm";

export function PersonalDataDialog({
  open,
  onOpenChange,
  userId,
  initial,
  onSaved,
  title = "Completa tus datos",
  subtitle = "Necesitamos esta información para verificar tu cuenta.",
  submitLabel = "Guardar",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  initial?: PersonalDataInitial;
  onSaved?: () => void;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    document.body.style.overflow = "hidden";
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
      className="personal-data-dialog fixed inset-0 z-[130] overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        className="personal-data-dialog-scroll relative h-dvh w-full overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        <div
          className="flex min-h-full w-full items-center justify-center px-4 sm:px-6"
          style={{
            paddingTop: "max(1.25rem, calc(env(safe-area-inset-top) + 1rem))",
            paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 1.25rem))",
          }}
        >
        <div className="personal-data-dialog-panel relative box-border w-full max-w-md rounded-2xl border border-purple-500/40 bg-[#0c0620] p-5 text-white shadow-2xl sm:p-6 mx-auto animate-scale-in">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full text-purple-200/80 hover:text-white"
          >
            ×
          </button>
          <div className="pr-8">
            <h2 className="font-display text-xl font-black tracking-wide">{title}</h2>
            <p className="mt-1 text-xs text-purple-200/70">{subtitle}</p>
          </div>
          <div className="mt-4">
            <PersonalDataForm
              userId={userId}
              initial={initial}
              submitLabel={submitLabel}
              onSaved={() => {
                onSaved?.();
                onOpenChange(false);
              }}
            />
          </div>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}