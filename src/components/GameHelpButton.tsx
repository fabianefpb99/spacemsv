import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";

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
      "Selecciona el valor de ficha y coloca apuestas en el tablero.",
      "Puedes combinar varias apuestas en la misma ronda.",
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
          className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={content.title}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-purple-400/35 bg-[#12081f]/95 p-5 shadow-[0_0_40px_rgba(139,92,246,0.28)]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute right-3 top-3 rounded-full p-1 text-purple-200/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="pr-8 font-display text-base font-bold uppercase tracking-wide text-white">
              {content.title}
            </h2>

            <ol className="mt-3 space-y-2">
              {content.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-snug text-purple-100/85">
                  <span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-purple-500/25 text-[10px] font-bold text-purple-200">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>

            <div className="mt-4 border-t border-purple-400/20 pt-3 text-center">
              <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-purple-200">
                RTP 96%
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}