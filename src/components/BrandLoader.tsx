import { useEffect, useState } from "react";
import logo from "@/assets/betspace-logo.svg";

/**
 * Full-screen branded loading overlay. Always renders while `active` is true,
 * and enforces a minimum visible duration (default 280ms) so a fast load
 * doesn't flash a cut-off animation. When `active` flips to false, the
 * loader fades out over ~320ms instead of disappearing instantly.
 */
export function BrandLoader({ active, minMs = 1060 }: { active: boolean; minMs?: number }) {
  const [show, setShow] = useState(active);
  const [fading, setFading] = useState(false);
  const [shownAt] = useState(() => Date.now());
  const FADE_MS = 320;

  useEffect(() => {
    if (active) {
      setFading(false);
      setShow(true);
      return;
    }
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, minMs - elapsed);
    const tFade = setTimeout(() => setFading(true), remaining);
    const tHide = setTimeout(() => setShow(false), remaining + FADE_MS);
    return () => {
      clearTimeout(tFade);
      clearTimeout(tHide);
    };
  }, [active, minMs, shownAt]);

  if (!show) return null;

  return (
    <div
      className="brand-loader-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-[#060210]"
      aria-live="polite"
      aria-busy="true"
      style={{
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: fading ? "none" : undefined,
      }}
    >
      <img
        src={logo}
        alt="BetSpace"
        className="w-36 max-w-[40vw] select-none brand-loader-reveal"
        draggable={false}
      />
      <style>{`
        .brand-loader-reveal {
          -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.15) 35%, #000 50%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.15) 100%);
                  mask-image: linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.15) 35%, #000 50%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.15) 100%);
          -webkit-mask-size: 300% 100%;
                  mask-size: 300% 100%;
          -webkit-mask-repeat: no-repeat;
                  mask-repeat: no-repeat;
          animation: brandLoaderReveal 1.6s linear infinite;
        }
        @keyframes brandLoaderReveal {
          0%   { -webkit-mask-position: 100% 0; mask-position: 100% 0; }
          100% { -webkit-mask-position: 0% 0;   mask-position: 0% 0; }
        }
        @keyframes brandLoaderFade {
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}