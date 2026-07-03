import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Home, Star, Wallet, User, Trophy, Calendar, Clock, ChevronRight } from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import mundialHeroAsset from "@/assets/mundial-hero.webp.asset.json";
import { AuthControl } from "@/components/auth/AuthControl";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { flagSvgUrl } from "@/lib/sports/world-cup-2026-teams";

export const Route = createFileRoute("/deportes")({
  head: () => ({
    meta: [
      { title: "Apuestas Deportivas Mundial 2026 — BETSPACE" },
      {
        name: "description",
        content:
          "Apuesta en los partidos del Mundial 2026 desde BETSPACE. Cuotas claras y experiencia simple, sin complicaciones.",
      },
      { property: "og:title", content: "Apuestas Deportivas Mundial 2026 — BETSPACE" },
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
  const [selector, setSelector] = useState<"futbol" | "mundial">("mundial");
  const balanceText = me.data ? formatCOP(me.data.balance) : "—";
  const matchesQuery = usePublishedMatches();
  const matches = matchesQuery.data ?? [];

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
              <Link to="/home" className="logo-shine">
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
          {/* Selector flotante Fútbol / Mundial 2026 (superpuesto ~50% al banner) */}
          <div className="relative z-10 -mt-10 grid grid-cols-2 gap-1.5 rounded-2xl border border-purple-500/30 bg-[#0c0620]/95 p-1.5 shadow-[0_14px_36px_-12px_rgba(168,85,247,0.6)] backdrop-blur">
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
          </div>

          {/* Partidos destacados */}
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
              matches.map((m) => <MatchCard key={m.id} match={m} />)
            )}
          </div>
          </section>

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
          <BottomItem icon={<Home className="h-5 w-5" />} label="INICIO" to="/home" />
          <BottomItem icon={<Star className="h-5 w-5" />} label="EVENTOS" to="/eventos" />
          <BottomCenter />
          <BottomItem icon={<Wallet className="h-5 w-5" />} label="DEPÓSITO" to="/pay" />
          <BottomItem icon={<User className="h-5 w-5" />} label="PERFIL" to="/perfil" />
        </div>
      </nav>
    </div>
  );
}

function MatchCard({ match }: { match: PublicMatch }) {
  return (
    <Link
      to="/deportes/$matchId"
      params={{ matchId: match.id }}
      aria-label={`${match.home.name} vs ${match.away.name} — ${match.competition}`}
      className="theme-dark-fixed group relative block overflow-hidden rounded-2xl border border-purple-500/30 bg-[#0c0620]/90 p-3 shadow-[0_0_16px_rgba(76,29,149,0.25)] transition hover:border-fuchsia-400/60 hover:shadow-[0_0_18px_rgba(217,70,239,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 sm:p-4"
    >
      {/* Fila superior: todo en una línea */}
      <div className="flex items-center gap-1.5 whitespace-nowrap">
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
        <div className="ml-auto flex shrink-0 items-center">
          {match.live && (
            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/60 bg-fuchsia-500/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-fuchsia-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-300 shadow-[0_0_6px_rgba(240,171,252,0.9)]" />
              En vivo
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 h-px w-full bg-purple-500/20" />

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
      <div className="mt-3 rounded-xl border border-purple-500/25 bg-[#150830]/70 p-2">
        <div className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-widest text-purple-200/70">
          1X2 · Resultado final
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <OddChip label="1" value={match.odds.home} />
          <OddChip label="X" value={match.odds.draw} />
          <OddChip label="2" value={match.odds.away} />
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
      className="sports-odd-chip flex flex-col items-center justify-center gap-0.5 rounded-lg border border-purple-500/25 bg-[#0c0620]/80 py-1.5 transition hover:border-fuchsia-400/60 hover:bg-[#1a0a3a]/80"
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