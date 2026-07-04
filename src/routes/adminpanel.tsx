import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  BarChart3,
  Clipboard,
  Coins,
  Download,
  Gift,
  Home,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Menu,
  PanelLeft,
  Percent,
  Settings as SettingsIcon,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet as WalletIcon,
  Zap,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  GateMessage,
  PlaceholderSection,
  SidebarHeader,
  type AdminSection,
} from "@/components/admin/shared";
import { DashboardSection } from "@/components/admin/DashboardSection";
import { UsersSection } from "@/components/admin/UsersSection";
import { RtpSection } from "@/components/admin/RtpSection";
import { RouletteConfigSection } from "@/components/admin/RouletteConfigSection";
import { EarningsSection } from "@/components/admin/EarningsSection";
import { DepositsSection } from "@/components/admin/DepositsSection";
import { WithdrawalsSection } from "@/components/admin/WithdrawalsSection";
import { HomeContentSection } from "@/components/admin/HomeContentSection";
import { DrawerSection } from "@/components/admin/DrawerSection";
import { MissionsSection } from "@/components/admin/MissionsSection";
import { VipRewardsSection } from "@/components/admin/VipRewardsSection";
import { BenefitsSection } from "@/components/admin/BenefitsSection";
import { BoostSection } from "@/components/admin/BoostSection";
import { SportsSection } from "@/components/admin/SportsSection";

