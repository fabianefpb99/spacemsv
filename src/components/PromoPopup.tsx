import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import comboImg from "@/assets/combo-starter.webp";

const STORAGE_KEY = "betspaceman:promo-starter:deadline";
const SHOWS_KEY = "betspaceman:promo-starter:shows";
const MAX_SHOWS_PER_HOUR = 2;
const ONE_HOUR_MS = 60 * 60 * 1000;
const DURATION_MS = 60 * 60 * 1000; // 1 hora
const IMAGE_IDLE_LOAD_DELAY_MS = 4500;
const SHOW_AFTER_INTERACTION_MS = 900;

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function PromoPopup() {
  const [open, setOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [remaining, setRemaining] = useState(DURATION_MS);
  const navigate = useNavigate();

  const closePopup = () => {
    setOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("betspace:promo-starter-closed"));
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    let shows: number[] = [];
    try {
      shows = JSON.parse(localStorage.getItem(SHOWS_KEY) || "[]");
    } catch {
      shows = [];
    }
    const nowTs = Date.now();
    shows = shows.filter((ts) => nowTs - ts < ONE_HOUR_MS);
    if (shows.length >= MAX_SHOWS_PER_HOUR) {
      localStorage.setItem(SHOWS_KEY, JSON.stringify(shows));
      return;
    }
    setAllowed(true);

    let deadline = Number(localStorage.getItem(STORAGE_KEY));
    const now = Date.now();
    if (!deadline || deadline < now) {
      deadline = now + DURATION_MS;
      localStorage.setItem(STORAGE_KEY, String(deadline));
    }

    const tick = () => {
      let left = deadline - Date.now();
      if (left <= 0) {
        // Reinicia automáticamente para mantener la urgencia
        deadline = Date.now() + DURATION_MS;
        localStorage.setItem(STORAGE_KEY, String(deadline));
        left = deadline - Date.now();
      }
      setRemaining(Math.max(0, left));
    };
    tick();

    let id: number | null = window.setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.hidden) {
        if (id != null) { window.clearInterval(id); id = null; }
      } else if (id == null) {
        tick();
        id = window.setInterval(tick, 1000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    let disposed = false;
    let userInteracted = false;
    let imageReady = false;
    let imageStarted = false;
    let img: HTMLImageElement | null = null;
    let openTimer: number | null = null;

    const removeInteractionListeners = () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("scroll", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };

    const scheduleOpen = () => {
      if (disposed || !userInteracted || !imageReady || openTimer != null) return;
      openTimer = window.setTimeout(() => {
        if (disposed) return;
        shows.push(Date.now());
        localStorage.setItem(SHOWS_KEY, JSON.stringify(shows));
        setOpen(true);
      }, SHOW_AFTER_INTERACTION_MS);
    };

    const markImageReady = () => {
      imageReady = true;
      setImgLoaded(true);
      scheduleOpen();
    };

    const startImageLoad = () => {
      if (disposed || imageStarted) return;
      imageStarted = true;
      img = new Image();
      img.decoding = "async";
      img.fetchPriority = "low";
      img.src = comboImg;
      if (img.complete && img.naturalWidth > 0) {
        markImageReady();
      } else {
        img.onload = markImageReady;
        img.onerror = () => {};
      }
    };

    function handleInteraction() {
      userInteracted = true;
      removeInteractionListeners();
      startImageLoad();
      scheduleOpen();
    }

    window.addEventListener("pointerdown", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction, { passive: true });
    window.addEventListener("scroll", handleInteraction, { passive: true });
    window.addEventListener("touchstart", handleInteraction, { passive: true });

    const imageIdleTimer = window.setTimeout(startImageLoad, IMAGE_IDLE_LOAD_DELAY_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (id != null) window.clearInterval(id);
      disposed = true;
      removeInteractionListeners();
      window.clearTimeout(imageIdleTimer);
      if (openTimer != null) window.clearTimeout(openTimer);
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, []);

  if (!allowed || !open || !imgLoaded) return null;

  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const handleImageClick = () => {
    navigate({ to: "/pay" });
    closePopup();
  };

  return (
    <div
      data-promo-popup="starter"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="Promoción Combo Starter"
      onClick={closePopup}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md animate-promo-blop"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closePopup}
          aria-label="Cerrar promoción"
          className="promo-close-btn absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-white ring-2 ring-purple-400/60 shadow-lg shadow-purple-900/60 transition hover:bg-black hover:ring-purple-300"
        >
          <X className="h-5 w-5" strokeWidth={3} />
        </button>

        <div className="relative overflow-hidden rounded-2xl ring-1 ring-purple-500/40 shadow-2xl shadow-purple-900/60 cursor-pointer" onClick={handleImageClick}>
          <img
            src={comboImg}
            alt="Combo Starter Apuesta"
            className="block h-auto w-full select-none"
            draggable={false}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />

          {/* Overlay con el contador real, posicionado sobre el reloj de la imagen */}
          <div
            className="absolute flex items-center justify-center"
            style={{ left: "67.5%", top: "63.5%", width: "27.5%", height: "11%" }}
          >
            <div className="promo-countdown-box flex h-full w-full items-center justify-center rounded-md bg-[#1a0530]/95 px-1">
              <span
                className="promo-countdown-text font-display font-black tabular-nums leading-none text-white"
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