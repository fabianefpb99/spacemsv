import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, Wallet, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import betspaceLogo from "@/assets/betspace-logo.svg";

/**
 * Slim in-game drawer: only Depósito + Salir del juego.
 * Always dark (uses `theme-dark-fixed`), so it inherits no light-mode overrides.
 */
export function GameMenuDrawer() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    const prevTouch = body.style.touchAction;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.touchAction = "none";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
      body.style.touchAction = prevTouch;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Menú del juego"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-white hover:bg-white/10"
      >
        <Menu className="h-7 w-7" strokeWidth={3} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Menú del juego"
            >
              <button
                type="button"
                aria-label="Cerrar menú"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-200"
                onClick={() => setOpen(false)}
              />
              <aside
                className="theme-dark-fixed absolute inset-y-0 left-0 flex h-full w-[78vw] max-w-[300px] animate-in slide-in-from-left duration-300 flex-col border-r border-purple-500/20 bg-[#0a0418] text-white"
                style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
              >
                <div className="flex items-center justify-between pl-6 pr-4 pb-3">
                  <Link
                    to="/home"
                    onClick={() => setOpen(false)}
                    className="logo-shine"
                    aria-label="Inicio"
                  >
                    <img src={betspaceLogo} alt="BETSPACE" className="h-5 w-auto" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar"
                    className="rounded-md p-1.5 text-white/80 hover:bg-white/10"
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>

                <div className="mx-4 h-px bg-purple-500/15" />

                <nav className="mt-3 flex flex-1 flex-col gap-2 px-4">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: "/pay" });
                    }}
                    className="group flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 px-3 py-3 text-left transition hover:border-emerald-400/60 hover:from-emerald-500/25"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-200">
                      <Wallet className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-bold uppercase tracking-wide text-white">
                        Depósito
                      </span>
                      <span className="block text-[10px] text-emerald-200/70">
                        Recarga tu saldo
                      </span>
                    </span>
                    <span className="text-white/40">›</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: "/home" });
                    }}
                    className="group flex items-center gap-3 rounded-xl border border-rose-400/25 bg-gradient-to-r from-rose-500/10 to-rose-500/[0.03] px-3 py-3 text-left transition hover:border-rose-400/50 hover:from-rose-500/20"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-200">
                      <LogOut className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-bold uppercase tracking-wide text-white">
                        Salir del juego
                      </span>
                      <span className="block text-[10px] text-rose-200/70">
                        Volver al inicio
                      </span>
                    </span>
                    <span className="text-white/40">›</span>
                  </button>
                </nav>

                <div
                  className="px-4 pb-4 pt-2 text-center text-[9px] uppercase tracking-[0.18em] text-purple-300/40"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
                >
                  Juega con responsabilidad
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}