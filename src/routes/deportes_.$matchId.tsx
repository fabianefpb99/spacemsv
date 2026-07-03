import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Menu,
  Home,
  Star,
  Wallet,
  User,
  Trophy,
  Calendar,
  Clock,
  ArrowLeft,
  Info,
  Handshake,
  Shirt,
} from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { AuthControl } from "@/components/auth/AuthControl";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";

type FlagCode = "AR" | "FR" | "BR" | "DE";

type MatchDetail = {
  id: string;
  competition: string;
  date: string;
  time: string;
  live: boolean;
  home: { name: string; code: FlagCode; jersey: string; jerseyAccent: string };
  away: { name: string; code: FlagCode; jersey: string; jerseyAccent: string };
  odds: { home: string; draw: string; away: string };
};

const MATCHES: Record<string, MatchDetail> = {
  "arg-fra": {
    id: "arg-fra",
    competition: "MUNDIAL 2026",
    date: "Hoy, 20 Jun",
    time: "15:00",
    live: true,
    home: { name: "Argentina", code: "AR", jersey: "#7CB9E8", jerseyAccent: "#FFFFFF" },
    away: { name: "Francia", code: "FR", jersey: "#1E3A8A", jerseyAccent: "#FFFFFF" },
    odds: { home: "2.10", draw: "3.25", away: "3.40" },
  },
  "bra-ale": {
    id: "bra-ale",
    competition: "MUNDIAL 2026",
    date: "Hoy, 20 Jun",
    time: "19:00",
    live: true,
    home: { name: "Brasil", code: "BR", jersey: "#FDE047", jerseyAccent: "#009C3B" },
    away: { name: "Alemania", code: "DE", jersey: "#FFFFFF", jerseyAccent: "#111111" },
    odds: { home: "1.85", draw: "3.60", away: "4.20" },
  },
};

