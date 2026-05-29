import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import comboImg from "@/assets/combo-starter.png";

const STORAGE_KEY = "betspaceman:promo-starter:deadline";
const SEEN_KEY = "betspaceman:promo-starter:seen";
const DURATION_MS = 60 * 60 * 1000; // 1 hora

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function PromoPopup() {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(DURATION_MS);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Mostrar solo en la primera apertura de la sesión
    if (sessionStorage.getItem(SEEN_KEY)) return;

    let deadline = Number(localStorage.getItem(STORAGE_KEY));
    const now = Date.now();
    if (!deadline || deadline < now) {
      deadline = now + DURATION_MS;
      localStorage.setItem(STORAGE_KEY, String(deadline));
    }

    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
    };
    tick();

    const t = setTimeout(() => setOpen(true), 450);
    const id = setInterval(tick, 1000);
    sessionStorage.setItem(SEEN_KEY, "1");

    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  if (!open) return null;

  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const handleImageClick = () => {
    navigate({ to: "/pay" });
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="Promoción Combo Starter"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-[260px] sm:max-w-[300px] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar promoción"
          className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-white ring-2 ring-purple-400/60 shadow-lg shadow-purple-900/60 transition hover:bg-black hover:ring-purple-300"
        >
          <X className="h-5 w-5" strokeWidth={3} />
        </button>

        <div className="relative overflow-hidden rounded-2xl ring-1 ring-purple-500/40 shadow-2xl shadow-purple-900/60 cursor-pointer" onClick={handleImageClick}>
          <img
            src={comboImg}
            alt="Combo Starter Apuesta"
            className="block h-auto w-full select-none"
            draggable={false}
          />

          {/* Overlay con el contador real, posicionado sobre el reloj de la imagen */}
          <div
            className="absolute flex items-center justify-center"
            style={{ left: "67.5%", top: "63.5%", width: "27.5%", height: "11%" }}
          >
            <div className="flex h-full w-full items-center justify-center rounded-md bg-[#1a0530]/95 px-1">
              <span
                className="font-display font-black tabular-nums leading-none text-white"
                style={{
                  fontSize: "clamp(14px, 4.2vw, 26px)",
                  textShadow: "0 0 8px rgba(168,85,247,0.7)",
                  letterSpacing: "0.04em",
                }}
              >
                {pad(h)}:{pad(m)}:{pad(s)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}