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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  initial?: PersonalDataInitial;
  onSaved?: () => void;
  title?: string;
  subtitle?: string;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="dark fixed inset-0 z-[130] overflow-hidden" role="dialog" aria-modal="true" style={{ colorScheme: "dark" }}>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto px-4 py-6">
        <div className="relative box-border w-full max-w-md rounded-lg border border-purple-500/40 bg-[#0c0620] p-4 text-white shadow-2xl sm:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-3 text-purple-200/80 hover:text-white"
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
              onSaved={() => {
                onSaved?.();
                onOpenChange(false);
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}