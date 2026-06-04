import { useEffect, useState } from "react";
import bgImage from "@/assets/space-bg-full.png";
import astronautIdle from "@/assets/astronaut-idle.svg";
import astronautFlying from "@/assets/astronaut-flying.png";
import meteor from "@/assets/asteroid.svg";
import bgMusic from "@/assets/bg-music.mp3";
import astronautRocket from "@/assets/astronaut-rocket.svg";
import gameSpaceman from "@/assets/game-spaceman.jpg";
import gameSlotMafia from "@/assets/game-slot-mafia.jpg";
import gameMines from "@/assets/game-mines.jpg";
import gameDice from "@/assets/game-dice.jpg";
import blackjackPromo from "@/assets/blackjack-promo.png.asset.json";
import gameRuleta from "@/assets/home-hero-ruleta.jpg";

const ASSETS: { src: string; type: "image" | "audio" }[] = [
  { src: bgImage, type: "image" },
  { src: astronautIdle, type: "image" },
  { src: astronautFlying, type: "image" },
  { src: meteor, type: "image" },
  { src: astronautRocket, type: "image" },
  { src: bgMusic, type: "audio" },
];

const BACKGROUND_THRESHOLD_MS = 60_000; // re-show loader after 60s in background
const MIN_VISIBLE_MS = 900;

function preloadAsset(asset: { src: string; type: "image" | "audio" }): Promise<void> {
  return new Promise((resolve) => {
    if (asset.type === "image") {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = asset.src;
    } else {
      const audio = new Audio();
      const done = () => resolve();
      audio.addEventListener("canplaythrough", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      audio.preload = "auto";
      audio.src = asset.src;
      // Safety timeout — some browsers don't fire canplaythrough reliably
      setTimeout(done, 4000);
    }
  });
}

export function LoadingScreen({ children, variant = "rocket" }: { children: React.ReactNode; variant?: "rocket" | "mine" | "slot" | "dice" | "blackjack" | "roulette" }) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [targetProgress, setTargetProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    let completed = 0;

    const tasks = ASSETS.map((a) =>
      preloadAsset(a).then(() => {
        completed += 1;
        if (!cancelled) setTargetProgress(Math.round((completed / ASSETS.length) * 95));
      })
    );

    Promise.all(tasks).then(() => {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setTimeout(() => {
        if (!cancelled) {
          setTargetProgress(100);
          setLoading(false);
        }
      }, wait);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Smoothly animate the visible progress toward the target so the bar fills continuously
  useEffect(() => {
    let raf: number;
    const tick = () => {
      setProgress((p) => {
        if (p >= targetProgress) return p;
        const delta = Math.max(0.4, (targetProgress - p) * 0.06);
        return Math.min(targetProgress, p + delta);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetProgress]);

  // Re-show loader if the app was in background for a long time
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible" && hiddenAt) {
        const away = Date.now() - hiddenAt;
        hiddenAt = null;
        if (away >= BACKGROUND_THRESHOLD_MS) {
          setProgress(0);
          setTargetProgress(0);
          setLoading(true);
          let p = 0;
          const id = setInterval(() => {
            p = Math.min(100, p + 10);
            setTargetProgress(p);
            if (p >= 100) {
              clearInterval(id);
              setTimeout(() => setLoading(false), 250);
            }
          }, 90);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <>
      {children}
      {loading && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ backgroundColor: "#14082a" }}
          aria-live="polite"
          aria-busy="true"
        >
          <img
            src={
              variant === "mine" ? gameMines
              : variant === "slot" ? gameSlotMafia
              : variant === "dice" ? gameDice
              : variant === "blackjack" ? blackjackPromo.url
              : variant === "roulette" ? gameRuleta
              : variant === "rocket" ? gameSpaceman
              : astronautRocket
            }
            alt=""
            className="w-40 h-40 object-cover animate-pulse rounded-2xl border border-fuchsia-500/70 shadow-[0_0_8px_rgba(217,70,239,0.25)] drop-shadow-[0_0_25px_rgba(168,85,247,0.55)]"
            draggable={false}
          />
          <p className="mt-4 text-white text-lg font-medium tracking-wide">Loading...</p>
          <div className="mt-4 w-48 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
}