import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { Smartphone, Wrench } from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { getPublicDesktopGate } from "@/lib/admin/desktop-gate.functions";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Bloqueo premium de la vista de escritorio.
 * Se activa desde el panel admin (Vista PC). Los administradores nunca lo ven,
 * y la ruta /adminpanel queda siempre disponible.
 */
export function DesktopGate() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const gateFn = useServerFn(getPublicDesktopGate);
  const gateQ = useQuery({
    queryKey: ["public-desktop-gate"],
    queryFn: () => gateFn(),
    staleTime: 60_000,
  });
  const isAdminQ = useIsAdmin();

  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const gate = gateQ.data;
  const active =
    !!gate?.enabled &&
    width !== null &&
    width >= gate.min_width &&
    !path.startsWith("/adminpanel") &&
    isAdminQ.data !== true;

  // Evita scroll del documento detrás del overlay.
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active || !gate) return null;

  return (
    <div className="theme-dark-fixed fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#060210] px-8 text-white">
      {/* Nebulosas de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[38rem] w-[38rem] rounded-full opacity-60 blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,0.45), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-52 -right-32 h-[34rem] w-[34rem] rounded-full opacity-50 blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(217,70,239,0.4), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(168,85,247,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <div className="relative w-full max-w-xl text-center">
        <div className="rounded-[28px] border border-purple-500/25 bg-[#0d0522]/80 p-10 shadow-[0_30px_80px_-30px_rgba(168,85,247,0.55)] backdrop-blur-xl">
          <div className="flex justify-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-fuchsia-400/30 bg-[#150830] shadow-[0_0_40px_rgba(217,70,239,0.35)]">
              <span
                aria-hidden
                className="absolute inset-0 animate-ping rounded-3xl border border-fuchsia-400/20"
              />
              <img src={betspaceLogo} alt="BETSPACE" className="relative h-8 w-auto" />
            </div>
          </div>

          <span className="mt-7 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/35 bg-fuchsia-500/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-fuchsia-200">
            <Wrench className="h-3 w-3" />
            En construcción
          </span>

          <h1 className="mt-5 text-balance text-3xl font-black uppercase leading-tight tracking-wide drop-shadow-[0_0_18px_rgba(217,70,239,0.45)]">
            {gate.title}
          </h1>

          <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-purple-100/75">
            {gate.message}
          </p>

          <div className="mt-8 flex items-center justify-center gap-3 rounded-2xl border border-purple-500/25 bg-[#150830]/70 px-5 py-4">
            <Smartphone className="h-5 w-5 shrink-0 text-fuchsia-300" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-100/85">
              Abre BETSPACE desde tu móvil
            </span>
          </div>

          <div className="mx-auto mt-8 h-1 w-40 overflow-hidden rounded-full bg-purple-500/15">
            <div className="h-full w-1/3 animate-[gate-sweep_2.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-400" />
          </div>

          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.3em] text-purple-300/50">
            BETSPACE · Casino Online
          </p>
        </div>
      </div>

      <style>{`@keyframes gate-sweep{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  );
}
