import { useEffect, useState } from "react";
import logo from "@/assets/betspace-logo.svg";

/**
 * Full-screen branded loading overlay. Always renders while `active` is true,
 * and enforces a minimum visible duration (default 280ms) so a fast load
 * doesn't flash a cut-off animation.
 */
export function BrandLoader({ active, minMs = 280 }: { active: boolean; minMs?: number }) {
  const [show, setShow] = useState(active);
  const [shownAt] = useState(() => Date.now());

  useEffect(() => {
    if (active) {
      setShow(true);
      return;
    }
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, minMs - elapsed);
    const t = setTimeout(() => setShow(false), remaining);
    return () => clearTimeout(t);
  }, [active, minMs, shownAt]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#060210]"
      aria-live="polite"
      aria-busy="true"
      style={{ animation: !active ? "brandLoaderFade 200ms ease-out forwards" : undefined }}
    >
      <img
        src={logo}
        alt="BetSpace"
        className="w-56 max-w-[60vw] select-none"
        draggable={false}
        style={{ animation: "brandLoaderPulse 1.1s ease-in-out infinite" }}
      />
      <style>{`
        @keyframes brandLoaderPulse {
          0%, 100% { opacity: 0.55; transform: scale(0.98); filter: drop-shadow(0 0 12px rgba(217,70,239,0.35)); }
          50%      { opacity: 1;    transform: scale(1.02); filter: drop-shadow(0 0 22px rgba(217,70,239,0.7)); }
        }
        @keyframes brandLoaderFade {
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}