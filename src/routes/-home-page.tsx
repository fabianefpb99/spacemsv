import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { shareInvite } from "@/lib/referral-share";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { Menu, ChevronRight, ChevronLeft, Gift, Home, Star, Wallet, User, Trophy, Instagram, ShieldCheck, Lock } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { PromoPopup } from "@/components/PromoPopup";
import { MascotFloater } from "@/components/MascotFloater";
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
import { supabase } from "@/integrations/supabase/client";
import {
  getPublicHomeSlides,
  getPublicFeaturedGames,
} from "@/lib/admin/home-content.functions";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { UserAvatar } from "@/components/UserAvatar";
import { generateRecentFillerWins, type FillerWin } from "@/lib/fillers";
import { getRecentPublicWins, type RecentWin } from "@/lib/recent-wins.functions";
import { getMyFavoriteGames } from "@/lib/favorite-games.functions";
import { useUnlockedAvatars } from "@/hooks/useUnlockedAvatars";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getActiveUsersCount, getActiveUsersList, type ActiveUser } from "@/lib/presence.functions";
import { getHourlyOnlineBase } from "@/lib/online-base";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import astronautRocket from "@/assets/astronaut-rocket.svg";
import heroImg from "@/assets/home-hero.webp";
import heroMinesImg from "@/assets/home-hero-mines.webp";
import heroSlotImg from "@/assets/home-hero-slot.webp";
import heroDiceImg from "@/assets/home-hero-dice.webp";
import heroBlackjackImg from "@/assets/home-hero-blackjack.webp";
import heroRuletaImg from "@/assets/home-hero-ruleta.webp";
import heroArenaImg from "@/assets/home-hero-arena.png.asset.json";
import heroChickenImg from "@/assets/home-hero-chicken.webp.asset.json";
import gameSpacemanAsset from "@/assets/game-spaceman.png.asset.json";
import gameSlotMafiaAsset from "@/assets/game-slot-mafia.png.asset.json";
import gameSlotSamuraiAsset from "@/assets/game-slot-samurai.webp.asset.json";
import gameMinesAsset from "@/assets/game-mines.png.asset.json";
import gameDiceAsset from "@/assets/game-dice.png.asset.json";
import gameBlackjackAsset from "@/assets/game-blackjack.png.asset.json";
import gameBlackjackVipAsset from "@/assets/game-blackjack-vip.png.asset.json";
import gameArenaAsset from "@/assets/game-arena.png.asset.json";
import gameRuletaAsset from "@/assets/game-ruleta.png.asset.json";
import gameChickenAsset from "@/assets/game-chicken.webp.asset.json";
const gameSpaceman = gameSpacemanAsset.url;
const gameSlotMafia = gameSlotMafiaAsset.url;
const gameSlotSamurai = gameSlotSamuraiAsset.url;
const gameMines = gameMinesAsset.url;
const gameDice = gameDiceAsset.url;
const gameBlackjack = gameBlackjackAsset.url;
const gameBlackjackVip = gameBlackjackVipAsset.url;
const gameArena = gameArenaAsset.url;
const gameRuleta = gameRuletaAsset.url;
const gameChicken = gameChickenAsset.url;
import gift3d from "@/assets/gift-3d.webp";

