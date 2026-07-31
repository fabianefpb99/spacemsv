import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, ShieldCheck, X } from "lucide-react";

export type GameHelpKey =
  | "mines"
  | "chicken"
  | "spaceman"
  | "dice"
  | "roulette"
  | "slot_mafia"
  | "slot_samurai"
  | "blackjack";

type HelpContent = { title: string; steps: string[]; rtp?: string };

const HELP: Record<GameHelpKey, HelpContent> = {
  mines: {
    title: "Cómo jugar Buscaminas",
    steps: [
      "Elige tu apuesta y la cantidad de minas del tablero.",
      "Pulsa JUGAR y destapa casillas: cada casilla segura sube tu multiplicador.",
      "Puedes retirar en cualquier momento para asegurar la ganancia.",
      "Si destapas una mina, pierdes la apuesta de esa ronda.",
    ],
  },
  chicken: {
    title: "Cómo jugar Chicken Space",
    steps: [
      "Elige tu apuesta y pulsa JUGAR para iniciar la ruta.",
      "Cada salto a un asteroide aumenta el multiplicador.",
      "Retira antes de fallar un salto para cobrar tu ganancia.",
      "Si el salto falla, la ronda termina y pierdes la apuesta.",
    ],
  },
  spaceman: {
    title: "Cómo jugar Spaceman",
    steps: [
      "Apuesta antes de que inicie el vuelo.",
      "El multiplicador sube mientras el astronauta vuela.",
      "Pulsa RETIRAR antes del crash para cobrar apuesta × multiplicador.",
      "Si el vuelo termina antes de retirar, pierdes la apuesta.",
    ],
  },
  dice: {
    title: "Cómo jugar Dados",
    steps: [
      "Define tu apuesta y el objetivo (mayor o menor).",
      "El multiplicador se ajusta según la probabilidad elegida.",
      "Lanza los dados: si el resultado cumple tu predicción, ganas.",
      "A menor probabilidad, mayor pago.",
    ],
  },
  roulette: {
    title: "Cómo jugar Ruleta",
    steps: [
      "Selecciona el valor de ficha y coloca tu apuesta en el tablero.",
      "Solo puedes hacer una apuesta por ronda.",
      "Pleno paga hasta 14x; color y par/impar pagan menos pero aciertan más seguido.",
      "Gira la ruleta y se pagan automáticamente las apuestas ganadoras.",
    ],
  },
  slot_mafia: {
    title: "Cómo jugar Mafia Slot",
    steps: [
      "Ajusta tu apuesta total; se reparte entre las líneas activas.",
      "Pulsa GIRAR para lanzar los rodillos.",
      "Ganas al alinear 3 o más símbolos iguales en una línea.",
      "Los símbolos premium pagan mucho más en combinaciones de 5.",
    ],
  },
  slot_samurai: {
    title: "Cómo jugar Samurai Slot",
    steps: [
      "Ajusta tu apuesta total; se reparte entre las líneas activas.",
      "Pulsa GIRAR para lanzar los rodillos.",
      "Ganas al alinear 3 o más símbolos iguales en una línea.",
      "Los símbolos premium pagan mucho más en combinaciones de 5.",
    ],
  },
  blackjack: {
    title: "Cómo jugar Blackjack",
    steps: [
      "Elige tu apuesta y recibe dos cartas.",
      "Pide (HIT) para sumar cartas o plántate (STAND) para conservar tu mano.",
      "Gana quien se acerque más a 21 sin pasarse.",
      "Blackjack natural (21 con dos cartas) paga más.",
    ],
  },
};

export function GameHelpButton({
  game,
  className = "",
  iconClassName = "h-4 w-4",
}: {
  game: GameHelpKey;
  className?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const content = HELP[game];
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cómo jugar"
        className={className || "rounded-md p-1 text-purple-200/80 hover:bg-white/5"}
      >
        <HelpCircle className={iconClassName} />
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[3px] animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={content.title}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-purple-300/25 bg-gradient-to-b from-[#1d1030]/95 via-[#150a25]/95 to-[#0d0618]/95 px-5 pb-5 pt-9 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85),0_0_60px_-20px_rgba(168,85,247,0.55)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
          >
            {/* halo superior */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.35),transparent_70%)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/60 to-transparent"
            />

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-white/5 p-1.5 text-purple-200/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="relative flex flex-col items-center text-center">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-300/35 bg-gradient-to-br from-purple-500/35 to-fuchsia-500/15 shadow-[0_0_28px_-4px_rgba(168,85,247,0.7)]">
                <HelpCircle className="h-7 w-7 text-purple-100" strokeWidth={1.6} />
              </div>
              <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-purple-300/70">
                Guía rápida
              </span>
              <h2 className="mt-1 font-display text-lg font-bold uppercase tracking-wide text-white">
                {content.title}
              </h2>
            </div>

            <ol className="relative mt-5 space-y-2.5">
              {content.steps.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2.5 text-[13px] leading-snug text-purple-50/85"
                >
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/60 to-fuchsia-500/40 text-[10px] font-bold text-white shadow-[0_0_12px_-2px_rgba(168,85,247,0.8)]">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>

            <div className="relative mt-5 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/10 px-4 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-200" />
                <span className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-purple-100">
                  RTP 96%
                </span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}