export const Route = createFileRoute("/adminpanel")({
  head: () => ({
    meta: [
      { title: "Panel de Administración — BETSPACE Casino" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (search) =>
    z
      .object({ section: z.string().optional() })
      .parse(search),
  component: AdminPanelPage,
});

const SECTIONS: { id: AdminSection; label: string; icon: typeof Home; ready: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: Home, ready: true },
  { id: "usuarios", label: "Usuarios", icon: Users, ready: true },
  { id: "rtp", label: "RTP de Juegos", icon: Percent, ready: true },
  { id: "roulette", label: "Ruleta", icon: Target, ready: true },
  { id: "vip_rewards", label: "Premios VIP", icon: Star, ready: true },
  { id: "beneficios", label: "Beneficios", icon: Gift, ready: true },
  { id: "ganancias", label: "Ganancias del Casino", icon: TrendingUp, ready: true },
  { id: "recargas", label: "Recargas", icon: WalletIcon, ready: true },
  { id: "retiros", label: "Retiros", icon: Download, ready: true },
  { id: "home_content", label: "Contenido Home", icon: ImageIcon, ready: true },
  { id: "drawer", label: "Menú Lateral", icon: PanelLeft, ready: true },
  { id: "eventos", label: "Eventos y Misiones", icon: Sparkles, ready: true },
  { id: "boost", label: "Modo Boost", icon: Zap, ready: true },
  { id: "deportes", label: "Deportes", icon: Trophy, ready: true },
  { id: "bonos", label: "Bonos", icon: Gift, ready: false },
  { id: "transacciones", label: "Transacciones", icon: Coins, ready: false },
  { id: "reportes", label: "Reportes", icon: BarChart3, ready: false },
  { id: "logs", label: "Logs del Sistema", icon: Clipboard, ready: false },
  { id: "config", label: "Configuración", icon: SettingsIcon, ready: false },
];

function AdminPanelPage() {
  const { user, loading, signOut } = useAuth();
  const isAdminQ = useIsAdmin();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const initialSection = (SECTIONS.some((s) => s.id === search.section)
    ? (search.section as AdminSection)
    : "dashboard") as AdminSection;
  const [section, setSection] = useState<AdminSection>(initialSection);
  const [navOpen, setNavOpen] = useState(false);

  // Sync state when the URL ?section= changes (e.g. clicking a notification while on /adminpanel).
  useEffect(() => {
    if (search.section && SECTIONS.some((s) => s.id === search.section)) {
      setSection(search.section as AdminSection);
    }
  }, [search.section]);

  // Admin panel is always dark, regardless of user's theme preference.
  useEffect(() => {
    const root = document.documentElement;
    const wasLight = root.classList.contains("light");
    root.classList.remove("light");
    root.classList.add("dark");
    return () => {
      if (wasLight) {
        root.classList.add("light");
        root.classList.remove("dark");
      }
    };
  }, []);

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060210] text-purple-200">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!user) {
    return (
      <GateMessage
        title="Inicia sesión"
        msg="Necesitas iniciar sesión para acceder al panel administrativo."
      />
    );
  }
  if (isAdminQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060210] text-purple-200">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isAdminQ.data === false) {
    return (
      <GateMessage
        title="Acceso restringido"
        msg="No tienes permisos para acceder al panel administrativo."
        cta="Volver al inicio"
        onCta={() => navigate({ to: "/home" })}
      />
    );
  }

  const currentLabel = SECTIONS.find((s) => s.id === section)?.label ?? "";

  const renderSection = () => {
    switch (section) {
      case "dashboard":
        return <DashboardSection />;
      case "usuarios":
        return <UsersSection />;
      case "rtp":
        return <RtpSection />;
      case "roulette":
        return <RouletteConfigSection />;
      case "vip_rewards":
        return <VipRewardsSection />;
      case "beneficios":
        return <BenefitsSection />;
      case "ganancias":
        return <EarningsSection />;
      case "recargas":
        return <DepositsSection />;
      case "retiros":
        return <WithdrawalsSection />;
      case "home_content":
        return <HomeContentSection />;
      case "drawer":
        return <DrawerSection />;
      case "eventos":
        return <MissionsSection />;
      case "boost":
        return <BoostSection />;
      case "deportes":
        return <SportsSection />;
      default:
        return <PlaceholderSection label={currentLabel} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-purple-500/20 bg-gradient-to-b from-[#0a0420] to-[#060210] p-4">
          <SidebarHeader />
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-purple-600/30 text-white shadow-[inset_0_0_0_1px_rgba(168,85,247,0.5)]"
                      : "text-purple-200/80 hover:bg-purple-600/15 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-semibold">{s.label}</span>
                  {!s.ready && (
                    <span className="ml-auto rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                      Pronto
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/home" });
            }}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar Sesión
          </button>
        </aside>

        {/* Content */}
        <main className="flex min-w-0 flex-1 flex-col px-3 pb-10 pt-4 sm:px-4 lg:px-6 lg:pt-6">
          {/* Mobile header */}
          <header
            className="-mx-3 -mt-4 flex items-center justify-between border-b border-purple-500/20 bg-[#060210] px-3 pb-3 lg:hidden"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
          >
            <button
              aria-label="Menú"
              onClick={() => setNavOpen(true)}
              className="rounded-md p-2 text-purple-100 hover:bg-white/5"
            >
              <Menu className="h-7 w-7" strokeWidth={3} />
            </button>
            <h1 className="font-display text-base font-bold uppercase tracking-widest">
              {currentLabel}
            </h1>
            <button
              onClick={() => navigate({ to: "/home" })}
              aria-label="Salir"
              className="rounded-md p-2 text-purple-100 hover:bg-white/5"
            >
              <X className="h-6 w-6" strokeWidth={3} />
            </button>
          </header>

          <div className="mt-3 hidden items-center justify-between lg:flex">
            <div>
              <h1 className="font-display text-2xl font-black uppercase tracking-widest">
                Panel de Administración
              </h1>
              <p className="text-xs text-purple-200/70">Gestiona tu casino en tiempo real</p>
            </div>
            <Link
              to="/home"
              className="inline-flex items-center gap-2 rounded-md border border-purple-500/30 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-100 hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al casino
            </Link>
          </div>

          <div className="mt-4 flex-1">{renderSection()}</div>
        </main>
      </div>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setNavOpen(false)} />
          <div
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-purple-500/40 bg-gradient-to-b from-[#0c0620] to-[#060210] p-4 shadow-[0_0_30px_rgba(168,85,247,0.35)]"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
            }}
          >
            <SidebarHeader />
            <nav className="mt-5 flex flex-col gap-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSection(s.id);
                      setNavOpen(false);
                    }}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm ${
                      active
                        ? "bg-purple-600/30 text-white"
                        : "text-purple-200/80 hover:bg-purple-600/15"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-semibold">{s.label}</span>
                    {!s.ready && (
                      <span className="ml-auto rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                        Pronto
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/home" });
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/20"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}