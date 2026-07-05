import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Menu,
  Trophy,
  Calendar,
  Clock,
  ArrowLeft,
  Info,
  Handshake,
  CheckCircle2,
  Ticket,
  RotateCcw,
  Ban,
} from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import stadiumBg from "@/assets/stadium-bg.jpg";
import { AuthControl } from "@/components/auth/AuthControl";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { getPublicMatch } from "@/lib/sports/public.functions";
import { placeSportsBet } from "@/lib/sports/bet.functions";
import { toFriendlyError } from "@/lib/friendly-error";
import { flagSvgUrl, teamName } from "@/lib/sports/world-cup-2026-teams";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MatchDetail = {
  id: string;
  competition: string;
  date: string;
  time: string;
  live: boolean;
  started: boolean;
  home: { name: string; code: string };
  away: { name: string; code: string };
  odds: { home: string; draw: string; away: string };
};

const TZ = "America/Bogota";

function formatMatchDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const now = new Date();
  const dayFmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  });
  const timeFmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dayKey = (x: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(x);
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(new Date(now.getTime() + 86400000));
  const matchKey = dayKey(d);
  let label: string;
  if (matchKey === todayKey) label = "Hoy";
  else if (matchKey === tomorrowKey) label = "Mañana";
  else label = dayFmt.format(d);
  return { date: label, time: timeFmt.format(d) };
}

