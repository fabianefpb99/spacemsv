import { createFileRoute, Link } from "@tanstack/react-router";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { Menu, ChevronRight, ChevronLeft, Gift, Home, Star, Wallet, User, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PromoPopup } from "@/components/PromoPopup";
import { BrandLoader } from "@/components/BrandLoader";
import { SkeletonImage } from "@/components/SkeletonImage";
import { stopAllGameAudio } from "@/lib/gameAudio";
import { playSound } from "@/lib/webAudioPlayer";
import { AuthControl } from "@/components/auth/AuthControl";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useMe } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPublicHomeSlides,
  getPublicFeaturedGames,
} from "@/lib/admin/home-content.functions";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import astronautRocket from "@/assets/astronaut-rocket.svg";
import heroImg from "@/assets/home-hero.jpg";
import heroMinesImg from "@/assets/home-hero-mines.jpg";
import heroSlotImg from "@/assets/home-hero-slot.jpg";
import heroDiceImg from "@/assets/home-hero-dice.jpg";
import heroBlackjackImg from "@/assets/home-hero-blackjack.jpg";
import heroRuletaImg from "@/assets/home-hero-ruleta.jpg";
import heroArenaImg from "@/assets/home-hero-arena.png.asset.json";
import gameSpaceman from "@/assets/game-spaceman.jpg";
import gameSlotMafia from "@/assets/game-slot-mafia.jpg";
import gameMines from "@/assets/game-mines.jpg";
import gameDice from "@/assets/game-dice.jpg";
import gameBlackjackVip from "@/assets/game-blackjack-vip.jpg";
import gift3d from "@/assets/gift-3d.png";
import trophy3d from "@/assets/trophy-3d.png";
import blackjackPromo from "@/assets/blackjack-promo.png.asset.json";
import blackjackBanner from "@/assets/blackjack-banner.jpg";
import jackpotBanner from "@/assets/jackpot-banner.jpg";
import ruletaBanner from "@/assets/ruleta-banner.jpg";
import casinoIntro from "@/assets/audio/casino-intro.mp3.asset.json";
import avatar1 from "@/assets/avatars/avatar-1.png.asset.json";
import avatar2 from "@/assets/avatars/avatar-2.png.asset.json";
import avatar3 from "@/assets/avatars/avatar-3.png.asset.json";
import avatar4 from "@/assets/avatars/avatar-4.png.asset.json";
import avatar5 from "@/assets/avatars/avatar-5.png.asset.json";
import avatar6 from "@/assets/avatars/avatar-6.png.asset.json";
import avatar7 from "@/assets/avatars/avatar-7.png.asset.json";
import avatar8 from "@/assets/avatars/avatar-8.png.asset.json";

const WIN_AVATARS = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8];

