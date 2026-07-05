import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import mascotAsset from "@/assets/mascot-chica.webp.asset.json";

const SHOWN_KEY = "betspace:mascot-shown";
const FALLBACK_DELAY_MS = 1200;
const SHOWS_KEY = "betspace:mascot:shows";
const MAX_SHOWS_PER_HOUR = 2;
const ONE_HOUR_MS = 60 * 60 * 1000;

export function MascotFloater() {
  const isMobile = useIsMobile();
  const [armed, setArmed] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [bubbleIn, setBubbleIn] = useState(false);
  const [typed, setTyped] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  // Preload + decode
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SHOWN_KEY) === "1") {
      setDismissed(true);
      return;
    }
    // Same per-hour cap as the STARTER promo popup
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
      setDismissed(true);
      return;
    }
    shows.push(nowTs);
    localStorage.setItem(SHOWS_KEY, JSON.stringify(shows));
    const img = new Image();
    img.src = mascotAsset.url;
    const done = () => setDecoded(true);
    if (typeof img.decode === "function") {
      img.decode().then(done).catch(done);
    } else {
      img.onload = done;
      img.onerror = done;
    }
  }, []);

  // Arm on popup close or fallback timer
  useEffect(() => {
    if (typeof window === "undefined") return;
    const arm = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setArmed(true);
    };
    window.addEventListener("betspace:promo-starter-closed", arm);
    // Fallback: if the promo popup doesn't show at all, arm after delay
    timerRef.current = window.setTimeout(arm, FALLBACK_DELAY_MS);
    return () => {
      window.removeEventListener("betspace:promo-starter-closed", arm);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const visible = isMobile && armed && decoded && !dismissed;

  // Trigger enter animation on next frame after mount
  useEffect(() => {
    if (!visible) return;
    const r1 = requestAnimationFrame(() => setEntered(true));
    // Wait long enough so the STARTER APUESTA popup can't cover the typing.
    const t = window.setTimeout(() => setBubbleIn(true), 1100);
    return () => {
      cancelAnimationFrame(r1);
      window.clearTimeout(t);
    };
  }, [visible]);

  // Fast typewriter effect on the bubble text (simulates her speaking).
  const FULL_TEXT = "¿QUÉ VAMOS\nA JUGAR HOY?";
  useEffect(() => {
    if (!bubbleIn) {
      setTyped("");
      return;
    }
    let i = 0;
    setTyped("");
    // Small extra delay so the bubble pops in fully before typing starts.
    const startId = window.setTimeout(() => {
      const id = window.setInterval(() => {
        i += 1;
        setTyped(FULL_TEXT.slice(0, i));
        if (i >= FULL_TEXT.length) window.clearInterval(id);
      }, 65);
      intervalRef.current = id;
    }, 350);
    return () => {
      window.clearTimeout(startId);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [bubbleIn]);

  // Close when clicking anywhere outside the mascot image.
  const handleDismiss = () => {
    if (leaving) return;
    try {
      sessionStorage.setItem(SHOWN_KEY, "1");
    } catch {}
    setLeaving(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      setDismissed(true);
    }, 400);
  };
  const dismissRef = useRef(handleDismiss);
  dismissRef.current = handleDismiss;

  // Auto-dismiss after 10s of no interaction with the mascot itself.
  useEffect(() => {
    if (!visible || leaving) return;
    idleTimerRef.current = window.setTimeout(() => {
      dismissRef.current();
    }, 10000);
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [visible, leaving]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  // Close on the first click anywhere that isn't the header/bottom nav.
  // Scroll/touch-move does NOT close the mascot.
  useEffect(() => {
    if (!visible) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // Header, bottom nav, and any open drawer/dialog/menu keep working
      // normally (no swallow, no close) so the hamburger menu and settings
      // gear behave at the first click.
      if (
        target &&
        target.closest(
          'header, nav, [role="dialog"], [role="menu"], [data-radix-portal], [data-state="open"], aside',
        )
      )
        return;
      // Anywhere else: close AND eat the click so the first tap dismisses
      // her without triggering the underlying UI.
      e.preventDefault();
      e.stopPropagation();
      dismissRef.current();
    };
    // capture=true so we run before other click handlers on the page.
    document.addEventListener("click", onDocClick, true);
    return () => {
      document.removeEventListener("click", onDocClick, true);
    };
  }, [visible]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 lg:hidden"
      aria-hidden="true"
    >
      <div
        ref={wrapRef}
        className={`mascot-wrap ${entered ? "mascot-wrap--in" : ""} ${leaving ? "mascot-wrap--out" : ""}`}
        style={{
          position: "absolute",
          right: "-72px",
          bottom: "56px", // roughly above bottom nav so feet peek behind it
        }}
      >
        {/* Speech bubble */}
        <div
          className={`mascot-bubble ${bubbleIn ? "mascot-bubble--in" : ""}`}
        >
          <svg
            className="mascot-bubble__frame"
            viewBox="0 0 300 110"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mbFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a0b3a" stopOpacity="0.96" />
                <stop offset="100%" stopColor="#0a0418" stopOpacity="0.98" />
              </linearGradient>
              <linearGradient id="mbStroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d946ef" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
              <filter id="mbGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Main chamfered body */}
            <path
              d="M18,10 L282,10 L294,22 L294,72 L282,84 L232,84 L226,92 L60,92 L54,84 L18,84 L6,72 L6,22 Z"
              fill="url(#mbFill)"
              stroke="url(#mbStroke)"
              strokeWidth="1.9"
              filter="url(#mbGlow)"
            />
            {/* Inner accent line */}
            <path
              d="M22,16 L278,16 L288,26 L288,68 L278,78 L22,78 L12,68 L12,26 Z"
              fill="none"
              stroke="#c084fc"
              strokeWidth="0.65"
              strokeOpacity="0.6"
            />
            {/* Left bracket accent */}
            <path
              d="M2,36 L2,58 M2,36 L8,36 M2,58 L8,58"
              stroke="url(#mbStroke)"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
            />
            {/* Top-right LED dots */}
            <circle cx="248" cy="4" r="1.6" fill="#e879f9" />
            <circle cx="256" cy="4" r="1.6" fill="#c084fc" opacity="0.75" />
            <circle cx="264" cy="4" r="1.6" fill="#a855f7" opacity="0.55" />
            {/* Bottom notch tick */}
            <path
              d="M140,92 L146,98 L154,98 L160,92"
              stroke="url(#mbStroke)"
              strokeWidth="1.5"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
          <span className="mascot-bubble__text">
            {typed}
            <span className="mascot-bubble__caret" aria-hidden="true">
              ▍
            </span>
          </span>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          aria-label="Ocultar personaje"
          className="pointer-events-auto absolute -left-1 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/90 ring-1 ring-white/20 backdrop-blur transition hover:bg-black/80"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>

        {/* Soft purple shadow behind the mascot */}
        <div
          className="absolute -z-10"
          style={{
            right: "6%",
            bottom: "6%",
            width: "78%",
            height: "52%",
            background:
              "radial-gradient(ellipse at center, rgba(124, 58, 237, 0.62) 0%, rgba(88, 28, 135, 0.32) 45%, transparent 72%)",
            filter: "blur(32px)",
            transform: "scale(1.15)",
          }}
        />

        {/* Mascot image */}
        <img
          ref={imageRef}
          src={mascotAsset.url}
          alt=""
          draggable={false}
          data-no-smooth-image="true"
          className="mascot-img block h-auto select-none"
          style={{
            width: "min(58vw, 260px)",
            filter:
              "drop-shadow(0 0 1px rgba(139, 92, 246, 0.55)) drop-shadow(0 0 2px rgba(124, 58, 237, 0.42)) drop-shadow(0 0 4px rgba(88, 28, 135, 0.28)) drop-shadow(0 14px 26px rgba(88, 28, 135, 0.55))",
            pointerEvents: "auto",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}

export default MascotFloater;