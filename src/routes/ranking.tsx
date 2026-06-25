import { createFileRoute, Link } from "@tanstack/react-router";
import { Menu, Home, Star, Wallet, User, Trophy, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import betspaceLogo from "@/assets/betspace-logo.svg";
import spaceBg from "@/assets/space-bg.png";
import { AuthControl } from "@/components/auth/AuthControl";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { UserAvatar } from "@/components/UserAvatar";
import {
  getRankingPublic,
  getMyRankingPosition,
  type RankingEntry,
} from "@/lib/ranking.functions";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — BETSPACE Casino" },
      { name: "description", content: "Top ganadores del día en BETSPACE Casino: ranking general y arena." },
      { property: "og:title", content: "Ranking — BETSPACE Casino" },
      { property: "og:description", content: "Top ganadores del día en BETSPACE Casino: ranking general y arena." },
    ],
  }),
  component: RankingPage,
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function RankingPage() {
  const { user, loading: authLoading } = useAuth();
  const me = useMe();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = spaceBg;
    if (img.complete && img.naturalWidth > 0) {
      setBgLoaded(true);
    } else {
      img.onload = () => setBgLoaded(true);
      img.onerror = () => setBgLoaded(true);
    }
  }, []);

  const fetchPublic = useServerFn(getRankingPublic);
  const fetchMyPos = useServerFn(getMyRankingPosition);

  const publicQ = useQuery({
    queryKey: ["ranking", "public"],
    queryFn: () => fetchPublic(),
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const myPosQ = useQuery({
    queryKey: ["ranking", "me", user?.id ?? null],
    enabled: !!user,
    queryFn: () => fetchMyPos(),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const rawWinners = publicQ.data?.winners ?? [];
  const arena = publicQ.data?.arena ?? [];

  // Asegura que el usuario actual aparezca en el ranking general
  // según su posición real (myPosQ). Esto cubre casos donde la RPC
  // pública no lo incluyó por diferencias de agregación.
  const winners = (() => {
    const myNet = myPosQ.data?.net_amount ?? 0;
    const myRank = myPosQ.data?.rank ?? null;
    if (!user || !myRank || myNet <= 0) return rawWinners;
    const myId = user.id;
    if (rawWinners.some((w) => w.user_id === myId)) return rawWinners;
    const myEntry: RankingEntry = {
      user_id: myId,
      username: me.data?.profile?.username ?? "Tú",
      avatar_key: me.data?.profile?.avatar_key ?? null,
      net_amount: myNet,
    };
    const merged = [...rawWinners, myEntry].sort(
      (a, b) => b.net_amount - a.net_amount,
    );
    return merged.slice(0, Math.max(10, rawWinners.length));
  })();

  // Podio: 1°, 2°, 3°
  const first = winners[0];
  const second = winners[1];
  const third = winners[2];
  const rest = winners.slice(3);

  const balanceText = me.data ? formatCOP(me.data.balance) : "—";

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6 pt-4 sm:max-w-lg sm:px-4">
        {/* Header (igual al de Home) */}
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

        {/* Hero del Ranking con fondo del planeta (Spaceman) */}
        <section className="relative mt-4 overflow-hidden rounded-2xl border border-purple-500/40 shadow-[0_0_18px_rgba(168,85,247,0.3)]">
          <div
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{
              backgroundImage: bgLoaded ? `url(${spaceBg})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center bottom",
              backgroundRepeat: "no-repeat",
              opacity: bgLoaded ? 1 : 0,
            }}
            aria-hidden="true"
          />
          {/* Suave oscurecido arriba para legibilidad, dejando ver el planeta abajo */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#060210]/85 via-[#0a0320]/35 to-transparent"
            aria-hidden="true"
          />

          <div className="relative px-3 pb-6 pt-5 sm:px-4">
            {/* Título */}
            <div className="flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]" />
              <h1 className="ranking-hero-title font-display text-2xl font-black tracking-widest text-white drop-shadow sm:text-3xl">
                RANKING
              </h1>
              <Trophy className="h-5 w-5 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]" />
            </div>
            <p className="ranking-hero-sub mt-1 text-center text-xs text-purple-100/80">
              Los mejores ganadores del día
            </p>

            {/* Podio: 2 - 1 - 3 */}
            <div className="mt-7 grid grid-cols-3 items-end gap-2 sm:gap-3">
              <PodiumSlot place={2} entry={second} loading={publicQ.isLoading} />
              <PodiumSlot place={1} entry={first} loading={publicQ.isLoading} />
              <PodiumSlot place={3} entry={third} loading={publicQ.isLoading} />
            </div>

            {!publicQ.isLoading && winners.length === 0 && (
              <p className="ranking-empty-text mt-6 text-center text-xs text-purple-200/70">
                Aún no hay ganadores hoy. ¡Sé el primero!
              </p>
            )}
          </div>
        </section>

        {/* Tu posición */}
        <section className="mt-5">
          <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-purple-200/80">
            Tu posición
          </h3>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 p-3 sm:p-4">
            {user ? (
              <>
                <div className="flex w-12 shrink-0 items-center justify-center">
                  <span className="font-display text-2xl font-black text-purple-300/90">
                    #{myPosQ.data?.rank ?? "—"}
                  </span>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-700/40 ring-2 ring-purple-400/40">
                  <UserAvatar avatarKey={me.data?.profile?.avatar_key} alt="Tu avatar" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">
                    {me.data?.profile?.username ?? "Tú"}
                  </div>
                  <div className="font-display text-base font-bold">
                    <span className="neon-green mr-0.5">$</span>
                    <span className="text-white">{formatCOP(myPosQ.data?.net_amount ?? 0)}</span>
                  </div>
                  <div className="text-[10px] text-purple-300/70">Ganado hoy</div>
                </div>
              </>
            ) : (
              <div className="flex w-full items-center justify-between gap-3">
                <div className="text-xs text-purple-100/80">
                  Inicia sesión para ver tu posición.
                </div>
                <button
                  onClick={() => setAuthDialogOpen(true)}
                  className="rounded-md bg-purple-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-purple-500"
                >
                  Entrar
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Top ganadores Arena hoy */}
        <section className="mt-5 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-white">
              Top ganadores de Arena hoy
            </h3>
            <Link to="/arena" className="text-[11px] font-semibold text-purple-300 hover:text-purple-200">
              Jugar →
            </Link>
          </div>
          <ul className="mt-2 flex flex-col divide-y divide-purple-500/15">
            {publicQ.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="h-9 animate-pulse rounded bg-white/5 my-1" />
              ))
            ) : arena.length === 0 ? (
              <li className="py-3 text-center text-xs text-purple-200/70">
                Sin ganadores en Arena hoy.
              </li>
            ) : (
              arena.map((e, idx) => <ArenaRow key={e.user_id} pos={idx + 1} entry={e} />)
            )}
          </ul>
        </section>

        {/* Resto del ranking general (puestos 4+) */}
        {rest.length > 0 && (
          <section className="mt-5 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 p-3 sm:p-4">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-white">
              Más ganadores hoy
            </h3>
            <ul className="mt-2 flex flex-col divide-y divide-purple-500/15">
              {rest.map((e, idx) => (
                <ArenaRow key={e.user_id} pos={idx + 4} entry={e} />
              ))}
            </ul>
          </section>
        )}

        <div className="h-24" />
      </div>

      {/* Bottom nav */}
      <nav
        className="home-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-purple-500/20 bg-[#060210]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-md items-end justify-between px-4 pt-2 pb-2 sm:max-w-lg">
          <BottomItem icon={<Home className="h-5 w-5" />} label="INICIO" to="/home" />
          <BottomItem icon={<Star className="h-5 w-5" />} label="EVENTOS" to="/eventos" />
          <BottomCenterActive />
          <BottomItem icon={<Wallet className="h-5 w-5" />} label="DEPÓSITO" to="/pay" />
          <BottomItem icon={<User className="h-5 w-5" />} label="PERFIL" to="/perfil" />
        </div>
      </nav>
    </div>
  );
}

/* ───────── Subcomponents ───────── */

const PLACE_STYLES: Record<
  number,
  {
    crown: string;
    border: string;
    cardBg: string;
    cardShadow: string;
    badge: string;
    pedestal: string;
    coin: string;
    cardHeight: string;
    pedestalHeight: string;
    nameColor: string;
    amountColor: string;
  }
> = {
  1: {
    crown:
      "text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,1)]",
    // Oro intenso
    border: "border-2 border-amber-400",
    cardBg:
      "bg-gradient-to-b from-amber-500/20 via-[#1a0b3a]/55 to-[#0a0320]/70",
    cardShadow:
      "shadow-[0_0_22px_rgba(251,191,36,0.55),inset_0_0_18px_rgba(251,191,36,0.18)]",
    badge:
      "bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 ring-[3px] ring-amber-200/40 shadow-[0_0_14px_rgba(251,191,36,0.9)]",
    pedestal:
      "bg-gradient-to-b from-amber-500/40 to-amber-700/10 border-t-2 border-amber-400/80 shadow-[0_-2px_18px_rgba(251,191,36,0.45)]",
    coin: "bg-amber-400 text-amber-950",
    cardHeight: "h-44",
    pedestalHeight: "h-9",
    nameColor: "text-white",
    amountColor: "text-amber-100",
  },
  2: {
    // Plata real, brillante
    crown:
      "text-slate-100 drop-shadow-[0_0_10px_rgba(241,245,249,0.95)]",
    border: "border-2 border-slate-200",
    cardBg:
      "bg-gradient-to-b from-slate-300/18 via-[#1a0b3a]/55 to-[#0a0320]/70",
    cardShadow:
      "shadow-[0_0_16px_rgba(226,232,240,0.45),inset_0_0_14px_rgba(226,232,240,0.15)]",
    badge:
      "bg-gradient-to-b from-slate-100 to-slate-400 text-slate-900 ring-[3px] ring-slate-100/40 shadow-[0_0_12px_rgba(226,232,240,0.85)]",
    pedestal:
      "bg-gradient-to-b from-slate-300/40 to-slate-500/10 border-t-2 border-slate-200/80 shadow-[0_-2px_16px_rgba(226,232,240,0.4)]",
    coin: "bg-slate-200 text-slate-900",
    cardHeight: "h-36",
    pedestalHeight: "h-7",
    nameColor: "text-white",
    amountColor: "text-slate-100",
  },
  3: {
    // Bronce / naranja intenso
    crown:
      "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.95)]",
    border: "border-2 border-orange-500",
    cardBg:
      "bg-gradient-to-b from-orange-500/20 via-[#1a0b3a]/55 to-[#0a0320]/70",
    cardShadow:
      "shadow-[0_0_16px_rgba(249,115,22,0.55),inset_0_0_14px_rgba(249,115,22,0.18)]",
    badge:
      "bg-gradient-to-b from-orange-400 to-orange-600 text-orange-950 ring-[3px] ring-orange-300/40 shadow-[0_0_12px_rgba(249,115,22,0.9)]",
    pedestal:
      "bg-gradient-to-b from-orange-500/40 to-orange-700/10 border-t-2 border-orange-500/80 shadow-[0_-2px_16px_rgba(249,115,22,0.45)]",
    coin: "bg-orange-500 text-orange-950",
    cardHeight: "h-36",
    pedestalHeight: "h-7",
    nameColor: "text-white",
    amountColor: "text-orange-100",
  },
};

function PodiumSlot({
  place,
  entry,
  loading,
}: {
  place: 1 | 2 | 3;
  entry: RankingEntry | undefined;
  loading: boolean;
}) {
  const s = PLACE_STYLES[place];
  const isFirst = place === 1;

  // Cortes agresivos tipo "chamfer" en esquinas opuestas
  const cutOuter =
    "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)";
  const cutInner =
    "polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)";
  // Color del "borde" según puesto
  const edgeColor =
    place === 1 ? "#fbbf24" : place === 2 ? "#e2e8f0" : "#f97316";

  return (
    <div className={`flex flex-col items-center ${isFirst ? "-mt-4" : ""}`}>
      {/* Corona encima */}
      <Crown
        className={`mb-1 ${isFirst ? "h-8 w-8" : "h-6 w-6"} ${s.crown}`}
        strokeWidth={2.2}
        fill="currentColor"
      />

      {/* Tarjeta vertical con avatar + número (esquinas con corte agresivo) */}
      <div
        className={`relative w-full p-[2px] ${s.cardShadow} ${s.cardHeight}`}
        style={{
          clipPath: cutOuter,
          WebkitClipPath: cutOuter,
          backgroundColor: edgeColor,
        }}
      >
        <div
          className={`relative h-full w-full overflow-hidden ${s.cardBg}`}
          style={{
            clipPath: cutInner,
            WebkitClipPath: cutInner,
          }}
        >
        {/* Avatar grande dentro de la tarjeta */}
        <div className="absolute inset-x-0 top-2 flex items-center justify-center">
          <div
            className="flex items-center justify-center overflow-hidden rounded-full bg-[#150830] ring-2 ring-white/10"
            style={{
              height: isFirst ? "5.1rem" : "4.08rem",
              width: isFirst ? "5.1rem" : "4.08rem",
            }}
          >
            {loading || !entry ? (
              <div className="h-full w-full animate-pulse bg-white/5" />
            ) : (
              <UserAvatar avatarKey={entry.avatar_key} alt={entry.username} />
            )}
          </div>
        </div>

        {/* Badge con el número */}
        <div className="absolute inset-x-0 bottom-12 flex justify-center">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black ${s.badge}`}
          >
            {place}
          </span>
        </div>

        {/* Texto inferior dentro de la tarjeta */}
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center gap-0.5 px-1">
          <div
            className={`line-clamp-1 max-w-full px-1 font-display text-[10px] font-black uppercase tracking-wider sm:text-[11px] ${s.nameColor}`}
          >
            {entry?.username ?? (loading ? "…" : "—")}
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black ${s.coin}`}>
              $
            </span>
            <span className={`font-display text-[11px] font-black sm:text-xs ${s.amountColor}`}>
              {entry ? formatCOP(entry.net_amount) : "—"}
            </span>
          </div>
        </div>
        </div>
      </div>

      {/* Pedestal debajo */}
      <div
        className={`w-full ${s.pedestal} ${s.pedestalHeight}`}
        style={{
          clipPath:
            "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 10px 100%)",
          WebkitClipPath:
            "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 10px 100%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function ArenaRow({ pos, entry }: { pos: number; entry: RankingEntry }) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <span className="w-5 text-center font-display text-xs font-black text-purple-300/80">{pos}</span>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-700/30 ring-1 ring-purple-400/30">
        <UserAvatar avatarKey={entry.avatar_key} alt={entry.username} spinnerSize="sm" />
      </div>
      <div className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-white">
        {entry.username}
      </div>
      <div className="font-display text-xs font-bold">
        <span className="neon-green mr-0.5">$</span>
        <span className="text-white">{formatCOP(entry.net_amount)}</span>
      </div>
    </li>
  );
}

function BottomItem({
  icon,
  label,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  to?: string;
}) {
  const className = "home-bottom-item flex w-14 flex-col items-center gap-1 text-purple-300/70 hover:text-purple-200";
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

function BottomCenterActive() {
  return (
    <div className="home-bottom-center -mt-7 flex w-16 flex-col items-center gap-1">
      <span className="home-bottom-center-circle home-bottom-center-circle--active theme-dark-fixed flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-400/60 bg-[#060210] shadow-[0_0_18px_rgba(168,85,247,0.35)]">
        <Trophy className="h-7 w-7 text-white" strokeWidth={2.2} />
      </span>
      <span className="home-bottom-center-label home-bottom-center-label--active text-[9px] font-bold tracking-wider text-emerald-400">RANKING</span>
    </div>
  );
}
