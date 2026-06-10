import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Menu,
  Home,
  Star,
  Wallet,
  User,
  Trophy,
  Calendar,
  CalendarDays,
  Sparkles,
  LayoutGrid,
  Swords,
  Coins,
  Users,
  Gift,
} from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import eventosHero from "@/assets/eventos-hero.jpg";
import avatarArenaAsset from "@/assets/avatar-astronauta-arena.png.asset.json";
import iconSwords from "@/assets/mission-swords.png.asset.json";
import iconCoins from "@/assets/mission-coins.png.asset.json";
import iconSparkles from "@/assets/mission-sparkles.png.asset.json";
import iconUsers from "@/assets/mission-users.png.asset.json";
import { AuthControl } from "@/components/auth/AuthControl";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — BetSpaceman" },
      { name: "description", content: "Completa desafíos diarios y semanales y gana saldo bonus, free spins y avatares exclusivos." },
      { property: "og:title", content: "Eventos — BetSpaceman" },
      { property: "og:description", content: "Completa desafíos diarios y semanales y gana saldo bonus, free spins y avatares exclusivos." },
    ],
  }),
  component: EventosPage,
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

type RewardKind = "bonus" | "spins" | "avatar";
type MissionType = "daily" | "weekly" | "special";

type Mission = {
  id: string;
  type: MissionType;
  title: string;
  subtitle?: string;
  progress: number;
  goal: number;
  reward: { kind: RewardKind; value: number | string; label: string };
  cta: { label: string; to: string };
  accent: "purple" | "emerald" | "amber" | "rose" | "blue";
  icon: React.ReactNode;
  rewardImage?: string;
};

const MISSIONS: Mission[] = [
  {
    id: "m1",
    type: "daily",
    title: "Haz 10 apuestas en",
    subtitle: "ARENA",
    progress: 6,
    goal: 10,
    reward: { kind: "bonus", value: 1000, label: "1.000 Bonus" },
    cta: { label: "Ir a Arena", to: "/arena" },
    accent: "emerald",
    icon: <MissionIcon src={iconSwords.url} alt="Espadas" />,
  },
  {
    id: "m2",
    type: "daily",
    title: "Haz una apuesta de",
    subtitle: "$10.000 o más",
    progress: 0,
    goal: 10000,
    reward: { kind: "bonus", value: 500, label: "500 Bonus" },
    cta: { label: "Apostar", to: "/home" },
    accent: "emerald",
    icon: <MissionIcon src={iconCoins.url} alt="Monedas" />,
  },
  {
    id: "m3",
    type: "daily",
    title: "10 giros en",
    subtitle: "SLOT MAFIA",
    progress: 3,
    goal: 10,
    reward: { kind: "spins", value: 5, label: "5 Free Spins" },
    cta: { label: "Jugar Slot", to: "/slot" },
    accent: "emerald",
    icon: <MissionIcon src={iconSparkles.url} alt="Estrella" />,
  },
  {
    id: "m4",
    type: "weekly",
    title: "Gana 3 peleas con",
    subtitle: "BLAZE en Arena",
    progress: 1,
    goal: 3,
    reward: { kind: "bonus", value: 2500, label: "2.500 Bonus" },
    cta: { label: "Ir a Arena", to: "/arena" },
    accent: "purple",
    icon: <MissionIcon src={iconSwords.url} alt="Espadas" />,
  },
  {
    id: "m5",
    type: "weekly",
    title: "Acumula",
    subtitle: "$50.000 en apuestas",
    progress: 12500,
    goal: 50000,
    reward: { kind: "bonus", value: 1500, label: "1.500 Bonus" },
    cta: { label: "Jugar", to: "/home" },
    accent: "purple",
    icon: <MissionIcon src={iconCoins.url} alt="Monedas" />,
  },
  {
    id: "m6",
    type: "special",
    title: "Invita a un amigo",
    subtitle: "y que se registre",
    progress: 0,
    goal: 1,
    reward: { kind: "bonus", value: 3000, label: "3.000 Bonus" },
    cta: { label: "Invitar", to: "/perfil" },
    accent: "amber",
    icon: <MissionIcon src={iconUsers.url} alt="Amigos" />,
  },
  {
    id: "m7",
    type: "special",
    title: "Gana 10 veces en",
    subtitle: "ARENA",
    progress: 0,
    goal: 10,
    reward: { kind: "avatar", value: "Astronauta Arena", label: "Avatar exclusivo" },
    cta: { label: "Ir a Arena", to: "/arena" },
    accent: "amber",
    icon: <MissionIcon src={iconSwords.url} alt="Espadas" />,
    rewardImage: avatarArenaAsset.url,
  },
];

function MissionIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      width={96}
      height={96}
      className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
    />
  );
}

const TABS: { id: "all" | MissionType; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "TODOS", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "special", label: "ESPECIALES", icon: <Sparkles className="h-4 w-4" /> },
  { id: "weekly", label: "SEMANALES", icon: <CalendarDays className="h-4 w-4" /> },
  { id: "daily", label: "DIARIOS", icon: <Calendar className="h-4 w-4" /> },
];

