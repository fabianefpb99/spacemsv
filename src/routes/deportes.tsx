import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, Home, Star, Wallet, User, Trophy, Calendar, Clock, ChevronRight, Ticket } from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import stadiumBg from "@/assets/stadium-bg.webp";
import mundialHeroAsset from "@/assets/mundial-hero.webp.asset.json";
import { AuthControl } from "@/components/auth/AuthControl";
import { AddBalanceButton } from "@/components/layout/AddBalanceButton";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getMySportsBets, type MyBetRow } from "@/lib/sports/bet.functions";
import { flagSvgUrl } from "@/lib/sports/world-cup-2026-teams";

export const Route = createFileRoute("/deportes")({
  head: () => ({
    meta: [
      { title: "Apuestas Deportivas Mundial 2026 | BETSPACE Colombia" },
      {
        name: "description",
        content:
          "Apuesta en los partidos del Mundial 2026 desde BETSPACE. Cuotas claras y experiencia simple, sin complicaciones.",
      },
      { property: "og:title", content: "Apuestas Deportivas Mundial 2026 | BETSPACE Colombia" },
      {
        property: "og:description",
        content:
          "Apuesta en los partidos del Mundial 2026 desde BETSPACE. Cuotas claras y experiencia simple, sin complicaciones.",
      },
      { property: "og:url", content: "https://betspace.app/deportes" },
    ],
    links: [{ rel: "canonical", href: "https://betspace.app/deportes" }],
  }),
  component: DeportesPage,
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9.25" />
      <polygon points="12,7.2 15.6,9.9 14.25,14.1 9.75,14.1 8.4,9.9" fill="currentColor" stroke="none" />
      <path d="M12 2.75 12 7.2 M21.25 12 15.6 9.9 M18.5 19 14.25 14.1 M5.5 19 9.75 14.1 M2.75 12 8.4 9.9" />
    </svg>
  );
}

function Flag({ code, name }: { code: string; name: string }) {
  return (
    <img
      src={flagSvgUrl(code)}
      alt={`Bandera de ${name}`}
      loading="lazy"
      className="block h-full w-full object-cover"
    />
  );
}

/**
 * Preloads the two flag images and resolves once both are ready (or on error),
 * so the whole match card can fade in as a single unit instead of drawing in
 * pieces while flags stream in.
 */
function useFlagsReady(codes: string[]): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const urls = codes.map(flagSvgUrl);
    const promises = urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          const done = () => resolve();
          img.onload = done;
          img.onerror = done;
          img.src = url;
          if (img.complete) done();
        }),
    );
    // Failsafe: never keep the card hidden longer than 1200ms
    const cap = setTimeout(() => !cancelled && setReady(true), 1200);
    Promise.all(promises).then(() => {
      if (!cancelled) setReady(true);
      clearTimeout(cap);
    });
    return () => {
      cancelled = true;
      clearTimeout(cap);
    };
  }, [codes.join("|")]);
  return ready;
}

type PublicMatch = {
  id: string;
  competition: string;
  date: string;
  time: string;
  live: boolean;
  home: { name: string; code: string };
  away: { name: string; code: string };
  odds: { home: string; draw: string; away: string };
};

const TZ = "America/Bogota";

function formatMatchDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const now = new Date();
  const dayFmt = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, day: "2-digit", month: "short" });
  const timeFmt = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const dayKey = (x: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const todayKey = dayKey(now);
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowKey = dayKey(tomorrow);
  const matchKey = dayKey(d);
  let label: string;
  if (matchKey === todayKey) label = "Hoy";
  else if (matchKey === tomorrowKey) label = "Mañana";
  else label = dayFmt.format(d);
  return { date: label, time: timeFmt.format(d) };
}

function usePublishedMatches() {
  return useQuery({
    queryKey: ["public-sports-matches"],
    queryFn: async (): Promise<PublicMatch[]> => {
      const { data, error } = await supabase
        .from("sports_matches")
        .select(
          "id, home_name, home_flag_code, away_name, away_flag_code, start_at, status, odds_home, odds_draw, odds_away, competition:sports_competitions(name)"
        )
        .eq("is_published", true)
        .in("status", ["scheduled", "live"])
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => {
        const { date, time } = formatMatchDate(r.start_at);
        return {
          id: r.id,
          competition: (r.competition?.name ?? "").toUpperCase() || "DEPORTES",
          date,
          time,
          live: r.status === "live",
          home: { name: r.home_name, code: r.home_flag_code },
          away: { name: r.away_name, code: r.away_flag_code },
          odds: {
            home: Number(r.odds_home).toFixed(2),
            draw: Number(r.odds_draw).toFixed(2),
            away: Number(r.odds_away).toFixed(2),
          },
        };
      });
    },
    staleTime: 30_000,
  });
}