export const Route = createFileRoute("/deportes_/$matchId")({
  loader: ({ params }) => {
    const match = MATCHES[params.matchId];
    if (!match) throw notFound();
    return { match };
  },
  head: ({ loaderData }) => {
    const m = loaderData?.match;
    const title = m
      ? `${m.home.name} vs ${m.away.name} — ${m.competition} · BETSPACE`
      : "Detalle del partido — BETSPACE";
    const description = m
      ? `Apuesta al resultado final de ${m.home.name} vs ${m.away.name} en BETSPACE. Cuotas claras y experiencia premium.`
      : "Detalle de partido en BETSPACE.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: MatchDetailPage,
  notFoundComponent: () => (
    <div className="min-h-screen bg-[#060210] text-white flex items-center justify-center p-6">
      <div className="text-center">
        <p className="font-display text-lg font-black">Partido no disponible</p>
        <Link to="/deportes" className="mt-4 inline-block text-fuchsia-300 underline">
          Volver a Deportes
        </Link>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="min-h-screen bg-[#060210] text-white flex items-center justify-center p-6">
      <p>Ocurrió un error al cargar el partido.</p>
    </div>
  ),
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function Flag({ code }: { code: FlagCode }) {
  const base = "block h-full w-full";
  switch (code) {
    case "AR":
      return (
        <svg viewBox="0 0 60 40" className={base} aria-hidden="true" preserveAspectRatio="none">
          <rect width="60" height="40" fill="#75AADB" />
          <rect y="13.33" width="60" height="13.33" fill="#FFFFFF" />
          <circle cx="30" cy="20" r="3.4" fill="#FCBF49" />
        </svg>
      );
    case "FR":
      return (
        <svg viewBox="0 0 60 40" className={base} aria-hidden="true" preserveAspectRatio="none">
          <rect width="20" height="40" fill="#0055A4" />
          <rect x="20" width="20" height="40" fill="#FFFFFF" />
          <rect x="40" width="20" height="40" fill="#EF4135" />
        </svg>
      );
    case "BR":
      return (
        <svg viewBox="0 0 60 40" className={base} aria-hidden="true" preserveAspectRatio="none">
          <rect width="60" height="40" fill="#009C3B" />
          <polygon points="30,5 55,20 30,35 5,20" fill="#FFDF00" />
          <circle cx="30" cy="20" r="7" fill="#002776" />
        </svg>
      );
    case "DE":
      return (
        <svg viewBox="0 0 60 40" className={base} aria-hidden="true" preserveAspectRatio="none">
          <rect width="60" height="13.33" fill="#000000" />
          <rect y="13.33" width="60" height="13.33" fill="#DD0000" />
          <rect y="26.66" width="60" height="13.34" fill="#FFCE00" />
        </svg>
      );
  }
}

function JerseyIcon({ color, accent }: { color: string; accent: string }) {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <path
        d="M20 10 L28 6 Q32 10 36 6 L44 10 L56 16 L52 26 L46 24 L46 56 Q46 58 44 58 L20 58 Q18 58 18 56 L18 24 L12 26 L8 16 Z"
        fill={color}
        stroke={accent}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M28 6 Q32 12 36 6"
        fill="none"
        stroke={accent}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MatchDetailPage() {
  const { match } = Route.useLoaderData();
  const { user, loading: authLoading } = useAuth();
  const me = useMe();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [selection, setSelection] = useState<"home" | "draw" | "away">("draw");
  const [stake, setStake] = useState<number>(10000);
  const balanceText = me.data ? formatCOP(me.data.balance) : "—";

  const selected = useMemo(() => {
    if (selection === "home")
      return { label: `GANA ${match.home.name.toUpperCase()}`, odd: parseFloat(match.odds.home) };
    if (selection === "away")
      return { label: `GANA ${match.away.name.toUpperCase()}`, odd: parseFloat(match.odds.away) };
    return { label: "EMPATE", odd: parseFloat(match.odds.draw) };
  }, [selection, match]);

  const potentialPayout = Math.floor(stake * selected.odd);

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col pt-4 sm:max-w-lg">
        {/* Header idéntico */}
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

        {/* Cuerpo: theme-dark-fixed para look premium consistente en claro y oscuro */}
        <div className="theme-dark-fixed flex-1 bg-[#060210] px-4 pb-40 pt-4 sm:px-5">
          {/* Top row: back arrow + competencia */}
          <div className="flex items-center gap-3">
            <Link
              to="/deportes"
              aria-label="Volver a Deportes"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-[#0c0620]/80 text-purple-100 transition hover:border-fuchsia-400/60 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex flex-1 justify-center">
            <span className="md-strong inline-flex items-center gap-1.5 rounded-full border border-purple-400/60 bg-purple-500/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-purple-100">
                <Trophy className="h-3 w-3 text-fuchsia-300" />
                {match.competition}
              </span>
            </div>
            <div className="h-9 w-9 shrink-0" aria-hidden="true" />
          </div>

          {/* Fecha + Hora + En vivo */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="md-strong inline-flex items-center gap-1.5 rounded-full border border-purple-500/25 bg-[#0c0620]/80 px-2.5 py-1 text-[10px] font-semibold text-purple-100">
              <Calendar className="h-3 w-3 text-purple-300/80" />
              {match.date}
            </span>
            <span className="md-strong inline-flex items-center gap-1.5 rounded-full border border-purple-500/25 bg-[#0c0620]/80 px-2.5 py-1 text-[10px] font-semibold text-purple-100">
              <Clock className="h-3 w-3 text-purple-300/80" />
              {match.time}
            </span>
            {match.live && (
              <span className="md-strong inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/60 bg-fuchsia-500/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-fuchsia-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-300 shadow-[0_0_6px_rgba(240,171,252,0.9)]" />
                En vivo
              </span>
            )}
          </div>

          {/* Equipos protagonistas */}
          <section className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.7)]">
                <Flag code={match.home.code} />
              </span>
              <span className="text-center font-display text-base font-black tracking-wide text-white">
                {match.home.name}
              </span>
            </div>
            <span className="font-display text-4xl font-black tracking-widest text-fuchsia-300 drop-shadow-[0_0_14px_rgba(217,70,239,0.6)]">
              VS
            </span>
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.7)]">
                <Flag code={match.away.code} />
              </span>
              <span className="text-center font-display text-base font-black tracking-wide text-white">
                {match.away.name}
              </span>
            </div>
          </section>

          {/* Info: apuesta simple */}
          <section className="mt-8">
            <div className="flex items-center gap-3 rounded-2xl border border-purple-500/25 bg-[#0c0620]/80 px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-700 shadow-[0_0_10px_rgba(168,85,247,0.55)]">
                <Trophy className="h-4 w-4 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="md-strong text-[12px] font-bold text-white">Apuesta simple</p>
                <p className="md-muted text-[11px] leading-snug text-purple-100/80">
                  Elige el resultado del partido
                </p>
              </div>
            </div>
          </section>

          {/* Mercado: RESULTADO FINAL */}
          <section className="mt-6">
            <h2 className="md-eyebrow px-1 text-[11px] font-black uppercase tracking-[0.18em] text-purple-200/80">
              Resultado final
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              <OutcomeCard
                title="Gana"
                subtitle={match.home.name}
                odd={match.odds.home}
                selected={selection === "home"}
                onSelect={() => setSelection("home")}
                icon={
                  <div className="h-10 w-10">
                    <JerseyIcon color={match.home.jersey} accent={match.home.jerseyAccent} />
                  </div>
                }
              />
              <OutcomeCard
                title=""
                subtitle="Empate"
                odd={match.odds.draw}
                selected={selection === "draw"}
                onSelect={() => setSelection("draw")}
                icon={
                  <div className="flex h-10 w-10 items-center justify-center">
                    <Handshake className="h-8 w-8 text-fuchsia-200" strokeWidth={1.6} />
                  </div>
                }
                emphasizeSubtitle
              />
              <OutcomeCard
                title="Gana"
                subtitle={match.away.name}
                odd={match.odds.away}
                selected={selection === "away"}
                onSelect={() => setSelection("away")}
                icon={
                  <div className="h-10 w-10">
                    <JerseyIcon color={match.away.jersey} accent={match.away.jerseyAccent} />
                  </div>
                }
              />
            </div>
          </section>

          {/* Aviso */}
          <section className="mt-6">
            <div className="flex items-center gap-3 rounded-2xl border border-purple-500/25 bg-[#0c0620]/80 px-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple-400/40 bg-purple-500/10">
                <Info className="h-4 w-4 text-purple-200" />
              </span>
              <p className="md-muted min-w-0 flex-1 text-[11px] leading-snug text-purple-100/80">
                Las cuotas pueden cambiar en cualquier momento. Apuesta responsablemente.
              </p>
            </div>
          </section>

          {/* Ficha usada por el ticket inferior (spacer visual) */}
          <div className="h-6" />
        </div>

        {/* Ticket inferior (fijado sobre bottom nav) */}
        <div
          className="theme-dark-fixed md-ticket fixed inset-x-0 z-20 border-t border-purple-500/25 bg-[#0c0620]/95 backdrop-blur"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 62px)" }}
        >
          <div className="mx-auto max-w-md px-4 py-3 sm:max-w-lg sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="md-eyebrow text-[9px] font-bold uppercase tracking-widest text-purple-200/70">
                  Tu selección
                </div>
                <div className="md-strong truncate font-display text-sm font-black text-white">
                  {selected.label}
                </div>
              </div>
              <div className="font-display text-xl font-black text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]">
                {selected.odd.toFixed(2)}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <label className="block">
                <span className="md-eyebrow block text-[9px] font-bold uppercase tracking-widest text-purple-200/70">
                  Apuesta
                </span>
                <div className="md-stake-field mt-1 flex items-center gap-1 rounded-lg border border-purple-500/30 bg-[#150830]/70 px-2 py-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={stake}
                    onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
                    className="md-strong w-full bg-transparent font-display text-sm font-black text-white outline-none"
                  />
                  <span className="md-eyebrow text-[9px] font-bold text-purple-200/70">COP</span>
                </div>
              </label>
              <div>
                <span className="md-eyebrow block text-[9px] font-bold uppercase tracking-widest text-purple-200/70">
                  Pago posible
                </span>
                <div className="mt-1 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-1.5 font-display text-sm font-black text-fuchsia-100">
                  {formatCOP(potentialPayout)} <span className="text-[9px] font-bold text-fuchsia-200/70">COP</span>
                </div>
              </div>
              <button
                type="button"
                className="h-full rounded-lg bg-gradient-to-b from-fuchsia-500 to-purple-700 px-4 py-2 font-display text-xs font-black uppercase tracking-widest text-white shadow-[0_0_14px_rgba(168,85,247,0.55)] transition hover:from-fuchsia-400 hover:to-purple-600"
              >
                Apostar
              </button>
            </div>
          </div>
        </div>

        {/* Bottom nav */}
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
    </div>
  );
}

function OutcomeCard({
  title,
  subtitle,
  odd,
  selected,
  onSelect,
  icon,
  emphasizeSubtitle,
}: {
  title: string;
  subtitle: string;
  odd: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  emphasizeSubtitle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`md-outcome-card ${selected ? "md-outcome-card--selected" : ""} relative flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 transition ${
        selected
          ? "border-fuchsia-400/80 bg-[#170a36] shadow-[0_0_0_1px_rgba(240,171,252,0.35),0_0_22px_-4px_rgba(217,70,239,0.75)]"
          : "border-purple-500/25 bg-[#0c0620]/80 hover:border-fuchsia-400/50"
      }`}
    >
      {title && (
        <span className="md-eyebrow text-[9px] font-bold uppercase tracking-widest text-purple-200/70">
          {title}
        </span>
      )}
      <span
        className={`md-strong text-center font-display text-[11px] font-black uppercase tracking-wider ${
          emphasizeSubtitle ? "text-white" : "text-white"
        }`}
      >
        {subtitle}
      </span>
      <span className="my-1 flex items-center justify-center">{icon}</span>
      <span className="font-display text-xl font-black text-fuchsia-200 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]">
        {odd}
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

// Silence unused import warnings for icons kept for future variants.
void Shirt;