const LAST_WINS = [
  { user: "Usuario123", game: "Spaceman", amount: 252413, mult: 1.85 },
  { user: "Astronauta7", game: "Crash", amount: 121876, mult: 2.34 },
  { user: "GalaxyWin", game: "Mines", amount: 82776, mult: 3.12 },
  { user: "MoonPlayer", game: "Dice", amount: 61329, mult: 1.45 },
  { user: "NovaKing", game: "Spaceman", amount: 47892, mult: 1.27 },
  { user: "StarHunter", game: "Crash", amount: 198344, mult: 2.91 },
  { user: "CometRider", game: "Mines", amount: 35421, mult: 4.08 },
  { user: "LunarFox", game: "Dice", amount: 78215, mult: 1.62 },
  { user: "OrbitX", game: "Spaceman", amount: 134567, mult: 2.18 },
  { user: "PlasmaGirl", game: "Crash", amount: 56892, mult: 1.74 },
  { user: "VoidWalker", game: "Mines", amount: 312485, mult: 5.43 },
  { user: "GalaxyKid", game: "Dice", amount: 22719, mult: 1.18 },
  { user: "RocketJoe", game: "Spaceman", amount: 89124, mult: 1.96 },
  { user: "NebulaQ", game: "Crash", amount: 145678, mult: 2.67 },
  { user: "MeteorMax", game: "Mines", amount: 67432, mult: 3.21 },
  { user: "AlphaStar", game: "Dice", amount: 41587, mult: 1.53 },
];

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Inicio — BETSPACE Casino" },
      { name: "description", content: "Tu home en BETSPACE Casino: juegos destacados, jackpot y más." },
      { property: "og:title", content: "Inicio — BETSPACE Casino" },
      { property: "og:description", content: "Tu home en BETSPACE Casino: juegos destacados, jackpot y más." },
    ],
  }),
  component: HomePage,
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function OnlineRotator({ online, username }: { online: number; username?: string | null }) {
  const welcome = username
    ? `👋 BIENVENIDO *@${username}*`
    : "👋 BIENVENIDO A *BETSPACE*";
  const phrases = [
    welcome,
    "¿QUE *JUGAREMOS* HOY?",
    "*APUESTA* AHORA",
    "LA *GALAXIA* ESTÁ ABIERTA",
  ];

  // mode: "online" shows the dot+count; "phrases" cycles the rotating phrases
  const [mode, setMode] = useState<"online" | "phrases">("online");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [exiting, setExiting] = useState(false);

  // After 4.5s of ONLINE -> start cycling phrases
  useEffect(() => {
    if (mode !== "online") return;
    const t = setTimeout(() => {
      setPhraseIdx(0);
      setExiting(false);
      setMode("phrases");
    }, 4500);
    return () => clearTimeout(t);
  }, [mode]);

  const currentRaw = phrases[phraseIdx] ?? "";

  // Cycle each phrase: hold ~2.2s, then flip out, then next (or back to online)
  useEffect(() => {
    if (mode !== "phrases") return;
    const holdMs = 3200;
    const flipMs = 550;
    const hold = setTimeout(() => setExiting(true), holdMs);
    const next = setTimeout(() => {
      if (phraseIdx < phrases.length - 1) {
        setPhraseIdx((i) => i + 1);
        setExiting(false);
      } else {
        setMode("online");
        setExiting(false);
      }
    }, holdMs + flipMs);
    return () => { clearTimeout(hold); clearTimeout(next); };
  }, [mode, phraseIdx, phrases.length]);

  // Render a raw phrase honoring *bold* markers
  function renderPhrase(raw: string) {
    const parts = raw.split("*");
    return parts.map((p, i) =>
      i % 2 === 1 ? (
        <span key={i} className="font-extrabold">{p}</span>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  }

  return (
    <div className="relative mt-[10px] h-6 overflow-hidden" style={{ perspective: "600px" }}>
      {mode === "online" && (
        <div className="absolute inset-0 flex items-center justify-start gap-2 pl-1 animate-fade-in">
          <span className="relative inline-flex h-2 w-2">
            <span className="home-online-dot absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-80" />
            <span className="home-online-dot relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="home-online-text text-xs font-semibold text-white/90">{online} ONLINE</span>
        </div>
      )}
      <div
        className={`absolute inset-0 flex items-center justify-center ${mode === "phrases" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        <span
          key={`${phraseIdx}-${exiting ? "out" : "in"}`}
          className={`text-[15px] font-semibold tracking-wide text-white light-text-dark whitespace-nowrap ${exiting ? "animate-cube-out" : "animate-cube-in"}`}
          style={{ transformOrigin: "center center", backfaceVisibility: "hidden" }}
        >
          {renderPhrase(currentRaw)}
        </span>
      </div>
    </div>
  );
}

const GAMES = [
  { name: "SPACEMAN", img: gameSpaceman, tag: "POPULAR", tagCls: "bg-purple-600 text-white border-purple-400", to: "/spaceman" },
  { name: "SLOT", img: gameSlotMafia, tag: "NUEVO", tagCls: "bg-emerald-600 text-white border-emerald-400", to: "/slot" },
  { name: "MINAS", img: gameMines, tag: "POPULAR", tagCls: "bg-purple-600 text-white border-purple-400", to: "/mines" },
  { name: "DICE", img: gameDice, tag: "CLÁSICO", tagCls: "bg-rose-600 text-white border-rose-400", to: "/dados" },
  { name: "BLACKJACK VIP", img: gameBlackjackVip, tag: "VIP", tagCls: "bg-amber-500 text-black border-amber-300", to: "/blackjackvip" },
];

const TAG_CLS: Record<string, string> = {
  purple: "bg-purple-600 text-white border-purple-400",
  emerald: "bg-emerald-600 text-white border-emerald-400",
  rose: "bg-rose-600 text-white border-rose-400",
  amber: "bg-amber-600 text-white border-amber-400",
  fuchsia: "bg-fuchsia-600 text-white border-fuchsia-400",
};

const SLIDES = [
  {
    img: heroArenaImg.url,
    eyebrow: "ENTRA A LA",
    title: "ARENA",
    desc: "Apuesta por tu campeón\ny gana hasta 6.5x.",
    cta: "Jugar Arena",
    to: "/arena" as const,
  },
  {
    img: heroImg,
    eyebrow: "¡BIENVENIDO A",
    title: "SPACEMAN",
    desc: "Apuesta, multiplica\ny gana en las estrellas.",
    cta: "Jugar ahora",
    to: "/spaceman" as const,
  },
  {
    img: heroMinesImg,
    eyebrow: "DESCUBRE",
    title: "BUSCAMINAS",
    desc: "Esquiva minas,\nrevela gemas y gana.",
    cta: "Jugar Minas",
    to: "/mines" as const,
  },
  {
    img: heroSlotImg,
    eyebrow: "GIRA EN",
    title: "SLOT MAFIA",
    desc: "Alinea los 777\ny llévate el botín.",
    cta: "Jugar Slot",
    to: "/slot" as const,
  },
  {
    img: heroDiceImg,
    eyebrow: "LANZA LOS",
    title: "DADOS",
    desc: "Predice, apuesta\ny multiplica tu suerte.",
    cta: "Jugar Dados",
    to: "/dados" as const,
  },
  {
    img: heroBlackjackImg,
    eyebrow: "JUEGA AL",
    title: "BLACKJACK",
    desc: "Llega a 21\ny vence a la banca.",
    cta: "Jugar Blackjack",
    to: "/blackjack" as const,
  },
  {
    img: heroRuletaImg,
    eyebrow: "GIRA LA",
    title: "RULETA",
    desc: "Rojo, negro o verde:\napuesta y multiplica.",
    cta: "Jugar Ruleta",
    to: "/ruleta" as const,
  },
];

function HomePage() {
  const me = useMe();
  const { user, loading: authLoading } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  // Never show a fake demo amount. If not logged in, show a dash; if logged
  // in but balance hasn't arrived yet, also show a dash so we don't flash $0.
  const balanceText = me.data ? formatCOP(me.data.balance + me.data.bonus_balance) : "—";
  const [online] = useState(219);
  const [slide, setSlide] = useState(0);
  const [arrowsVisible, setArrowsVisible] = useState(true);

  const fetchSlides = useServerFn(getPublicHomeSlides);
  const fetchFeatured = useServerFn(getPublicFeaturedGames);
  const slidesQ = useQuery({
    queryKey: ["public-home-slides"],
    queryFn: () => fetchSlides(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const featuredQ = useQuery({
    queryKey: ["public-featured-games"],
    queryFn: () => fetchFeatured(),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const slidesList = (slidesQ.data && slidesQ.data.length > 0)
    ? slidesQ.data.map((s) => ({
        img: s.image_url,
        eyebrow: s.eyebrow ?? "",
        title: s.title,
        desc: s.description ?? "",
        cta: s.cta_label ?? "Ver más",
        to: (s.cta_link ?? "/home") as "/home",
      }))
    : SLIDES;

  const gamesList = (featuredQ.data && featuredQ.data.length > 0)
    ? featuredQ.data.map((g) => ({
        name: g.name,
        img: g.image_url,
        tag: g.tag ?? "POPULAR",
        tagCls: TAG_CLS[g.tag_color ?? "purple"] ?? TAG_CLS.purple,
        to: (g.link ?? "/home") as "/home",
      }))
    : GAMES;

  const slides = slidesList.length;
  const arrowsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Start visible on every mount so the brand loader paints BEFORE the home
  // ever flashes through. The effect below decides if we keep it on screen
  // (within the per-hour quota) or hide it immediately.
  const [showBrandLoader, setShowBrandLoader] = useState(true);

  // Ambient casino intro — máximo 5 veces por hora.
  // Audio file ya incluye fade-in (1.5s) y fade-out (5s) — 12s totales.
  useEffect(() => {
    const KEY = "betspaceman:casino-intro:plays";
    const ONE_HOUR = 60 * 60 * 1000;
    const MAX_PER_HOUR = 5;
    let plays: number[] = [];
    try { plays = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { plays = []; }
    const now = Date.now();
    plays = plays.filter((t) => now - t < ONE_HOUR);
    if (plays.length >= MAX_PER_HOUR) return;

    const TARGET_VOLUME = 0.15;
    const STOP_AT_MS = 12300;
    const JS_FADE_MS = 6000; // 5s nativo del archivo + 1s adelantado por JS
    const FADE_START_MS = STOP_AT_MS - JS_FADE_MS;

    // Web Audio: respeta volumen en iOS (HTMLAudio lo ignora).
    const handle = playSound(casinoIntro.url, {
      volume: TARGET_VOLUME,
      pauseOnHidden: true,
    });

    // Marcamos consumo en cuanto disparamos: si el usuario cierra la pestaña
    // igual cuenta como una reproducción dentro de la hora.
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || "[]");
      const arr = Array.isArray(stored) ? stored : [];
      arr.push(Date.now());
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch { /* ignore */ }

    const tFade = setTimeout(() => {
      handle.setVolume(0, JS_FADE_MS);
    }, Math.max(0, FADE_START_MS));
    const tStop = setTimeout(() => {
      handle.stop();
    }, STOP_AT_MS);

    return () => {
      clearTimeout(tFade);
      clearTimeout(tStop);
      // Fade-out suave al desmontar para evitar cortes abruptos.
      handle.stop(450);
    };
  }, []);

  // Mostrar el BrandLoader la primera vez que se entra al sitio y
  // al menos una vez por hora, para reforzar la marca.
  useEffect(() => {
    const KEY = "betspaceman:brand-loader:last-shown";
    const ONE_HOUR = 60 * 60 * 1000;
    const MAX_PER_HOUR = 5;
    let shows: number[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
      shows = Array.isArray(parsed) ? parsed : [];
    } catch { shows = []; }
    const now = Date.now();
    shows = shows.filter((t) => now - t < ONE_HOUR);
    if (shows.length >= MAX_PER_HOUR) {
      setShowBrandLoader(false);
      return;
    }
    shows.push(now);
    try { localStorage.setItem(KEY, JSON.stringify(shows)); } catch { /* ignore */ }
    setShowBrandLoader(true);
    const t = setTimeout(() => setShowBrandLoader(false), 1900);
    return () => clearTimeout(t);
  }, []);

  // Al entrar al home, cualquier juego previo queda completamente cerrado.
  useEffect(() => { stopAllGameAudio(); }, []);

  const showArrows = () => {
    setArrowsVisible(true);
    if (arrowsTimer.current) clearTimeout(arrowsTimer.current);
    arrowsTimer.current = setTimeout(() => setArrowsVisible(false), 1500);
  };

  useEffect(() => {
    if (slidesList.length <= 1) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % slidesList.length), 5000);
    return () => clearInterval(id);
  }, [slidesList.length]);

  // Auto-ocultar flechas al cargar y cada vez que cambia el slide
  useEffect(() => {
    showArrows();
    return () => {
      if (arrowsTimer.current) clearTimeout(arrowsTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  const current = slidesList[slide] ?? slidesList[0];

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <BrandLoader active={showBrandLoader} minMs={1900} />
      <PromoPopup />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6 pt-4 sm:max-w-lg sm:px-4">
        {/* Header — must match SpacemanGame header exactly, sin icono de sonido */}
        <header
          className="flex flex-col items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1">
              <HamburgerDrawer
                trigger={
                  <button
                    type="button"
                    aria-label="Abrir menú"
                    className="rounded-md p-2 text-white hover:bg-white/10"
                  >
                    <Menu className="h-7 w-7" strokeWidth={3} />
                  </button>
                }
              />
              <Link to="/home" className="logo-shine">
                <img
                  src={betspaceLogo}
                  alt="BETSPACE"
                  className="h-6 w-auto sm:h-7 translate-y-px"
                />
                <img
                  src={betspaceLogo}
                  alt=""
                  aria-hidden="true"
                  className="logo-shine-overlay h-6 w-auto sm:h-7 translate-y-px"
                />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
                    <div className="font-display text-[11px] font-bold sm:text-xs text-white">
                      <span className="neon-green mr-0.5">$</span>{balanceText} COP
                    </div>
                  </div>
                  <AuthControl />
                  <NotificationBell />
                </>
              ) : authLoading ? (
                <div className="h-7 w-24 animate-pulse rounded-md bg-white/5" />
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthDialogOpen(true)}
                  className="inline-flex items-center rounded-md border border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-500 to-purple-600 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-[0_0_14px_-4px_rgba(217,70,239,0.85)] transition hover:from-fuchsia-400 hover:to-purple-500 sm:text-[11px]"
                >
                  Login / Registro
                </button>
              )}
            </div>
          </div>
        </header>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

        {/* Online indicator / rotating tagline */}
        <OnlineRotator
          online={online}
          username={
            user
              ? (me.data?.profile?.username ??
                  (user.user_metadata?.full_name as string | undefined) ??
                  (user.email ? user.email.split("@")[0] : null))
              : null
          }
        />

        {/* Hero banner */}
        <section className="theme-dark-fixed slider-neon-frame mt-[10px] overflow-hidden rounded-2xl border border-violet-800/50 bg-[#120824] shadow-[0_0_10px_rgba(76,29,149,0.35)]">
          <div
            className="relative h-44 touch-pan-y select-none sm:h-52"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLDivElement).dataset.startX = String(e.clientX);
              (e.currentTarget as HTMLDivElement).dataset.startY = String(e.clientY);
            }}
            onPointerUp={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              const sx = Number(el.dataset.startX ?? NaN);
              const sy = Number(el.dataset.startY ?? NaN);
              if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
              const dx = e.clientX - sx;
              const dy = e.clientY - sy;
              delete el.dataset.startX;
              delete el.dataset.startY;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                showArrows();
                if (dx < 0) setSlide((s) => (s + 1) % slidesList.length);
                else setSlide((s) => (s - 1 + slidesList.length) % slidesList.length);
              }
            }}
          >
            {slidesList.map((s, i) => (
              <SkeletonImage
                key={i}
                src={s.img}
                alt={s.title}
                wrapperClassName={`absolute inset-0 h-full w-full transition-opacity duration-700 ${i === slide ? "opacity-100" : "opacity-0"}`}
                className="h-full w-full object-cover"
              />
            ))}
            {/* Flechas de navegación */}
            <button
              onClick={() => { showArrows(); setSlide((s) => (s - 1 + slidesList.length) % slidesList.length); }}
              aria-label="Anterior"
              className={`absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition-opacity duration-500 hover:bg-black/50 hover:text-white ${arrowsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => { showArrows(); setSlide((s) => (s + 1) % slidesList.length); }}
              aria-label="Siguiente"
              className={`absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition-opacity duration-500 hover:bg-black/50 hover:text-white ${arrowsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {/* overlay removed to show full slider image */}
            <div key={slide} className="absolute inset-0 flex flex-col justify-center gap-2 p-4 sm:p-5">
              <span className="inline-flex w-fit items-center rounded-md bg-white/95 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-purple-700 shadow-sm">
                {current.eyebrow}
              </span>
              <h2 className="font-display text-2xl font-black leading-tight tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] sm:text-3xl">
                {current.title}
              </h2>
              <p className="max-w-[55%] whitespace-pre-line text-xs text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-sm">
                {current.desc}
              </p>
              <Link
                to={current.to}
                className="mt-1 inline-flex w-fit items-center justify-center rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/50 transition hover:bg-purple-500"
              >
                {current.cta}
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-2.5">
            {Array.from({ length: slides }).map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-4 bg-purple-400" : "w-1.5 bg-purple-200/30"}`}
              />
            ))}
          </div>
        </section>

        {/* Featured games */}
        <section className="mt-5">
          <div className="flex items-end justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white light-text-dark">
              Juegos destacados
            </h3>
            <button className="text-xs font-semibold text-purple-300 hover:text-purple-200 light-text-purple">
              Ver todos
            </button>
          </div>
          <div className="home-featured-scroll mt-3 flex gap-2 overflow-x-auto pb-1 sm:gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {gamesList.map((g) => (
              <Link
                key={g.name}
                to={g.to}
                className="home-game-card group flex w-[22%] min-w-[22%] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-fuchsia-500/70 bg-[#0c0620] shadow-[0_0_8px_rgba(217,70,239,0.25)] transition hover:border-fuchsia-400 sm:w-[22%] sm:min-w-[22%]"
              >
                <div className="aspect-square w-full overflow-hidden">
                  <SkeletonImage
                    src={g.img}
                    alt={g.name}
                    loading="lazy"
                    width={512}
                    height={512}
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col items-center gap-1 px-1 py-2">
                  <span className="home-game-title font-display text-[10px] font-black tracking-wider text-white sm:text-xs">
                    {g.name}
                  </span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider sm:text-[9px] ${g.tagCls}`}>
                    {g.tag}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* BlackJack — acceso directo */}
        <Link
          to="/blackjack"
          className="promo-banner promo-banner--blackjack relative mt-5 block h-24 overflow-hidden rounded-xl border border-fuchsia-500/70 shadow-[0_0_12px_rgba(217,70,239,0.25)] transition hover:shadow-[0_0_22px_rgba(217,70,239,0.55)] sm:h-28"
        >
          {/* Imagen de fondo completa */}
          <SkeletonImage
            src={blackjackBanner}
            alt="BlackJack"
            loading="lazy"
            wrapperClassName="absolute inset-0 h-full w-full"
            className="h-full w-full object-cover"
          />
          {/* Oscurecido a la izquierda para legibilidad del texto */}
          <div className="promo-banner__scrim pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          {/* Texto encima */}
          <div className="relative z-10 flex h-full items-center justify-between gap-3 px-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="promo-banner__eyebrow text-[10px] font-semibold uppercase tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                Nuevo juego
              </div>
              <div className="promo-banner__title mt-0.5 font-display text-2xl font-black leading-none tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] sm:text-3xl">
                BlackJack
              </div>
              <div className="promo-banner__tag mt-1 inline-block rounded-sm bg-fuchsia-600/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(217,70,239,0.6)]">
                Paga 3 a 2
              </div>
            </div>
            <span className="promo-banner__chev promo-banner__chev--glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-fuchsia-400/70 bg-black/50 text-fuchsia-100 backdrop-blur-sm shadow-[0_0_10px_rgba(217,70,239,0.5)]">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Ruleta — banner estilo BlackJack */}
        <Link
          to="/ruleta"
          className="promo-banner promo-banner--ruleta relative mt-3 block h-24 overflow-hidden rounded-xl border border-purple-400/70 shadow-[0_0_12px_rgba(168,85,247,0.3)] transition hover:shadow-[0_0_22px_rgba(168,85,247,0.6)] sm:h-28"
        >
          <SkeletonImage
            src={ruletaBanner}
            alt="Ruleta"
            loading="lazy"
            wrapperClassName="absolute inset-0 h-full w-full"
            className="h-full w-full object-cover"
          />
          <div className="promo-banner__scrim pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          <div className="relative z-10 flex h-full items-center justify-between gap-3 px-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="promo-banner__eyebrow text-[10px] font-semibold uppercase tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                Gira y gana
              </div>
              <div className="promo-banner__title mt-0.5 font-display text-2xl font-black leading-none tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] sm:text-3xl">
                Ruleta
              </div>
              <div className="promo-banner__tag mt-1 inline-block rounded-sm bg-purple-600/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                Paga hasta 14x
              </div>
            </div>
            <span className="promo-banner__chev promo-banner__chev--glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-400/70 bg-black/50 text-purple-100 backdrop-blur-sm shadow-[0_0_10px_rgba(168,85,247,0.5)]">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Jackpot — banner estilo BlackJack */}
        {/* Arena — banner estilo Ruleta */}
        <Link
          to="/arena"
          className="promo-banner promo-banner--arena relative mt-3 block h-24 overflow-hidden rounded-xl border border-fuchsia-400/70 shadow-[0_0_12px_rgba(217,70,239,0.3)] transition hover:shadow-[0_0_22px_rgba(217,70,239,0.6)] sm:h-28"
        >
          <SkeletonImage
            src={heroArenaImg.url}
            alt="Arena"
            loading="lazy"
            wrapperClassName="absolute inset-0 h-full w-full"
            className="h-full w-full object-cover"
          />
          <div className="promo-banner__scrim pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          <div className="relative z-10 flex h-full items-center justify-between gap-3 px-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="promo-banner__eyebrow text-[10px] font-semibold uppercase tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                Apuesta y gana
              </div>
              <div className="promo-banner__title mt-0.5 font-display text-2xl font-black leading-none tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] sm:text-3xl">
                Arena
              </div>
              <div className="promo-banner__tag mt-1 inline-block rounded-sm bg-fuchsia-600/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(217,70,239,0.6)]">
                Paga hasta 8.0x
              </div>
            </div>
            <span className="promo-banner__chev promo-banner__chev--glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-fuchsia-400/70 bg-black/50 text-fuchsia-100 backdrop-blur-sm shadow-[0_0_10px_rgba(217,70,239,0.5)]">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Jackpot — banner estilo BlackJack */}
        <div className="promo-banner promo-banner--jackpot relative mt-3 block h-24 overflow-hidden rounded-xl border border-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.3)] transition hover:shadow-[0_0_22px_rgba(251,191,36,0.6)] sm:h-28">
          <SkeletonImage
            src={jackpotBanner}
            alt="Jackpot"
            loading="lazy"
            wrapperClassName="absolute inset-0 h-full w-full"
            className="h-full w-full object-cover"
          />
          <div className="promo-banner__scrim pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          <div className="relative z-10 flex h-full items-center justify-between gap-3 px-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="promo-banner__eyebrow text-[10px] font-semibold uppercase tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                Jackpot activo
              </div>
              <div className="promo-banner__title mt-0.5 font-display text-lg font-black leading-none tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] sm:text-xl">
                <span className="neon-green mr-1">$</span>
                {formatCOP(25000000)} COP
              </div>
              <div className="promo-banner__tag promo-banner__tag--amber mt-1 inline-block rounded-sm bg-amber-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                Premio acumulado
              </div>
            </div>
          </div>
        </div>

        {/* Últimas ganancias */}
        <section className="home-wins-panel mt-5 rounded-xl border border-purple-500/30 bg-[#0c0620] p-3 sm:p-4">
          <h3 className="home-wins-heading font-display text-xs font-bold uppercase tracking-widest text-white">
            Últimas ganancias
          </h3>
          <div
            className="home-wins-viewport relative mt-3 overflow-hidden"
            style={{
              height: "calc(4 * 52px)",
            }}
          >
            <ul
              className="flex flex-col gap-2"
              style={{ animation: `wins-scroll ${LAST_WINS.length * 2.2}s linear infinite` }}
            >
              {[...LAST_WINS, ...LAST_WINS].map((w, i) => {
                const avatar = WIN_AVATARS[i % WIN_AVATARS.length];
                return (
                <li
                  key={`${w.user}-${i}`}
                  className="home-win-row flex h-[44px] items-center gap-3 rounded-lg border border-purple-500/20 bg-[#150830]/60 px-2.5"
                >
                  <div className="home-win-avatar h-8 w-8 shrink-0 overflow-hidden rounded-full bg-purple-600/30 ring-1 ring-purple-400/30">
                    <img
                      src={avatar.url}
                      alt={w.user}
                      width={32}
                      height={32}
                      loading={i < 6 ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={i < 4 ? "high" : "auto"}
                      className="h-full w-full object-cover home-win-avatar-img"
                      onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="home-win-user truncate text-xs font-semibold text-white">{w.user}</div>
                    <div className="home-win-game text-[10px] uppercase tracking-wider text-purple-300/70">{w.game}</div>
                  </div>
                  <div className="text-right">
                    <div className="home-win-amount font-display text-xs font-bold">
                      <span className="home-money-sign neon-green mr-0.5">$</span>
                      <span className="text-white">{formatCOP(w.amount)} COP</span>
                    </div>
                    <div className="home-win-mult text-[10px] font-bold text-purple-300">{w.mult.toFixed(2)}x</div>
                  </div>
                </li>
                );
              })}
            </ul>
          </div>
          <style>{`
            @keyframes wins-scroll {
              0% { transform: translateY(0); }
              100% { transform: translateY(calc(-${LAST_WINS.length} * 52px)); }
            }
            .home-win-avatar-img { opacity: 0; transition: opacity 280ms ease-out; }
            .home-win-avatar-img.is-loaded { opacity: 1; }
          `}</style>
        </section>

        {/* Invita y gana */}
        <section className="home-invite-card mt-4 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-gradient-to-r from-[#1a0b3a]/80 to-[#0c0620] p-3 sm:p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16">
            <SkeletonImage
              src={gift3d}
              alt="Regalo"
              loading="lazy"
              width={128}
              height={128}
              wrapperClassName="h-14 w-14 rounded-md sm:h-16 sm:w-16"
              className="h-14 w-14 object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.6)] sm:h-16 sm:w-16"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="home-invite-title font-display text-sm font-bold uppercase tracking-wider text-white">
              Invita y gana
            </div>
            <div className="home-invite-sub text-[11px] font-semibold text-white">
              Obtén 5% de tus referidos
            </div>
          </div>
          <button className="home-invite-btn rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/50 hover:bg-purple-500">
            Invitar
          </button>
        </section>

        {/* Spacer for bottom nav */}
        <div className="h-24" />
      </div>

      {/* Bottom navigation */}
      <nav
        className="home-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-purple-500/20 bg-[#060210]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-md items-end justify-between px-4 pt-2 pb-2 sm:max-w-lg">
          <BottomItem icon={<Home className="h-5 w-5" />} label="INICIO" active />
          <BottomItem icon={<Star className="h-5 w-5" />} label="EVENTOS" to="/eventos" />
          <BottomCenter />
          <BottomItem icon={<Wallet className="h-5 w-5" />} label="DEPÓSITO" to="/pay" />
          <BottomItem icon={<User className="h-5 w-5" />} label="PERFIL" to="/perfil" />
        </div>
      </nav>
    </div>
  );
}

function BottomItem({ icon, label, active, to }: { icon: React.ReactNode; label: string; active?: boolean; to?: string }) {
  const className = `home-bottom-item flex w-14 flex-col items-center gap-1 ${active ? "home-bottom-item--active text-emerald-400" : "text-purple-300/70 hover:text-purple-200"}`;
  if (to) {
    return (
      <Link to={to} className={className}>
        {icon}
        <span className="text-[9px] font-bold tracking-wider">{label}</span>
      </Link>
    );
  }
  return (
    <button className={className}>
      {icon}
      <span className="text-[9px] font-bold tracking-wider">{label}</span>
    </button>
  );
}

function BottomCenter() {
  return (
    <Link to="/ranking" className="home-bottom-center -mt-7 flex w-16 flex-col items-center gap-1">
      <span className="home-bottom-center-circle theme-dark-fixed flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-500/20 bg-[#060210] shadow-lg shadow-purple-900/60">
        <Trophy className="h-7 w-7 text-purple-300/70" strokeWidth={2.2} />
      </span>
      <span className="home-bottom-center-label text-[9px] font-bold tracking-wider text-purple-200">RANKING</span>
    </Link>
  );
}

/* sentinel */
function _unused() {
  return null;
}