function DeportesPage() {
  const { user, loading: authLoading } = useAuth();
  const me = useMe();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [selector, setSelector] = useState<"futbol" | "mundial" | "mias">("mundial");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem("sports.openMias") === "1") {
        window.sessionStorage.removeItem("sports.openMias");
        setSelector("mias");
      }
    } catch {
      /* ignore */
    }
  }, []);
  const balanceText = me.data ? formatCOP(me.data.balance) : "—";
  const matchesQuery = usePublishedMatches();
  const matches = matchesQuery.data ?? [];

  // Contador de apuestas activas por partido (solo pending) para el usuario logueado.
  const getMyBets = useServerFn(getMySportsBets);
  const myBetsQuery = useQuery({
    queryKey: ["my-sports-bets", user?.id ?? null],
    enabled: !authLoading && !!user,
    staleTime: 15_000,
    queryFn: async () => (await getMyBets()).bets,
  });
  const pendingByMatch = (myBetsQuery.data ?? []).reduce<Record<string, number>>((acc, b) => {
    if (b.status === "pending") acc[b.match_id] = (acc[b.match_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col pt-4 sm:max-w-lg">
        {/* Header (idéntico al de Home/Eventos) */}
        <header
          className="flex flex-col items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mt-4"
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
              <Link to="/" className="logo-shine">
                <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7 translate-y-px" />
                <img src={betspaceLogo} alt="" aria-hidden="true" className="logo-shine-overlay h-6 w-auto sm:h-7 translate-y-px" />
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
                  <AddBalanceButton />
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

        {/* Hero banner Mundial 2026 (ancho completo del contenedor, como el slider del Home) */}
        <section className="theme-dark-fixed relative w-full overflow-hidden bg-[#0c0620]">
          <div className="relative h-52 w-full sm:h-60">
            <img
              src={mundialHeroAsset.url}
              alt="Mundial 2026 — Apuestas deportivas BETSPACE"
              width={1600}
              height={640}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#060210]/85 via-[#060210]/45 to-transparent"
            />
            <div className="absolute inset-0 flex flex-col justify-center pl-6 pr-4 sm:pl-8 sm:pr-5">
              <span className="inline-flex w-max items-center whitespace-nowrap rounded-full border border-purple-400/60 bg-purple-500/15 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest text-purple-100 backdrop-blur">
                Zona deportiva
              </span>
              <h1 className="mt-2 font-display text-2xl font-black tracking-[0.14em] text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] sm:text-3xl">
                MUNDIAL 2026
              </h1>
              <div className="mt-1 h-[3px] w-14 rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-500" />
              <p className="mt-2 max-w-[62%] text-[11px] font-medium leading-snug text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] sm:text-xs">
                Los mejores partidos del mundo, en un solo lugar.
              </p>
            </div>
          </div>
        </section>

        {/* Contenido con padding lateral */}
        <div className="px-3 pb-28 sm:px-4">
          {/* Selector flotante Fútbol / Mundial 2026 / Mis apuestas (superpuesto ~50% al banner) */}
          <div className="relative z-10 -mt-10 grid grid-cols-[2fr_2fr_1fr] gap-1.5 rounded-2xl border border-purple-500/30 bg-[#0c0620]/95 p-1.5 shadow-[0_14px_36px_-12px_rgba(168,85,247,0.6)] backdrop-blur">
            {/* Selector: en modo oscuro fondo navy; en modo claro fondo blanco (ver styles.css) */}
            <button
              type="button"
              onClick={() => setSelector("futbol")}
              className={`sports-selector-btn flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wider transition ${
                selector === "futbol"
                  ? "sports-selector-btn--active bg-gradient-to-b from-purple-600 to-fuchsia-700 text-white shadow-[0_0_14px_rgba(168,85,247,0.55)]"
                  : "text-purple-200/80 hover:text-white hover:bg-white/5"
              }`}
            >
              <SoccerBallIcon className="h-4 w-4" />
              <span>Fútbol</span>
            </button>
            <button
              type="button"
              onClick={() => setSelector("mundial")}
              className={`sports-selector-btn flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wider transition ${
                selector === "mundial"
                  ? "sports-selector-btn--active bg-gradient-to-b from-purple-600 to-fuchsia-700 text-white shadow-[0_0_14px_rgba(168,85,247,0.55)]"
                  : "text-purple-200/80 hover:text-white hover:bg-white/5"
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Mundial 2026</span>
            </button>
            <button
              type="button"
              onClick={() => setSelector("mias")}
              aria-label="Mis apuestas"
              title="Mis apuestas"
              className={`sports-selector-btn flex items-center justify-center rounded-xl px-2 py-2.5 transition ${
                selector === "mias"
                  ? "sports-selector-btn--active bg-gradient-to-b from-purple-600 to-fuchsia-700 text-white shadow-[0_0_14px_rgba(168,85,247,0.55)]"
                  : "text-purple-200/80 hover:text-white hover:bg-white/5"
              }`}
            >
              <Ticket className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>

          {selector === "mias" ? (
            <MyBetsSection onOpenAuth={() => setAuthDialogOpen(true)} />
          ) : (
            <section className="mt-6">
              <h2 className="font-display text-sm font-black uppercase tracking-[0.14em] text-white">
                Partidos destacados
              </h2>

              <div className="mt-3 flex flex-col gap-3">
                {matchesQuery.isLoading ? (
                  <div className="rounded-2xl border border-purple-500/20 bg-[#0c0620]/60 p-4 text-center text-[11px] text-purple-200/70">
                    Cargando partidos…
                  </div>
                ) : matches.length === 0 ? (
                  <div className="rounded-2xl border border-purple-500/20 bg-[#0c0620]/60 p-4 text-center text-[11px] text-purple-200/70">
                    No hay partidos programados por ahora. Vuelve pronto.
                  </div>
                ) : (
                  matches.map((m) => (
                    <MatchCard key={m.id} match={m} myBetsCount={pendingByMatch[m.id] ?? 0} />
                  ))
                )}
              </div>
            </section>
          )}

          {/* Aviso responsable */}
          <section className="mt-5">
          <div className="flex items-center gap-3 rounded-2xl border border-purple-500/25 bg-[#0c0620]/80 px-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-700 shadow-[0_0_10px_rgba(168,85,247,0.55)]">
              <Trophy className="h-4 w-4 text-white" />
            </span>
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-purple-100/80">
              Las cuotas pueden cambiar en cualquier momento. Apuesta responsablemente.
            </p>
            <ChevronRight className="h-4 w-4 shrink-0 text-purple-300/70" />
          </div>
          </section>

          <div className="h-16" />
        </div>
      </div>

      {/* Bottom nav (idéntico al del resto de la app) */}
      <nav
        className="home-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-purple-500/20 bg-[#060210]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-md items-end justify-between px-4 pt-2 pb-2 sm:max-w-lg">
          <BottomItem icon={<Home className="h-5 w-5" />} label="INICIO" to="/" />
          <BottomItem icon={<Star className="h-5 w-5" />} label="EVENTOS" to="/eventos" />
          <BottomCenter />
          <BottomItem icon={<Wallet className="h-5 w-5" />} label="DEPÓSITO" to="/pay" />
          <BottomItem icon={<User className="h-5 w-5" />} label="PERFIL" to="/perfil" />
        </div>
      </nav>
    </div>
  );
}

function MatchCard({ match, myBetsCount = 0 }: { match: PublicMatch; myBetsCount?: number }) {
  const ready = useFlagsReady([match.home.code, match.away.code]);
  return (
    <Link
      to="/deportes/$matchId"
      params={{ matchId: match.id }}
      aria-label={`${match.home.name} vs ${match.away.name} — ${match.competition}`}
      className="theme-dark-fixed group relative block overflow-hidden rounded-2xl border border-purple-500/30 bg-[#0c0620]/90 p-3 shadow-[0_0_16px_rgba(76,29,149,0.25)] transition hover:border-fuchsia-400/60 hover:shadow-[0_0_18px_rgba(217,70,239,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 sm:p-4"
      style={{
        opacity: ready ? 1 : 0,
        transform: ready ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 420ms ease-out, transform 420ms ease-out",
        pointerEvents: ready ? undefined : "none",
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <img src={stadiumBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.10]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c0620]/95 via-[#150830]/92 to-[#0c0620]/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.35),transparent_65%)]" />
      </div>
      <div className="relative z-10">
      {/* Fila superior: info a la izquierda, estado/apuestas a la derecha */}
      <div className="flex items-center justify-between gap-1.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 rounded-full border border-purple-400/50 bg-purple-500/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-purple-100">
            {match.competition}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold text-purple-100/80">
            <Calendar className="h-3 w-3 text-purple-300/80" />
            {match.date}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold text-purple-100/80">
            <Clock className="h-3 w-3 text-purple-300/80" />
            {match.time}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {myBetsCount > 0 && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.35)]"
              title={myBetsCount === 1 ? "Tienes 1 apuesta activa en este partido" : `Tienes ${myBetsCount} apuestas activas en este partido`}
            >
              <Ticket className="h-2.5 w-2.5" strokeWidth={2.5} />
              {myBetsCount === 1 ? "TU APUESTA: 1" : `TUS APUESTAS: ${myBetsCount}`}
            </span>
          )}
          {match.live && (
            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/60 bg-fuchsia-500/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-fuchsia-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-300 shadow-[0_0_6px_rgba(240,171,252,0.9)]" />
              En vivo
            </span>
          )}
        </div>
      </div>

      <div className="mt-1.5 h-px w-full bg-purple-500/20" />

      {/* Equipos */}
      <div className="mt-3 grid grid-cols-3 items-center gap-2">
        <div className="flex flex-col items-center gap-1.5">
          <span className="flex h-9 w-[52px] items-center justify-center overflow-hidden rounded-md ring-1 ring-white/10 shadow-inner">
            <Flag code={match.home.code} name={match.home.name} />
          </span>
          <span className="whitespace-nowrap text-center text-xs font-bold text-white">
            {match.home.name}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-display text-xl font-black tracking-wider text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.55)]">
            VS
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="flex h-9 w-[52px] items-center justify-center overflow-hidden rounded-md ring-1 ring-white/10 shadow-inner">
            <Flag code={match.away.code} name={match.away.name} />
          </span>
          <span className="whitespace-nowrap text-center text-xs font-bold text-white">
            {match.away.name}
          </span>
        </div>
      </div>

      {/* Cuotas 1 X 2 */}
      <div className="mt-2 rounded-xl border border-purple-500/25 bg-[#150830]/70 p-1.5">
        <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-widest text-purple-200/70">
          1X2 · Resultado final
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <OddChip label="1" value={match.odds.home} />
          <OddChip label="X" value={match.odds.draw} />
          <OddChip label="2" value={match.odds.away} />
        </div>
      </div>
      </div>
    </Link>
  );
}

function OddChip({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      className="sports-odd-chip flex flex-col items-center justify-center gap-0.5 rounded-lg border border-purple-500/25 bg-[#0c0620]/80 py-1 transition hover:border-fuchsia-400/60 hover:bg-[#1a0a3a]/80"
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
        {label}
      </span>
      <span className="font-display text-sm font-black text-fuchsia-200 drop-shadow-[0_0_6px_rgba(217,70,239,0.4)]">
        {value}
      </span>
    </button>
  );
}

function BottomItem({
  icon,
  label,
  to,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  to?: string;
  active?: boolean;
}) {
  const className = `flex w-14 flex-col items-center gap-1 ${
    active ? "text-emerald-400" : "text-purple-300/70 hover:text-purple-200"
  }`;
  const cls = `home-bottom-item ${active ? "home-bottom-item--active" : ""} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {icon}
        <span className="text-[9px] font-bold tracking-wider">{label}</span>
      </Link>
    );
  }
  return (
    <button className={cls}>
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

function MyBetsSection({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { user, loading } = useAuth();
  const getMyBets = useServerFn(getMySportsBets);
  const q = useQuery({
    queryKey: ["my-sports-bets", user?.id ?? null],
    enabled: !loading && !!user,
    staleTime: 15_000,
    queryFn: async () => (await getMyBets()).bets,
  });
  type BetFilter = "all" | "pending" | "won" | "lost" | "refunded";
  const [filter, setFilter] = useState<BetFilter>("all");

  if (!user) {
    return (
      <section className="mt-6">
        <h2 className="font-display text-sm font-black uppercase tracking-[0.14em] text-white">
          Mis apuestas
        </h2>
        <div className="mt-3 rounded-2xl border border-purple-500/25 bg-[#0c0620]/70 p-4 text-center">
          <Ticket className="mx-auto h-6 w-6 text-fuchsia-300" />
          <p className="mt-2 text-[11px] text-purple-100/85">
            Inicia sesión para ver tus apuestas.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-3 inline-flex rounded-lg bg-gradient-to-b from-fuchsia-500 to-purple-700 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-[0_6px_18px_-6px_rgba(168,85,247,0.75)]"
          >
            Iniciar sesión
          </button>
        </div>
      </section>
    );
  }

  const bets = q.data ?? [];

  const counts = bets.reduce(
    (acc, b) => {
      acc.all += 1;
      acc[b.status] += 1;
      return acc;
    },
    { all: 0, pending: 0, won: 0, lost: 0, refunded: 0 } as Record<BetFilter, number>,
  );
  const filtered = filter === "all" ? bets : bets.filter((b) => b.status === filter);
  const FILTERS: { key: BetFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Activas" },
    { key: "won", label: "Ganadas" },
    { key: "lost", label: "Perdidas" },
    { key: "refunded", label: "Reembolsadas" },
  ];

  return (
    <section className="mt-6">
      <h2 className="font-display text-sm font-black uppercase tracking-[0.14em] text-white">
        Mis apuestas
      </h2>
      {bets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = counts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                disabled={n === 0 && f.key !== "all"}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest transition ${
                  active
                    ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100"
                    : "border-purple-500/25 bg-[#0c0620]/60 text-purple-200/80 hover:bg-purple-500/10"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 py-[1px] text-[8px] font-black ${
                    active ? "bg-fuchsia-100/20 text-fuchsia-100" : "bg-purple-500/15 text-purple-200"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {q.isLoading ? (
          <div className="rounded-2xl border border-purple-500/20 bg-[#0c0620]/60 p-4 text-center text-[11px] text-purple-200/70">
            Cargando…
          </div>
        ) : bets.length === 0 ? (
          <div className="rounded-2xl border border-purple-500/20 bg-[#0c0620]/60 p-4 text-center text-[11px] text-purple-200/70">
            Aún no tienes apuestas. Elige un partido y prueba tu suerte.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-purple-500/20 bg-[#0c0620]/60 p-4 text-center text-[11px] text-purple-200/70">
            No tienes apuestas en esta categoría.
          </div>
        ) : (
          filtered.map((b) => <MyBetRowCard key={b.id} bet={b} />)
        )}
      </div>
    </section>
  );
}

function selectionLabel(sel: "home" | "draw" | "away", homeName: string, awayName: string) {
  if (sel === "home") return `Gana ${homeName}`;
  if (sel === "away") return `Gana ${awayName}`;
  return "Empate";
}

function statusMeta(status: MyBetRow["status"]) {
  switch (status) {
    case "won":
      return { text: "Ganada", key: "won" as const };
    case "lost":
      return { text: "Perdida", key: "lost" as const };
    case "refunded":
      return { text: "Reembolso", key: "refunded" as const };
    default:
      return { text: "Pendiente", key: "pending" as const };
  }
}

function MyBetRowCard({ bet }: { bet: MyBetRow }) {
  const meta = statusMeta(bet.status);
  const payout =
    bet.status === "won"
      ? bet.payout ?? bet.potential_payout
      : bet.status === "refunded"
        ? bet.payout ?? bet.stake
        : bet.potential_payout;
  return (
    <Link
      to="/deportes/$matchId"
      params={{ matchId: bet.match_id }}
      className="my-bet-card block rounded-2xl p-3 transition"
    >
      <div className="flex items-center gap-2">
        <span
          className={`my-bet-status my-bet-status--${meta.key} inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest`}
        >
          {meta.text}
        </span>
        <span className="my-bet-odds ml-auto font-display text-[11px] font-black">
          @ {bet.odds.toFixed(2)}
        </span>
      </div>
      <div className="my-bet-selection mt-1.5 truncate font-display text-[12px] font-black">
        {selectionLabel(bet.selection, bet.home_name, bet.away_name)}
      </div>
      <div className="my-bet-teams mt-0.5 flex items-center gap-1.5 text-[10px]">
        <span className="my-bet-flag flex h-4 w-6 overflow-hidden rounded-[3px] ring-1 ring-inset">
          <Flag code={bet.home_flag_code} name={bet.home_name} />
        </span>
        <span className="truncate">{bet.home_name}</span>
        <span className="text-purple-300/50">vs</span>
        <span className="truncate">{bet.away_name}</span>
        <span className="my-bet-flag flex h-4 w-6 overflow-hidden rounded-[3px] ring-1 ring-inset">
          <Flag code={bet.away_flag_code} name={bet.away_name} />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="my-bet-stake rounded-lg px-2 py-1.5">
          <div className="my-bet-box-label text-[8px] font-bold uppercase tracking-widest">Apuesta</div>
          <div className="my-bet-box-value font-display text-[11px] font-black">{formatCOP(bet.stake)} COP</div>
        </div>
        <div className="my-bet-payout rounded-lg px-2 py-1.5">
          <div className="my-bet-box-label text-[8px] font-bold uppercase tracking-widest">
            {bet.status === "won" ? "Ganancia" : bet.status === "refunded" ? "Reembolso" : bet.status === "lost" ? "Habría pagado" : "Pago posible"}
          </div>
          <div className="my-bet-box-value font-display text-[11px] font-black">{formatCOP(payout)} COP</div>
        </div>
      </div>
    </Link>
  );
}