function useDailyCountdown() {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      const diff = Math.max(0, next.getTime() - now.getTime());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      const pad = (n: number) => n.toString().padStart(2, "0");
      setText(`${pad(h)}:${pad(m)}:${pad(s)}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return text;
}

function useWeekendCountdown() {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      // Lunes 00:00 (fin del finde)
      const end = new Date(now);
      const day = now.getDay(); // 0 dom, 1 lun ... 6 sab
      const daysUntilMonday = (8 - day) % 7 || 7;
      end.setDate(now.getDate() + daysUntilMonday);
      end.setHours(0, 0, 0, 0);
      const diff = Math.max(0, end.getTime() - now.getTime());
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setText(`${d}d ${h}h ${m}m`);
    };
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, []);
  return text;
}

const ACCENT: Record<Mission["accent"], { ring: string; bar: string; bg: string; btn: string; text: string }> = {
  purple: {
    ring: "ring-purple-500/40",
    bar: "bg-gradient-to-r from-purple-500 to-fuchsia-500",
    bg: "bg-purple-500/15",
    btn: "bg-purple-600 hover:bg-purple-500",
    text: "text-purple-200",
  },
  emerald: {
    ring: "ring-emerald-500/40",
    bar: "bg-gradient-to-r from-emerald-500 to-teal-400",
    bg: "bg-emerald-500/15",
    btn: "bg-emerald-600 hover:bg-emerald-500",
    text: "text-emerald-200",
  },
  amber: {
    ring: "ring-amber-400/40",
    bar: "bg-gradient-to-r from-amber-400 to-orange-500",
    bg: "bg-amber-500/15",
    btn: "bg-amber-500 hover:bg-amber-400 text-amber-950",
    text: "text-amber-200",
  },
  rose: {
    ring: "ring-rose-500/40",
    bar: "bg-gradient-to-r from-rose-500 to-fuchsia-500",
    bg: "bg-rose-500/15",
    btn: "bg-rose-600 hover:bg-rose-500",
    text: "text-rose-200",
  },
  blue: {
    ring: "ring-sky-500/40",
    bar: "bg-gradient-to-r from-sky-500 to-indigo-500",
    bg: "bg-sky-500/15",
    btn: "bg-sky-600 hover:bg-sky-500",
    text: "text-sky-200",
  },
};

function EventosPage() {
  const { user, loading: authLoading } = useAuth();
  const me = useMe();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [tab, setTab] = useState<"all" | MissionType>("all");

  const dailyTimer = useDailyCountdown();
  const weekendTimer = useWeekendCountdown();

  const balanceText = me.data ? formatCOP(me.data.balance) : "—";

  const filtered = useMemo(() => {
    if (tab === "all") return MISSIONS;
    return MISSIONS.filter((m) => m.type === tab);
  }, [tab]);

  const daily = filtered.filter((m) => m.type === "daily");
  const weekly = filtered.filter((m) => m.type === "weekly");
  const special = filtered.filter((m) => m.type === "special");

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6 pt-4 sm:max-w-lg sm:px-4">
        {/* Header (igual al de Home/Ranking) */}
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

        {/* Hero banner horizontal */}
        <section className="relative mt-4 overflow-hidden rounded-2xl border border-amber-400/40 shadow-[0_0_22px_rgba(251,191,36,0.25)]">
          <div className="relative h-24 w-full sm:h-28">
            <img
              src={eventosHero}
              alt="Eventos BetSpaceman"
              width={1920}
              height={512}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#060210]/55 to-[#060210]/85"
            />
            <div className="absolute inset-0 flex items-center justify-end pr-4 sm:pr-5">
              <div className="text-right">
                <h1 className="font-display text-2xl font-black tracking-[0.18em] text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)] sm:text-3xl">
                  EVENTOS
                </h1>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-100/80 sm:text-[11px]">
                  Desafíos y recompensas
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-xl border border-purple-500/20 bg-[#0c0620]/80 p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[9px] font-bold uppercase tracking-wider transition sm:text-[10px] ${
                  active
                    ? "bg-gradient-to-b from-purple-600 to-fuchsia-700 text-white shadow-[0_0_12px_rgba(168,85,247,0.55)]"
                    : "text-purple-300/80 hover:text-purple-100 hover:bg-white/5"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Evento especial fin de semana */}
        {(tab === "all" || tab === "special") && (
          <section className="mt-5">
            <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-fuchsia-700/40 via-purple-800/40 to-amber-600/30 p-4 shadow-[0_0_22px_rgba(217,70,239,0.35)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-amber-400/30 blur-3xl"
              />
              <div className="relative flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 ring-2 ring-amber-300/40">
                  <Sparkles className="h-7 w-7 text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
                    Evento especial
                  </div>
                  <div className="font-display text-lg font-black leading-tight text-white">
                    DOBLE XP DE FIN DE SEMANA
                  </div>
                  <div className="text-[11px] text-purple-100/80">
                    Sube de nivel el doble de rápido
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-center rounded-xl border border-amber-300/50 bg-amber-400/15 px-3 py-2 text-center">
                  <div className="font-display text-xl font-black text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)] leading-none">
                    x2
                  </div>
                  <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                    XP
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-purple-200/80">Termina en</span>
                <span className="font-mono text-xs font-bold text-white">{weekendTimer}</span>
              </div>
            </div>
          </section>
        )}

        {/* Misiones especiales */}
        {(tab === "all" || tab === "special") && special.length > 0 && (
          <section className="mt-5">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-amber-200">
              Misiones especiales
            </h3>
            <div className="mt-2 flex flex-col gap-2.5">
              {special.map((m) => <MissionCard key={m.id} mission={m} />)}
            </div>
          </section>
        )}

        {/* Misiones semanales */}
        {(tab === "all" || tab === "weekly") && weekly.length > 0 && (
          <section className="mt-5">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-purple-200">
              Misiones semanales
            </h3>
            <div className="mt-2 flex flex-col gap-2.5">
              {weekly.map((m) => <MissionCard key={m.id} mission={m} />)}
            </div>
          </section>
        )}

        {/* Desafíos diarios */}
        {(tab === "all" || tab === "daily") && (
          <section className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-emerald-200">
                Desafíos diarios
              </h3>
              <div className="text-[10px] text-emerald-300/80">
                Actualiza en <span className="font-mono font-bold text-emerald-200">{dailyTimer}</span>
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-2.5">
              {daily.length === 0 ? (
                <EmptyState />
              ) : (
                daily.map((m) => <MissionCard key={m.id} mission={m} />)
              )}
            </div>
          </section>
        )}

        <div className="h-24" />
      </div>

      {/* Bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-purple-500/20 bg-[#060210]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-md items-end justify-between px-4 pt-2 pb-2 sm:max-w-lg">
          <BottomItem icon={<Home className="h-5 w-5" />} label="INICIO" to="/home" />
          <BottomItem icon={<Star className="h-5 w-5" />} label="EVENTOS" active />
          <BottomCenter />
          <BottomItem icon={<Wallet className="h-5 w-5" />} label="DEPÓSITO" to="/pay" />
          <BottomItem icon={<User className="h-5 w-5" />} label="PERFIL" to="/perfil" />
        </div>
      </nav>
    </div>
  );
}

function MissionCard({ mission }: { mission: Mission }) {
  const a = ACCENT[mission.accent];
  const pct = Math.min(100, Math.round((mission.progress / mission.goal) * 100));
  const isMoneyGoal = mission.goal >= 1000;
  const progressLabel = isMoneyGoal
    ? `${formatCOP(mission.progress)} / ${formatCOP(mission.goal)}`
    : `${mission.progress} / ${mission.goal}`;

  return (
    <div className={`relative overflow-hidden rounded-xl border border-purple-500/30 bg-[#0c0620]/85 p-3 ring-1 ${a.ring}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center">
          {mission.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-purple-100/80 leading-tight">{mission.title}</div>
          {mission.subtitle && (
            <div className={`font-display text-sm font-black leading-tight ${a.text}`}>
              {mission.subtitle}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] uppercase tracking-wider text-purple-300/70">Recompensa</div>
          <div className="flex items-center justify-end gap-1 font-display text-sm font-bold">
            {mission.reward.kind === "bonus" && (
              <>
                <span className="neon-green">$</span>
                <span className="text-white">{formatCOP(Number(mission.reward.value))}</span>
              </>
            )}
            {mission.reward.kind === "spins" && (
              <span className="text-rose-200">{mission.reward.value} Spins</span>
            )}
            {mission.reward.kind === "avatar" && (
              mission.rewardImage ? (
                <img
                  src={mission.rewardImage}
                  alt={String(mission.reward.value)}
                  className="h-12 w-12 rounded-lg border border-amber-400/50 object-cover shadow-[0_0_10px_rgba(251,191,36,0.45)]"
                />
              ) : (
                <span className="text-amber-200">Avatar</span>
              )
            )}
          </div>
          {mission.reward.kind === "bonus" && (
            <div className="text-[9px] uppercase tracking-wider text-purple-300/70">Bonus</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div className={`h-full ${a.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-purple-300/70">{progressLabel}</div>
        </div>
        <Link
          to={mission.cta.to}
          className={`shrink-0 rounded-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-lg shadow-purple-900/40 ${a.btn}`}
        >
          {mission.cta.label}
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-purple-500/20 bg-[#0c0620]/60 p-6 text-center text-xs text-purple-200/70">
      No hay misiones en esta categoría todavía.
    </div>
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
    <Link to="/ranking" className="-mt-7 flex w-16 flex-col items-center gap-1">
      <span className="theme-dark-fixed flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-500/20 bg-[#060210] shadow-lg shadow-purple-900/60">
        <Trophy className="h-7 w-7 text-purple-300/70" strokeWidth={2.2} />
      </span>
      <span className="text-[9px] font-bold tracking-wider text-purple-200">RANKING</span>
    </Link>
  );
}