export const Route = createFileRoute("/deportes_/$matchId")({
  loader: async ({ params }) => {
    if (!UUID_RE.test(params.matchId)) throw notFound();
    const res = await getPublicMatch({ data: { id: params.matchId } });
    if (!res?.match) throw notFound();
    const r = res.match;
    const { date, time } = formatMatchDate(r.start_at);
    const started = r.status !== "scheduled" || new Date() >= new Date(r.start_at);
    const match: MatchDetail = {
      id: r.id,
      competition: (r.competition_name ?? "DEPORTES").toUpperCase(),
      date,
      time,
      live: r.status === "live",
      started,
      home: { name: r.home_name || teamName(r.home_flag_code), code: r.home_flag_code },
      away: { name: r.away_name || teamName(r.away_flag_code), code: r.away_flag_code },
      odds: {
        home: Number(r.odds_home).toFixed(2),
        draw: Number(r.odds_draw).toFixed(2),
        away: Number(r.odds_away).toFixed(2),
      },
    };
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

function MatchDetailPage() {
  const { match } = Route.useLoaderData();
  const { user, loading: authLoading } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [selection, setSelection] = useState<"home" | "draw" | "away">("draw");
  const [stake, setStake] = useState<number>(10000);
  const [leaving, setLeaving] = useState(false);

  function handleBack(e: React.MouseEvent) {
    e.preventDefault();
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      navigate({ to: "/deportes" });
    }, 240);
  }
  const [placed, setPlaced] = useState<
    | null
    | {
        label: string;
        odd: number;
        stake: number;
        payout: number;
      }
  >(null);
  const balanceText = me.data ? formatCOP(me.data.balance) : "—";
  const placeBetFn = useServerFn(placeSportsBet);
  const mutation = useMutation({
    mutationFn: (vars: { matchId: string; selection: "home" | "draw" | "away"; stake: number }) =>
      placeBetFn({ data: vars }),
    onSuccess: (res, vars) => {
      if (!res.ok) {
        toast.error(toFriendlyError(new Error(res.error), "No pudimos registrar la apuesta."));
        return;
      }
      const odd =
        vars.selection === "home"
          ? parseFloat(match.odds.home)
          : vars.selection === "away"
            ? parseFloat(match.odds.away)
            : parseFloat(match.odds.draw);
      const label =
        vars.selection === "home"
          ? `GANA ${match.home.name.toUpperCase()}`
          : vars.selection === "away"
            ? `GANA ${match.away.name.toUpperCase()}`
            : "EMPATE";
      setPlaced({
        label,
        odd,
        stake: vars.stake,
        payout: Math.floor(vars.stake * odd),
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["my-sports-bets"] });
      router.invalidate();
    },
    onError: (err) => {
      toast.error(toFriendlyError(err, "No pudimos registrar la apuesta."));
    },
  });

  function goToMyBets() {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("sports.openMias", "1");
      }
    } catch {
      /* ignore */
    }
    navigate({ to: "/deportes" });
  }

  function newBet() {
    setPlaced(null);
  }

  const selected = useMemo(() => {
    if (selection === "home")
      return { label: `GANA ${match.home.name.toUpperCase()}`, odd: parseFloat(match.odds.home) };
    if (selection === "away")
      return { label: `GANA ${match.away.name.toUpperCase()}`, odd: parseFloat(match.odds.away) };
    return { label: "EMPATE", odd: parseFloat(match.odds.draw) };
  }, [selection, match]);

  const potentialPayout = Math.floor(stake * selected.odd);
  const balance = me.data?.balance ?? 0;
  const minStake = 1000;
  const insufficientFunds = user != null && stake > balance;
  const belowMin = stake < minStake;
  const canBet =
    !!user && !mutation.isPending && !insufficientFunds && !belowMin && stake > 0;

  function handlePlaceBet() {
    if (!user) {
      setAuthDialogOpen(true);
      return;
    }
    if (belowMin) {
      toast.error(`Apuesta mínima: ${formatCOP(minStake)} COP`);
      return;
    }
    if (insufficientFunds) {
      toast.error("Saldo insuficiente.");
      return;
    }
    mutation.mutate({ matchId: match.id, selection, stake });
  }

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col pt-4 sm:max-w-lg">
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

        <div className="theme-dark-fixed relative flex-1 overflow-hidden bg-[#060210] px-4 pb-36 pt-4 sm:px-5">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[380px] sm:h-[420px]">
            <img
              src={stadiumBg}
              alt=""
              width={1280}
              height={768}
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#060210]/55 via-[#060210]/75 to-[#060210]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.28),transparent_65%)]" />
          </div>
          <div className="relative flex items-center gap-3">
            <Link
              to="/deportes"
              aria-label="Volver a Deportes"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-[#0b0522] text-purple-100 transition hover:border-fuchsia-400/60 hover:text-white"
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

          <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="md-strong inline-flex items-center gap-1.5 rounded-full border border-purple-500/25 bg-[#0b0522] px-2.5 py-1 text-[10px] font-semibold text-purple-100">
              <Calendar className="h-3 w-3 text-purple-300/80" />
              {match.date}
            </span>
            <span className="md-strong inline-flex items-center gap-1.5 rounded-full border border-purple-500/25 bg-[#0b0522] px-2.5 py-1 text-[10px] font-semibold text-purple-100">
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

          <section className="relative mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.7)]">
                <Flag code={match.home.code} name={match.home.name} />
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
                <Flag code={match.away.code} name={match.away.name} />
              </span>
              <span className="text-center font-display text-base font-black tracking-wide text-white">
                {match.away.name}
              </span>
            </div>
          </section>

          <section className="relative mt-8">
            <div className="flex items-center gap-3 rounded-2xl border border-purple-500/25 bg-[#0b0522] px-3 py-3">
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

          <section className="relative mt-6">
            <h2 className="md-eyebrow px-1 text-[11px] font-black uppercase tracking-[0.18em] text-purple-200/80">
              Resultado final
            </h2>
            <div className={`mt-3 grid grid-cols-3 gap-2.5 ${match.started ? "pointer-events-none opacity-60" : ""}`}>
              <OutcomeCard
                title="Gana"
                subtitle={match.home.name}
                odd={match.odds.home}
                selected={selection === "home"}
                onSelect={() => setSelection("home")}
                disabled={match.started}
              />
              <OutcomeCard
                title=""
                subtitle="Empate"
                odd={match.odds.draw}
                selected={selection === "draw"}
                onSelect={() => setSelection("draw")}
                icon={
                  <div className="flex h-7 w-7 items-center justify-center">
                    <Handshake className="h-6 w-6 text-fuchsia-200" strokeWidth={1.7} />
                  </div>
                }
                emphasizeSubtitle
                disabled={match.started}
              />
              <OutcomeCard
                title="Gana"
                subtitle={match.away.name}
                odd={match.odds.away}
                selected={selection === "away"}
                onSelect={() => setSelection("away")}
                disabled={match.started}
              />
            </div>
            {match.started && (
              <p className="mt-3 text-center text-[11px] font-semibold text-fuchsia-200/90">
                Apuestas cerradas para este partido.
              </p>
            )}
          </section>

          <section className="relative mt-6">
            <div className="flex items-center gap-3 rounded-2xl border border-purple-500/25 bg-[#0b0522] px-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple-400/40 bg-purple-500/10">
                <Info className="h-4 w-4 text-purple-200" />
              </span>
              <p className="md-muted min-w-0 flex-1 text-[11px] leading-snug text-purple-100/80">
                Las cuotas pueden cambiar en cualquier momento. Apuesta responsablemente.
              </p>
            </div>
          </section>

          <div className="h-3" />
        </div>

        <div
          className="md-ticket-light fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.35)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {placed ? (
            <div className="mx-auto max-w-md px-4 py-4 sm:max-w-lg sm:px-5" role="status" aria-live="polite">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-4 ring-emerald-50">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[15px] font-black text-neutral-900">
                    ¡Tu apuesta ha sido realizada!
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-medium text-neutral-500">
                    {placed.label} · Cuota {placed.odd.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                    Apostaste
                  </div>
                  <div className="mt-0.5 font-display text-sm font-black text-neutral-900">
                    ${formatCOP(placed.stake)} <span className="text-[9px] font-bold text-neutral-500">COP</span>
                  </div>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-purple-600">
                    Pago posible
                  </div>
                  <div className="mt-0.5 font-display text-sm font-black text-purple-700">
                    ${formatCOP(placed.payout)} <span className="text-[9px] font-bold text-purple-500">COP</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[3fr_2fr] gap-2">
                <button
                  type="button"
                  onClick={goToMyBets}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-purple-600 to-purple-800 py-3 font-display text-[12px] font-black uppercase tracking-widest text-white shadow-[0_6px_18px_-6px_rgba(109,40,217,0.7)] transition hover:from-purple-500 hover:to-purple-700 active:scale-[0.98]"
                >
                  <Ticket className="h-4 w-4" strokeWidth={2.4} />
                  Ver mis apuestas
                </button>
                <button
                  type="button"
                  onClick={newBet}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white py-3 font-display text-[11px] font-black uppercase tracking-widest text-neutral-800 transition hover:bg-neutral-50 active:scale-[0.98]"
                >
                  <RotateCcw className="h-4 w-4" strokeWidth={2.4} />
                  Nueva apuesta
                </button>
              </div>
            </div>
          ) : match.started ? (
            <div className="mx-auto max-w-md px-6 py-5 sm:max-w-lg sm:px-8" role="status" aria-live="polite">
              <div className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 ring-4 ring-neutral-50">
                  <Ban className="h-7 w-7" strokeWidth={2.2} />
                </span>
                <div className="mt-4 font-display text-[17px] font-black text-neutral-900">
                  Este partido ya empezó
                </div>
                <div className="mt-1 text-[12px] font-medium text-neutral-500">
                  Apuestas cerradas para este encuentro.
                </div>
                <Link
                  to="/deportes"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-purple-600 to-purple-800 px-5 py-2.5 font-display text-[12px] font-black uppercase tracking-widest text-white shadow-[0_6px_18px_-6px_rgba(109,40,217,0.7)] transition hover:from-purple-500 hover:to-purple-700 active:scale-[0.98]"
                >
                  Ver próximos partidos
                </Link>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-md px-4 py-3.5 sm:max-w-lg sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                    Tu selección
                  </div>
                  <div className="truncate font-display text-sm font-black text-neutral-900">
                    {selected.label}
                  </div>
                </div>
                <div className="font-display text-2xl font-black text-purple-700">
                  {selected.odd.toFixed(2)}
                </div>
              </div>

              <div className="my-3 h-px bg-neutral-200" />

              <div>
                <label
                  htmlFor="stake"
                  className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500"
                >
                  Apuesta
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2">
                  <span className="text-sm font-bold text-neutral-500">$</span>
                  <input
                    id="stake"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={stake}
                    onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-w-0 bg-transparent font-display text-sm font-black text-neutral-900 outline-none"
                  />
                  <span className="text-[10px] font-bold text-neutral-500">COP</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[2fr_3fr] items-end gap-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                    Pago posible
                  </div>
                  <div className="mt-1.5 flex items-center justify-between rounded-xl border border-purple-300 bg-purple-50 px-2.5 py-2">
                    <span className="font-display text-sm font-black text-purple-700">
                      {formatCOP(potentialPayout)}
                    </span>
                    <span className="text-[9px] font-bold text-purple-500">COP</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePlaceBet}
                  disabled={!canBet}
                  className="w-full rounded-xl bg-gradient-to-b from-purple-600 to-purple-800 py-3 font-display text-sm font-black uppercase tracking-widest text-white shadow-[0_6px_18px_-6px_rgba(109,40,217,0.7)] transition hover:from-purple-500 hover:to-purple-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                >
                  {mutation.isPending
                    ? "Enviando…"
                    : !user
                      ? "Iniciar sesión"
                      : insufficientFunds
                        ? "Saldo insuficiente"
                        : belowMin
                          ? `Mín ${formatCOP(minStake)}`
                          : "Apostar"}
                </button>
              </div>
            </div>
          )}
        </div>
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
  disabled,
}: {
  title: string;
  subtitle: string;
  odd: string;
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  emphasizeSubtitle?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      disabled={disabled}
      className={`md-outcome-card ${selected ? "md-outcome-card--selected" : ""} relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-fuchsia-400/80 bg-[#170a36] shadow-[0_0_0_1px_rgba(240,171,252,0.35),0_0_22px_-4px_rgba(217,70,239,0.75)]"
          : "border-purple-500/25 bg-[#0b0522] hover:border-fuchsia-400/50"
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
      {icon && <span className="flex items-center justify-center">{icon}</span>}
      <span className="font-display text-lg font-black text-fuchsia-200 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]">
        {odd}
      </span>
    </button>
  );
}