function prettyGameName(g: string): string {
  const k = (g || "").toLowerCase();
  if (k.includes("spaceman")) return "SPACEMAN";
  if (k.includes("mines") || k.includes("minas")) return "MINAS";
  if (k.includes("slot_samurai") || k.includes("samurai")) return "SAMURAI LEGEND";
  if (k.includes("slot")) return "SLOT MAFIA";
  if (k.includes("dice") || k.includes("dado")) return "DADOS";
  if (k.includes("blackjack") && k.includes("vip")) return "BLACKJACK VIP";
  if (k.includes("blackjack")) return "BLACKJACK";
  if (k.includes("arena")) return "ARENA";
  if (k.includes("ruleta") || k.includes("roulette")) return "RULETA";
  return g.toUpperCase();
}
import trophy3d from "@/assets/trophy-3d.webp";
import blackjackPromo from "@/assets/blackjack-promo.png.asset.json";
import blackjackBanner from "@/assets/blackjack-banner.webp";
import jackpotBanner from "@/assets/jackpot-banner.webp";
import ruletaBanner from "@/assets/ruleta-banner.webp";
import casinoIntro from "@/assets/audio/casino-intro.mp3.asset.json";
import mundialHeroAsset from "@/assets/mundial-hero.webp.asset.json";
import { OnlineUsersIcon } from "@/components/OnlineUsersIcon";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function OnlineRotator({ online, username, onClick, clickable }: { online: number; username?: string | null; onClick?: () => void; clickable?: boolean }) {
  const welcome = username
    ? `👋 BIENVENIDO *@${username}*`
    : "👋 BIENVENIDO A *BETSPACE*";
  const phrases = [
    welcome,
    "¿QUE *JUGAREMOS* HOY?",
    "*APUESTA* AHORA",
    "LA *GALAXIA* ESTÁ ABIERTA",
    "Síguenos en *@betspace.app*",
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
        <div
          className={`absolute inset-0 flex items-center justify-between gap-2 px-1 animate-fade-in ${clickable ? "cursor-pointer" : ""}`}
          onClick={clickable ? onClick : undefined}
          role={clickable ? "button" : undefined}
        >
          <span className="inline-flex items-center gap-2">
            <OnlineUsersIcon />
            <span className="home-online-text text-xs font-semibold text-white/90">{online} ONLINE</span>
          </span>
          <span className="home-online-text inline-flex items-center gap-1 text-xs font-medium text-white/90">
            <span className="font-bold">Authentic</span> Games
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M5 12.5l4 4 10-10.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      )}
      <div
        className={`absolute inset-0 flex items-center justify-center ${mode === "phrases" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        {currentRaw.toLowerCase().includes("síguenos") && currentRaw.toLowerCase().includes("betspace.app") ? (
          <a
            href="https://www.instagram.com/betspace.app"
            target="_blank"
            rel="noopener noreferrer"
            key={`${phraseIdx}-${exiting ? "out" : "in"}`}
            className={`inline-flex items-center gap-1 text-[15px] font-semibold tracking-wide text-white light-text-dark whitespace-nowrap ${exiting ? "animate-cube-out" : "animate-cube-in"}`}
            style={{ transformOrigin: "center center", backfaceVisibility: "hidden" }}
          >
            {renderPhrase(currentRaw)}
            <Instagram className="h-4 w-4" />
          </a>
        ) : (
          <span
            key={`${phraseIdx}-${exiting ? "out" : "in"}`}
            className={`text-[15px] font-semibold tracking-wide text-white light-text-dark whitespace-nowrap ${exiting ? "animate-cube-out" : "animate-cube-in"}`}
            style={{ transformOrigin: "center center", backfaceVisibility: "hidden" }}
          >
            {renderPhrase(currentRaw)}
          </span>
        )}
      </div>
    </div>
  );
}

const GAMES = [
  { name: "SPACEMAN", img: gameSpaceman, tag: "POPULAR", tagCls: "bg-purple-600 text-white border-purple-400", to: "/spaceman" },
  { name: "SLOT", img: gameSlotMafia, tag: "NUEVO", tagCls: "bg-emerald-600 text-white border-emerald-400", to: "/slot" },
  { name: "SAMURAI LEGEND", img: gameSlotSamurai, tag: "NUEVO", tagCls: "bg-emerald-600 text-white border-emerald-400", to: "/slotsamurai" },
  { name: "MINAS", img: gameMines, tag: "POPULAR", tagCls: "bg-purple-600 text-white border-purple-400", to: "/mines" },
  { name: "CHICKEN SPACE", img: gameChicken, tag: "NUEVO", tagCls: "bg-emerald-600 text-white border-emerald-400", to: "/chicken" },
  { name: "BLACKJACK", img: gameBlackjack, tag: "POPULAR", tagCls: "bg-purple-600 text-white border-purple-400", to: "/blackjack" },
  { name: "ARENA", img: gameArena, tag: "NUEVO", tagCls: "bg-emerald-600 text-white border-emerald-400", to: "/arena" },
  { name: "RULETA", img: gameRuleta, tag: "CLÁSICO", tagCls: "bg-rose-600 text-white border-rose-400", to: "/ruleta" },
  { name: "BLACKJACK VIP", img: gameBlackjackVip, tag: "VIP", tagCls: "bg-amber-500 text-black border-amber-300", to: "/blackjackvip" },
  { name: "DICE", img: gameDice, tag: "CLÁSICO", tagCls: "bg-rose-600 text-white border-rose-400", to: "/dados" },
];

function formatGameTag(tag: string) {
  if (tag.toUpperCase() === "VIP") return "VIP";
  return tag.toLocaleLowerCase("es-CO").replace(/^./, (char) => char.toLocaleUpperCase("es-CO"));
}

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
    img: heroChickenImg.url,
    eyebrow: "ATRÉVETE EN",
    title: "CHICKEN SPACE",
    desc: "Salta entre asteroides\ny multiplica tu apuesta.",
    cta: "Jugar Chicken",
    to: "/chicken" as const,
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

export function HomePage() {
  const me = useMe();
  const { user, loading: authLoading } = useAuth();
  // Pre-warm the avatar caches (mission:/ vip:) while the user is on Home so
  // entering /perfil doesn't flash the default astronaut before resolving.
  useUnlockedAvatars();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  // Never show a fake demo amount. If not logged in, show a dash; if logged
  // in but balance hasn't arrived yet, also show a dash so we don't flash $0.
  const balanceText = me.data ? formatCOP(me.data.balance + me.data.bonus_balance) : "—";
  // Online = base "inflado" por hora (curva suave 120..1600) + reales activos.
  const [onlineBase, setOnlineBase] = useState<number>(() => getHourlyOnlineBase());
  useEffect(() => {
    // Recalcula al minuto para detectar el cambio de hora sin recargar.
    const t = setInterval(() => setOnlineBase(getHourlyOnlineBase()), 60_000);
    return () => clearInterval(t);
  }, []);
  const fetchActiveCount = useServerFn(getActiveUsersCount);
  const activeCountQ = useQuery({
    queryKey: ["online-active-count"],
    queryFn: () => fetchActiveCount(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const realActive = activeCountQ.data?.count ?? 0;
  const online = onlineBase + realActive;

  // Jackpot acumulado (Supabase). Se incrementa +$125 cada hora vía pg_cron.
  const jackpotQ = useQuery({
    queryKey: ["jackpot-amount"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jackpot_state")
        .select("amount")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.amount ?? 63500);
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const jackpotAmount = jackpotQ.data ?? 63500;
  const [jackpotPulse, setJackpotPulse] = useState(false);

  // Admin-only: clic en el contador para ver la lista de jugadores reales activos.
  const isAdminQ = useIsAdmin();
  const isAdmin = !!isAdminQ.data;
  const [onlineDialogOpen, setOnlineDialogOpen] = useState(false);
  const fetchActiveList = useServerFn(getActiveUsersList);
  const activeListQ = useQuery({
    queryKey: ["online-active-list"],
    queryFn: () => fetchActiveList(),
    enabled: isAdmin && onlineDialogOpen,
    staleTime: 30_000,
  });
  const [slide, setSlide] = useState(0);
  const [arrowsVisible, setArrowsVisible] = useState(true);
  const featuredScrollRef = useRef<HTMLDivElement | null>(null);
  const featuredDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    dragged: boolean;
    axis: "x" | "y" | null;
  }>({ active: false, startX: 0, startY: 0, scrollLeft: 0, dragged: false, axis: null });

  // Wins dinámicos coherentes con el ranking (mismos fillers).
  // Se rotan cada ~25 s para que el panel se sienta vivo.
  // Más fillers + rotación más rápida para que la lista se sienta viva.
  const [winsNowMs, setWinsNowMs] = useState(0);
  const [lastWins, setLastWins] = useState<FillerWin[]>(() =>
    generateRecentFillerWins(20, 0),
  );
  // Genera el primer batch en cliente y luego refresca cada ~12 s.
  // El intervalo se pausa cuando la pestaña está oculta (ahorro CPU/batería).
  useEffect(() => {
    const now = Date.now();
    setWinsNowMs(now);
    setLastWins(generateRecentFillerWins(20, now));
  }, []);
  useVisibleInterval(() => {
    const now = Date.now();
    setWinsNowMs(now);
    setLastWins(generateRecentFillerWins(20, now));
  }, 12_000);

  // Ganancias reales (prioridad sobre fillers). Refresca cada 30 s.
  const fetchRecentWins = useServerFn(getRecentPublicWins);
  const recentWinsQ = useQuery({
    queryKey: ["public-recent-wins"],
    queryFn: () => fetchRecentWins(),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  // Mezcla: combina reales con fillers para que el feed siempre se vea
  // activo. Limitamos los reales (máx 5) para que no opaquen los fillers.
  const mergedWins: FillerWin[] = (() => {
    // Tope realista de multiplicador mostrado por juego (evita 200x+ absurdos
    // en el panel público; el pago real al jugador no cambia).
    const multCap = (game: string): number => {
      const g = game.toLowerCase();
      if (g.includes("mines") || g.includes("minas")) return 8;
      if (g.includes("blackjack")) return 3;
      if (g.includes("ruleta") || g.includes("roulette")) return 14;
      if (g.includes("slot")) return 12;
      if (g.includes("dice") || g.includes("dado")) return 10;
      if (g.includes("spaceman")) return 25;
      if (g.includes("chicken")) return 15;
      return 10;
    };
    const real: FillerWin[] = (recentWinsQ.data ?? []).map((w: RecentWin) => {
      const pretty = prettyGameName(w.game);
      const cap = multCap(pretty);
      const rawMult = w.multiplier > 0 ? w.multiplier : 1;
      const mult = Math.min(rawMult, cap);
      return {
        id: `real:${w.user_id}:${w.created_at}`,
        username: w.username,
        avatar_key: w.avatar_key ?? "avatar-1",
        avatar_url: w.avatar_url ?? null,
        game: pretty,
        amount: Math.round(w.amount),
        mult,
        ageSec: Math.max(0, Math.floor(((winsNowMs || Date.now()) - new Date(w.created_at).getTime()) / 1000)),
      };
    });
    const TARGET = 16;
    const REAL_MAX = 5;
    const realCapped = real.slice(0, REAL_MAX);
    const fillersNeeded = Math.max(0, TARGET - realCapped.length);
    // Intercalamos: 1 real, luego 2 fillers, 1 real, 2 fillers...
    const fillers = lastWins.slice(0, fillersNeeded);
    const out: FillerWin[] = [];
    let ri = 0, fi = 0;
    while (ri < realCapped.length || fi < fillers.length) {
      if (ri < realCapped.length) out.push(realCapped[ri++]);
      for (let k = 0; k < 2 && fi < fillers.length; k++) out.push(fillers[fi++]);
    }
    return out.slice(0, TARGET);
  })();

  const fetchSlides = useServerFn(getPublicHomeSlides);
  const fetchFeatured = useServerFn(getPublicFeaturedGames);
  const slidesQ = useQuery({
    queryKey: ["public-home-slides"],
    queryFn: () => fetchSlides(),
    // Cache home content in memoria por 10 min y reusar entre navegaciones
    // (volver desde un juego no debe refetchear ni mostrar loader).
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const featuredQ = useQuery({
    queryKey: ["public-featured-games"],
    queryFn: () => fetchFeatured(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const slidesList = (slidesQ.data && slidesQ.data.length > 0)
    ? slidesQ.data.map((s) => ({
        img: s.image_url,
        eyebrow: s.eyebrow ?? "",
        title: s.title,
        desc: s.description ?? "",
        cta: s.cta_label ?? "Ver más",
        to: (s.cta_link ?? "/") as "/",
        textHidden: (s as { text_hidden?: boolean }).text_hidden ?? false,
      }))
    : SLIDES.map((s) => ({ ...s, textHidden: false }));

  // El admin es la única fuente de verdad para el orden/posición de juegos
  // destacados. Mientras la query está cargando NO mostramos la lista
  // estática (evita el flicker de posiciones viejas, ej. SLOT MAFIA
  // apareciendo un instante en el slot de SAMURAI). Solo si el backend
  // resolvió y devolvió vacío usamos el fallback estático.
  const gamesList = featuredQ.data
    ? featuredQ.data.length > 0
      ? featuredQ.data.map((g) => ({
          name: g.name,
          img: g.image_url,
          tag: g.tag ?? "POPULAR",
          tagCls: TAG_CLS[g.tag_color ?? "purple"] ?? TAG_CLS.purple,
          to: (g.link ?? "/") as "/",
        }))
      : GAMES
    : [];

  // Tus favoritos: top 4 juegos más jugados por el usuario (solo si jugó >=4)
  const fetchFavorites = useServerFn(getMyFavoriteGames);
  const favoritesQ = useQuery({
    queryKey: ["my-favorite-games", user?.id ?? "anon"],
    queryFn: () => fetchFavorites(),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  const favoriteCards = (() => {
    const data = favoritesQ.data ?? [];
    if (data.length < 4) return [] as typeof gamesList;
    const dbKeyToRoute: Record<string, string> = {
      spaceman: "/spaceman",
      mines: "/mines",
      slot: "/slot",
      slot_samurai: "/slotsamurai",
      chicken: "/chicken",
      blackjack: "/blackjack",
      blackjack_vip: "/blackjackvip",
      arena: "/arena",
      ruleta: "/ruleta",
      dice: "/dados",
    };
    const byRoute = new Map(gamesList.map((g) => [g.to as string, g]));
    const cards: typeof gamesList = [];
    for (const f of data) {
      const route = dbKeyToRoute[f.game.toLowerCase()];
      const card = route ? byRoute.get(route) : undefined;
      if (card && !cards.includes(card)) cards.push(card);
      if (cards.length === 4) break;
    }
    return cards;
  })();

  const slides = slidesList.length;
  const arrowsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El loader del HOME debe ser la primera instancia visible: arranca activo
  // desde el primer render y se apaga después del tiempo mínimo.
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

  // HOME: siempre mostrar el BrandLoader primero. No depende de cache,
  // sessionStorage ni cuotas, para evitar que se vea el contenido antes.
  // Base fija de 1900 ms (recordación de marca). Si al cumplirse la base la
  // sesión aún se está recuperando (caso "hace mucho que no entro"), se
  // extiende como máximo 2500 ms más — con tope duro para no quedar en limbo.
  const [baseElapsed, setBaseElapsed] = useState(false);
  const [loaderHardStop, setLoaderHardStop] = useState(false);
  useEffect(() => {
    const BASE_MS = 1900;
    const MAX_EXTRA_MS = 2500;
    setShowBrandLoader(true);
    const t = setTimeout(() => setBaseElapsed(true), BASE_MS);
    const hard = setTimeout(() => setLoaderHardStop(true), BASE_MS + MAX_EXTRA_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(hard);
    };
  }, []);

  useEffect(() => {
    if (!baseElapsed) return;
    if (authLoading && !loaderHardStop) return;
    setShowBrandLoader(false);
  }, [baseElapsed, loaderHardStop, authLoading]);

  // Al entrar al home, cualquier juego previo queda completamente cerrado.
  useEffect(() => { stopAllGameAudio(); }, []);

  const showArrows = () => {
    setArrowsVisible(true);
    if (arrowsTimer.current) clearTimeout(arrowsTimer.current);
    arrowsTimer.current = setTimeout(() => setArrowsVisible(false), 1500);
  };

  const scrollFeatured = (direction: -1 | 1) => {
    const el = featuredScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.82, behavior: "smooth" });
  };

  const handleFeaturedPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const el = featuredScrollRef.current;
    if (!el) return;
    featuredDragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: el.scrollLeft,
      dragged: false,
      axis: null,
    };
  };

  const handleFeaturedPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const drag = featuredDragRef.current;
    const el = featuredScrollRef.current;
    if (!drag.active || !el) return;
    const delta = event.clientX - drag.startX;
    const verticalDelta = event.clientY - drag.startY;
    if (!drag.axis && Math.max(Math.abs(delta), Math.abs(verticalDelta)) > 10) {
      drag.axis = Math.abs(delta) > Math.abs(verticalDelta) ? "x" : "y";
    }
    if (drag.axis === "y") return;
    if (drag.axis === "x" && Math.abs(delta) > 16) {
      drag.dragged = true;
      el.scrollLeft = drag.scrollLeft - delta;
    }
  };

  const stopFeaturedDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    featuredDragRef.current.active = false;
    featuredDragRef.current.axis = null;
    setTimeout(() => {
      featuredDragRef.current.dragged = false;
    }, 0);
  };

  useEffect(() => {
    const el = featuredScrollRef.current;
    if (!el) return;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      featuredDragRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        scrollLeft: el.scrollLeft,
        dragged: false,
        axis: null,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const drag = featuredDragRef.current;
      const touch = event.touches[0];
      if (!drag.active || !touch) return;
      const delta = touch.clientX - drag.startX;
      const verticalDelta = touch.clientY - drag.startY;
      if (!drag.axis && Math.max(Math.abs(delta), Math.abs(verticalDelta)) > 6) {
        drag.axis = Math.abs(delta) > Math.abs(verticalDelta) ? "x" : "y";
      }
      if (drag.axis === "y") return;
      if (drag.axis === "x" && Math.abs(delta) > 8) {
        drag.dragged = true;
        el.scrollLeft = drag.scrollLeft - delta;
      }
      event.preventDefault();
    };

    const stopTouchDrag = () => {
      featuredDragRef.current.active = false;
      featuredDragRef.current.axis = null;
      // Reset dragged shortly after so the next tap isn't blocked
      setTimeout(() => {
        featuredDragRef.current.dragged = false;
      }, 0);
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", stopTouchDrag);
    el.addEventListener("touchcancel", stopTouchDrag);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", stopTouchDrag);
      el.removeEventListener("touchcancel", stopTouchDrag);
    };
  }, [gamesList.length]);

  useVisibleInterval(
    () => setSlide((s) => (s + 1) % slidesList.length),
    slidesList.length > 1 ? 5000 : null,
  );

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
    <div className="min-h-screen bg-[#060210] text-white lg:pl-[260px]">
      <BrandLoader active={showBrandLoader} minMs={1900} />
      <PromoPopup />
      <MascotFloater />
      <DesktopSidebar />
      {/* Header — full width del shell, pegado a los bordes */}
      <header
        className="flex w-full flex-col items-center justify-center bg-[#060210] border-b border-purple-500/20 pb-3 px-3 [--hdr-pt:0.4rem] lg:h-[61px] lg:pb-0 lg:[--hdr-pt:0rem] xl:px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + var(--hdr-pt))" }}
      >
          <div className="flex w-full items-center justify-between xl:mx-auto xl:max-w-[1440px]">
            <div className="flex items-center gap-1">
              <div className="lg:hidden">
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
              </div>
              <Link to="/" className="logo-shine lg:hidden!">
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
      <div className="xl:mx-auto xl:flex xl:w-full xl:max-w-[1440px] xl:items-start xl:gap-6 xl:px-6">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6 pt-0 sm:max-w-lg sm:px-4 lg:max-w-3xl lg:px-6 xl:mx-0 xl:min-w-0 xl:max-w-none xl:flex-1 xl:px-0">
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      <h1 className="sr-only">
        BETSPACE — Casino Online y Apuestas en Colombia
      </h1>

      {/* Online indicator / rotating tagline */}
        <OnlineRotator
          online={online}
          clickable={isAdmin}
          onClick={() => setOnlineDialogOpen(true)}
          username={
            user
              ? (me.data?.profile?.username ??
                  (user.user_metadata?.full_name as string | undefined) ??
                  (user.email ? user.email.split("@")[0] : null))
              : null
          }
        />

        <Dialog open={onlineDialogOpen} onOpenChange={setOnlineDialogOpen}>
          <DialogContent className="max-w-md theme-dark-fixed border-violet-800/60 bg-[#0f0820] text-white">
            <DialogHeader>
              <DialogTitle className="text-white">
                Jugadores reales conectados ({realActive})
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 max-h-[60vh] overflow-y-auto">
              {activeListQ.isLoading ? (
                <div className="py-6 text-center text-sm text-white/60">Cargando…</div>
              ) : !activeListQ.data || activeListQ.data.length === 0 ? (
                <div className="py-6 text-center text-sm text-white/60">
                  No hay jugadores activos en los últimos 10 minutos.
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {activeListQ.data.map((u: ActiveUser) => (
                    <li key={u.user_id} className="flex items-center gap-3 py-2">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-white/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">
                          @{u.username ?? u.user_id.slice(0, 6)}
                        </div>
                        <div className="truncate text-[11px] text-white/50">
                          {u.last_game ? `Jugando: ${prettyGameName(u.last_game)}` : "Actividad reciente"}
                        </div>
                      </div>
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 text-[10px] text-white/40">
                Base mostrada: {onlineBase} (curva horaria) · Reales: {realActive}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Hero banner */}
        <section className="theme-dark-fixed slider-neon-frame mt-[10px] overflow-hidden rounded-2xl border border-violet-800/50 bg-[#120824] shadow-[0_0_10px_rgba(76,29,149,0.35)]">
          <div
            className="relative h-[196px] touch-pan-y select-none sm:h-[231px] lg:h-[305px] xl:h-[402px]"
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
                width={1200}
                height={520}
                loading={i === slide ? "eager" : "lazy"}
                fetchPriority={i === slide ? "high" : undefined}
                wrapperClassName={`absolute inset-0 z-0 h-full w-full transition-opacity duration-700 ${i === slide ? "opacity-100" : "opacity-0"}`}
                className="h-full w-full object-cover"
              />
            ))}
            {/* Flechas de navegación */}
            <button
              onClick={() => { showArrows(); setSlide((s) => (s - 1 + slidesList.length) % slidesList.length); }}
              aria-label="Anterior"
              className={`hero-slider-arrow absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-opacity duration-500 ${arrowsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => { showArrows(); setSlide((s) => (s + 1) % slidesList.length); }}
              aria-label="Siguiente"
              className={`hero-slider-arrow absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-opacity duration-500 ${arrowsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {/* Desvanecido sutil izquierda -> derecha para legibilidad del texto */}
            {!current.textHidden && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1]"
                style={{
                  background:
                    "linear-gradient(to right, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.58) 12%, rgba(0,0,0,0.42) 20%, rgba(0,0,0,0.36) 25%, rgba(0,0,0,0.22) 36%, rgba(0,0,0,0.10) 46%, rgba(0,0,0,0) 56%)",
                }}
              />
            )}
            {current.textHidden ? (
              <Link
                to={current.to}
                aria-label={current.title}
                className="absolute inset-0 z-[2]"
              />
            ) : (
            <div key={slide} className="absolute inset-0 z-[2] flex flex-col justify-center gap-1 p-4 pt-7 pb-10 sm:p-5 sm:pt-8 sm:pb-12 lg:gap-2 lg:p-8 lg:pt-9 lg:pb-14 xl:gap-2 xl:p-10 xl:pt-10 xl:pb-16">
              <span className="inline-flex w-fit items-center rounded-md bg-white/95 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-purple-700 shadow-sm lg:px-3 lg:py-1 lg:text-[11px] xl:text-[13px]">
                {current.eyebrow}
              </span>
              <h2 className="font-display text-[1.4rem] font-black leading-tight tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] sm:text-[1.75rem] lg:text-[2.6rem] xl:text-[3.3rem]">
                {current.title}
              </h2>
              <p className="max-w-[55%] whitespace-pre-line text-[11px] text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[13px] lg:max-w-[48%] lg:text-[15px] xl:text-[17px]">
                {current.desc}
              </p>
              <Link
                to={current.to}
                className="inline-flex w-fit items-center justify-center rounded-md bg-purple-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/50 transition hover:bg-purple-500 lg:px-6 lg:py-3 lg:text-[13px] xl:px-7 xl:text-[15px]"
              >
                {current.cta}
              </Link>
            </div>
            )}
            {/* Sombreado inferior muy bajo y sutil solo para resaltar los indicadores */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-5 bg-gradient-to-t from-[#120824]/40 via-[#120824]/10 to-transparent sm:h-6 lg:h-7"
            />
            {/* Indicadores sobre la imagen */}
            <div className="absolute inset-x-0 bottom-0 z-[3] flex items-center justify-center gap-1.5 py-2">
              {Array.from({ length: slides }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === slide ? "w-4 bg-purple-400" : "w-1.5 bg-purple-200/30"}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Featured games */}
        <section className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white light-text-dark">
              Juegos destacados
            </h3>
            <Link
              to="/games"
              className="ver-todos-btn inline-flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-200 transition hover:bg-purple-500/20 hover:text-white"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label="Ver juegos anteriores"
              onClick={() => scrollFeatured(-1)}
              className="absolute -left-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition hover:bg-black/85 sm:flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              ref={featuredScrollRef}
              onPointerDown={handleFeaturedPointerDown}
              onPointerMove={handleFeaturedPointerMove}
              onPointerUp={stopFeaturedDrag}
              onPointerCancel={stopFeaturedDrag}
              onClickCapture={(event) => {
                if (!featuredDragRef.current.dragged) return;
                event.preventDefault();
                event.stopPropagation();
                featuredDragRef.current.dragged = false;
              }}
              className="home-featured-scroll mt-3 flex cursor-grab touch-pan-x select-none gap-2 overflow-x-auto pb-1 active:cursor-grabbing sm:gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {gamesList.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={`featured-skeleton-${i}`}
                      className="relative flex aspect-[3/4] w-[27%] min-w-[27%] flex-shrink-0 overflow-hidden rounded-xl border border-fuchsia-500/25 bg-[#0c0620] sm:w-[19%] sm:min-w-[19%]"
                      aria-hidden="true"
                    >
                      <div className="skeleton absolute inset-0 h-full w-full" />
                      <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-1.5 px-2">
                        <div className="skeleton h-2 w-4/5 rounded-full" />
                        <div className="skeleton h-2 w-1/2 rounded-full" />
                      </div>
                    </div>
                  ))
                : gamesList.map((g, i) => {
                const gameName = g.name;
                const gameTag = formatGameTag(g.tag);
                return (
                  <Link
                    key={`${g.to}-${g.name}`}
                    to={g.to}
                    style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                    className="home-game-card home-game-card-enter group relative flex aspect-[3/4] w-[27%] min-w-[27%] flex-shrink-0 overflow-hidden rounded-xl border border-fuchsia-500/70 bg-[#0c0620] shadow-[0_0_8px_rgba(217,70,239,0.25)] transition hover:border-fuchsia-400 sm:w-[19%] sm:min-w-[19%]"
                  >
                    <SkeletonImage
                      src={g.img}
                      alt={gameName}
                      loading="lazy"
                      width={512}
                      height={680}
                      wrapperClassName="absolute inset-0 h-full w-full"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/70 to-transparent" />
                    <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-1 px-1.5 text-center">
                      <span className="home-game-title block w-full whitespace-pre-line font-display font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] text-[11px] leading-[0.9] sm:text-[12px] sm:leading-[0.95]">
                        {gameName}
                      </span>
                      <span className={`inline-block rounded-full border px-2 py-[2px] text-[8px] font-bold uppercase leading-none tracking-wide ${g.tagCls}`}>
                        {gameTag}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Ver más juegos"
              onClick={() => scrollFeatured(1)}
              className="absolute -right-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition hover:bg-black/85 sm:flex"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
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
              <div className="promo-banner__tag mt-1 inline-block rounded-sm bg-purple-600/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                Paga 3 a 2
              </div>
            </div>
            <span className="home-promo-arrow promo-banner__chev promo-banner__chev--glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
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
            <span className="home-promo-arrow promo-banner__chev promo-banner__chev--glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
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
              <div className="promo-banner__tag mt-1 inline-block rounded-sm bg-purple-600/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                Paga hasta 8.0x
              </div>
            </div>
            <span className="home-promo-arrow promo-banner__chev promo-banner__chev--glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Jackpot — banner estilo BlackJack */}
        <button
          type="button"
          onClick={() => {
            setJackpotPulse(false);
            requestAnimationFrame(() => setJackpotPulse(true));
            window.setTimeout(() => setJackpotPulse(false), 1200);
          }}
          className={`promo-banner promo-banner--jackpot relative mt-3 block h-24 w-full overflow-hidden rounded-xl border border-amber-400/70 text-left shadow-[0_0_12px_rgba(251,191,36,0.3)] transition hover:shadow-[0_0_22px_rgba(251,191,36,0.6)] sm:h-28${jackpotPulse ? " jackpot-pulse" : ""}`}
        >
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
                Jackpot activo hoy
              </div>
              <div className="promo-banner__title mt-0.5 font-display text-2xl font-black leading-none tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] sm:text-3xl">
                <span className="neon-green mr-1 text-xl sm:text-2xl">$</span>
                {formatCOP(jackpotAmount)}
              </div>
              <div className="promo-banner__tag promo-banner__tag--amber mt-1 inline-block rounded-sm bg-amber-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                Premio acumulado
              </div>
            </div>
          </div>
        </button>

        {/* Actividad en vivo · Últimas ganancias */}
        <section className="home-wins-panel mt-6 overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#0c041e] to-[#0c0620] shadow-[0_10px_30px_-15px_rgba(139,92,246,0.45)]">
          <header className="home-wins-header relative px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="home-wins-live-badge flex shrink-0 items-center gap-1.5 rounded-full border border-transparent px-2 py-1">
                <span className="home-wins-live-dot relative inline-flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]" />
                </span>
                <span className="home-wins-live text-[9px] font-bold uppercase tracking-widest text-rose-300">
                  En vivo
                </span>
              </div>
              <span className="home-wins-chip shrink-0 rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-purple-200">
                Últimas ganancias
              </span>
            </div>
            <h2 className="home-wins-title mt-2 font-display text-lg font-black uppercase leading-none tracking-wide text-white sm:text-xl">
              Actividad en vivo
            </h2>
            <p className="home-wins-sub mt-1.5 text-[11px] font-medium leading-tight text-purple-200/70 sm:text-xs">
              La comunidad sigue jugando y ganando
            </p>
            <div className="home-wins-divider mt-4 h-px w-full bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
          </header>

          <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div
            className="home-wins-viewport relative overflow-hidden"
            style={{
              height: "calc(4 * 52px)",
            }}
          >
            <ul
              className="flex flex-col gap-2"
              style={{ animation: `wins-scroll ${mergedWins.length * 2.2}s linear infinite` }}
            >
              {[...mergedWins, ...mergedWins].map((w, i) => (
                <li
                  key={`${w.id}-${i}`}
                  className="home-win-row flex h-[44px] items-center gap-3 rounded-lg border border-purple-500/20 bg-[#150830]/60 px-2.5"
                >
                  <div className="home-win-avatar h-8 w-8 shrink-0 overflow-hidden rounded-full bg-purple-600/30 ring-1 ring-purple-400/30">
                    <UserAvatar avatarKey={w.avatar_key} avatarUrl={w.avatar_url} alt={w.username} spinnerSize="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="home-win-user truncate text-xs font-semibold text-white">{w.username}</div>
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
              ))}
            </ul>
          </div>
          </div>
          <style>{`
            @keyframes wins-scroll {
              0% { transform: translateY(0); }
              100% { transform: translateY(calc(-${mergedWins.length} * 52px)); }
            }
            .home-win-avatar-img { opacity: 0; transition: opacity 280ms ease-out; }
            .home-win-avatar-img.is-loaded,
            .home-win-avatar-img[data-image-ready="true"] { opacity: 1; }
          `}</style>
        </section>

        {/* Deportes — banner promocional */}
        <Link
          to="/deportes"
          className="promo-banner promo-banner--deportes relative mt-5 block h-24 overflow-hidden rounded-xl border border-purple-400/70 shadow-[0_0_12px_rgba(168,85,247,0.3)] transition hover:shadow-[0_0_22px_rgba(168,85,247,0.6)] sm:h-28"
        >
          <SkeletonImage
            src={mundialHeroAsset.url}
            alt="Deportes"
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
                Deportes
              </div>
              <div className="promo-banner__tag mt-1 inline-block rounded-sm bg-purple-600/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                Mundial 2026
              </div>
            </div>
            <span className="home-promo-arrow promo-banner__chev promo-banner__chev--glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Tus favoritos */}
        {favoriteCards.length === 4 && (
          <section className="mt-5">
            <div className="flex items-end justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white light-text-dark">
                Tus favoritos
              </h3>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
              {favoriteCards.map((g) => {
                const gameName = g.name;
                const gameTag = formatGameTag(g.tag);
                return (
                  <Link
                    key={`fav-${g.to}-${g.name}`}
                    to={g.to}
                    className="home-game-card group relative flex aspect-[3/4] overflow-hidden rounded-xl border border-fuchsia-500/70 bg-[#0c0620] shadow-[0_0_8px_rgba(217,70,239,0.25)] transition hover:border-fuchsia-400"
                  >
                    <SkeletonImage
                      src={g.img}
                      alt={gameName}
                      loading="lazy"
                      width={512}
                      height={680}
                      wrapperClassName="absolute inset-0 h-full w-full"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/70 to-transparent" />
                    <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-1 px-1.5 text-center">
                      <span className="home-game-title block w-full whitespace-pre-line font-display font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] text-[11px] leading-[0.9] sm:text-[12px] sm:leading-[0.95]">
                        {gameName}
                      </span>
                      <span className={`inline-block rounded-full border px-2 py-[2px] text-[8px] font-bold uppercase leading-none tracking-wide ${g.tagCls}`}>
                        {gameTag}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

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
          <button
            type="button"
            onClick={async () => {
              const code = user ? me.data?.profile?.referral_code ?? null : null;
              const result = await shareInvite(code);
              if (result === "copied") {
                toast.success("Enlace copiado", {
                  description: code ? "Tu enlace de invitación está listo para compartir." : "Comparte el enlace de BetSpace.",
                });
              }
            }}
            className="home-invite-btn rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/50 hover:bg-purple-500"
          >
            Invitar
          </button>
        </section>

        {/* Juego responsable */}
        <section className="home-responsible mt-5">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
            <div className="home-responsible-shield relative flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/30 bg-[#0c0620]">
              <ShieldCheck className="h-6 w-6 text-purple-300" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-start gap-4 sm:gap-5">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />
              <div className="min-w-0">
                <div className="home-responsible-title font-display text-[11px] font-black uppercase tracking-wider text-white leading-tight">
                  Juega responsablemente
                </div>
                <p className="home-responsible-desc mt-1 text-[10px] leading-snug text-purple-200/70">
                  Apuesta con control. Establece límites de tiempo y dinero.
                </p>
              </div>
            </div>

            <ResponsibleBadge
              icon={<span className="font-display text-[11px] font-black leading-none">18+</span>}
              label={"Solo\nmayores"}
            />
            <ResponsibleBadge
              icon={<Lock className="h-3.5 w-3.5" />}
              label={"Datos\nseguros"}
            />
          </div>
        </section>

        {/* Spacer for bottom nav */}
        <div className="h-24" />
      </div>

        {/* Rail derecho — solo escritorio (fase 1: espacios reservados) */}
        <aside className="hidden xl:sticky xl:top-4 xl:block xl:w-[320px] xl:shrink-0 xl:space-y-4 xl:pt-4">
          <DesktopRailPlaceholder title="Jackpot" height={280} />
          <DesktopRailPlaceholder title="Giros gratis" height={200} />
          <DesktopRailPlaceholder title="Espacio reservado" height={160} />
        </aside>
      </div>

      {/* Bottom navigation */}
      <nav
        className="home-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-purple-500/20 bg-[#060210]/95 backdrop-blur lg:hidden"
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

function DesktopRailPlaceholder({ title, height }: { title: string; height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-purple-400/40 bg-gradient-to-b from-purple-700/25 to-fuchsia-700/10 text-center"
      style={{ height }}
    >
      <span className="font-display text-xs font-black uppercase tracking-[0.18em] text-purple-200/80">
        {title}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-purple-300/50">Espacio reservado</span>
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

function ResponsibleBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="home-responsible-badge flex flex-col items-center gap-1.5 text-center">
      <div className="home-responsible-badge-icon flex h-8 w-8 items-center justify-center rounded-full border border-purple-500/40 bg-[#0c0620] text-purple-200">
        {icon}
      </div>
      <span className="home-responsible-badge-label whitespace-pre-line text-[9px] font-bold uppercase leading-[1.15] tracking-wide text-purple-200/70">
        {label}
      </span>
    </div>
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