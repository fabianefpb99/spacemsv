import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Check,
  Clipboard,
  Coins,
  Cog,
  Download,
  Gift,
  Home,
  Loader2,
  Lock,
  LockOpen,
  LogOut,
  Menu,
  Minus,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Users,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import astronaut from "@/assets/astronaut.svg";
import {
  adminAdjustBalance,
  adminGetCasinoStats,
  adminGetDashboardKpis,
  adminGetUserDetail,
  adminGetUserTransactions,
  adminListRtp,
  adminListUsers,
  adminResetPassword,
  adminSetBlock,
  adminUpdateRtp,
} from "@/lib/admin/admin.functions";
import {
  adminApproveDeposit,
  adminGetDeposit,
  adminListDeposits,
  adminRejectDeposit,
} from "@/lib/deposits/deposit.functions";

export const Route = createFileRoute("/adminpanel")({
  head: () => ({
    meta: [
      { title: "Panel de Administración — BetSpaceman" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPanelPage,
});

type Section =
  | "dashboard"
  | "usuarios"
  | "rtp"
  | "ganancias"
  | "recargas"
  | "retiros"
  | "bonos"
  | "transacciones"
  | "reportes"
  | "logs"
  | "config";

const SECTIONS: { id: Section; label: string; icon: typeof Home; ready: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: Home, ready: true },
  { id: "usuarios", label: "Usuarios", icon: Users, ready: true },
  { id: "rtp", label: "RTP de Juegos", icon: Percent, ready: true },
  { id: "ganancias", label: "Ganancias del Casino", icon: TrendingUp, ready: true },
  { id: "recargas", label: "Recargas", icon: WalletIcon, ready: true },
  { id: "retiros", label: "Retiros", icon: Download, ready: false },
  { id: "bonos", label: "Bonos", icon: Gift, ready: false },
  { id: "transacciones", label: "Transacciones", icon: Coins, ready: false },
  { id: "reportes", label: "Reportes", icon: BarChart3, ready: false },
  { id: "logs", label: "Logs del Sistema", icon: Clipboard, ready: false },
  { id: "config", label: "Configuración", icon: SettingsIcon, ready: false },
];

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}
function shortId(id: string | null | undefined) {
  if (!id) return "—";
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(-6);
  const n = parseInt(hex || "0", 16) % 100000;
  return String(n).padStart(5, "0");
}

function AdminPanelPage() {
  const { user, loading, signOut } = useAuth();
  const isAdminQ = useIsAdmin();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  // Gate
  if (!loading && !user) {
    return <GateMessage title="Inicia sesión" msg="Necesitas iniciar sesión para acceder al panel administrativo." />;
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

          <div className="mt-4 flex-1">
            {section === "dashboard" && <DashboardSection />}
            {section === "usuarios" && <UsersSection />}
            {section === "rtp" && <RtpSection />}
            {section === "ganancias" && <EarningsSection />}
            {section === "recargas" && <DepositsSection />}
            {section !== "dashboard" &&
              section !== "usuarios" &&
              section !== "rtp" &&
              section !== "ganancias" &&
              section !== "recargas" && <PlaceholderSection label={currentLabel} />}
          </div>
        </main>
      </div>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-purple-500/40 bg-gradient-to-b from-[#0c0620] to-[#060210] p-4 shadow-[0_0_30px_rgba(168,85,247,0.35)]">
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

function SidebarHeader() {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-fuchsia-500/40 bg-gradient-to-r from-purple-900/40 to-fuchsia-900/30 p-2.5 shadow-[0_0_14px_rgba(217,70,239,0.2)]">
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-fuchsia-400/50 bg-[#150830]">
        <ShieldAlert className="h-4 w-4 text-fuchsia-300" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-xs font-black uppercase tracking-widest text-white">
          BetSpace
        </div>
        <div className="text-[9px] uppercase tracking-widest text-fuchsia-300/80">
          Casino Admin
        </div>
      </div>
    </div>
  );
}

function GateMessage({
  title,
  msg,
  cta,
  onCta,
}: {
  title: string;
  msg: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#060210] px-6 text-center">
      <ShieldAlert className="h-10 w-10 text-fuchsia-400" />
      <h1 className="font-display text-xl font-black uppercase tracking-widest text-white">
        {title}
      </h1>
      <p className="max-w-sm text-sm text-purple-200/80">{msg}</p>
      {cta && (
        <button
          onClick={onCta}
          className="mt-2 rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-purple-500"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

/* ============================ DASHBOARD =============================== */

function KpiCard({
  label,
  value,
  accent = "purple",
  icon: Icon,
}: {
  label: string;
  value: string;
  accent?: "purple" | "amber" | "emerald" | "fuchsia";
  icon: typeof Home;
}) {
  const borders: Record<string, string> = {
    purple: "border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]",
    amber: "border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]",
    emerald: "border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
    fuchsia: "border-fuchsia-500/60 shadow-[0_0_12px_rgba(217,70,239,0.25)]",
  };
  const iconColors: Record<string, string> = {
    purple: "text-purple-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    fuchsia: "text-fuchsia-300",
  };
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-3 sm:p-4 ${borders[accent]}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/80">
          {label}
        </div>
        <Icon className={`h-4 w-4 ${iconColors[accent]}`} />
      </div>
      <div className="mt-2 font-display text-lg font-black sm:text-2xl">{value}</div>
    </div>
  );
}

function DashboardSection() {
  const fn = useServerFn(adminGetDashboardKpis);
  const q = useQuery({
    queryKey: ["admin-dashboard-kpis"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });
  const totals = q.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Usuarios totales"
          value={totals ? formatCOP(totals.totalUsers) : "—"}
          icon={Users}
          accent="purple"
        />
        <KpiCard
          label="Apuestas hoy"
          value={totals ? `$${formatCOP(totals.betsToday)}` : "—"}
          icon={TrendingUp}
          accent="amber"
        />
        <KpiCard
          label="Ganancias hoy"
          value={totals ? `$${formatCOP(totals.ggrToday)}` : "—"}
          icon={Coins}
          accent="emerald"
        />
      </div>
      <Panel title="Bienvenido al panel de administración">
        <p className="text-sm text-purple-200/80">
          Desde aquí puedes gestionar usuarios, ajustar el RTP de cada juego y monitorear las
          ganancias del casino en tiempo real. Las secciones de Depósitos, Retiros, Bonos,
          Reportes y Logs estarán disponibles en próximas fases.
        </p>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-purple-500/30 bg-[#0c0620]/80 p-3 shadow-[0_0_10px_rgba(168,85,247,0.15)] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white sm:text-sm">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/* ============================ USERS =============================== */

type UserRow = {
  id: string;
  email: string | null;
  username: string | null;
  verification_status: string | null;
  is_blocked: boolean | null;
  created_at: string | null;
  balance: number | null;
  bonus_balance: number | null;
};

function UsersSection() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked" | "verified" | "unverified">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const fn = useServerFn(adminListUsers);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["admin-users", debounced, status, page],
    queryFn: () => fn({ data: { search: debounced, status, page, pageSize: 20 } }),
  });

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <Panel
        title="Usuarios registrados"
        actions={
          <button
            onClick={() => q.refetch()}
            className="flex items-center gap-1 rounded-md border border-purple-500/30 px-2 py-1 text-[10px] uppercase tracking-widest text-purple-200 hover:bg-white/5"
          >
            <RefreshCw className="h-3 w-3" />
            Actualizar
          </button>
        }
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-300/60" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por correo, username o ID…"
              className="w-full rounded-md border border-purple-500/30 bg-[#150830] py-2 pl-7 pr-2 text-xs text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="blocked">Bloqueados</option>
            <option value="verified">Verificados</option>
            <option value="unverified">Sin verificar</option>
          </select>
        </div>

        {q.isLoading ? (
          <div className="flex items-center justify-center py-12 text-purple-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : q.data && q.data.rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-purple-200/60">Sin resultados.</div>
        ) : (
          <ul className="space-y-2">
            {(q.data?.rows as UserRow[] | undefined)?.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => setSelected(u.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-purple-500/20 bg-[#150830]/60 p-2.5 text-left transition hover:border-fuchsia-500/50 hover:bg-[#1a0b3a]/80"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-fuchsia-400/40 bg-purple-900/40">
                    <img src={astronaut} alt="" className="h-7 w-7 object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-white">
                        {u.username ?? "—"}
                      </span>
                      <span className="text-[10px] text-purple-300/70">#{shortId(u.id)}</span>
                    </div>
                    <div className="truncate text-[11px] text-purple-200/60">{u.email}</div>
                  </div>
                  <div className="hidden text-right text-[10px] sm:block">
                    <div className="text-purple-300/70 uppercase tracking-wider">Saldo</div>
                    <div className="font-display text-xs font-bold text-white">
                      <span className="neon-green mr-0.5">$</span>
                      {formatCOP(Number(u.balance ?? 0))}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      u.is_blocked
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {u.is_blocked ? "Bloqueado" : "Activo"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between text-[10px] text-purple-200/70">
          <span>
            Página {page} de {totalPages} · {q.data?.total ?? 0} usuarios
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-purple-500/30 px-2 py-1 text-xs disabled:opacity-40"
            >
              ←
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-purple-500/30 px-2 py-1 text-xs disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </Panel>

      {selected && <UserDetailDrawer userId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const detailFn = useServerFn(adminGetUserDetail);
  const txFn = useServerFn(adminGetUserTransactions);
  const adjustFn = useServerFn(adminAdjustBalance);
  const blockFn = useServerFn(adminSetBlock);
  const resetFn = useServerFn(adminResetPassword);
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => detailFn({ data: { userId } }),
  });
  const txs = useQuery({
    queryKey: ["admin-user-tx", userId],
    queryFn: () => txFn({ data: { userId, limit: 30 } }),
  });

  const adjust = useMutation({
    mutationFn: (vars: { amount: number; target: "real" | "bonus"; reason?: string }) =>
      adjustFn({ data: { userId, ...vars } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-user-tx", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const blockMut = useMutation({
    mutationFn: (blocked: boolean) => blockFn({ data: { userId, blocked } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const resetMut = useMutation({
    mutationFn: () => resetFn({ data: { userId } }),
  });

  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState<"real" | "bonus">("real");
  const [reason, setReason] = useState("");

  const submitAdjust = (sign: 1 | -1) => {
    const n = Math.floor(Number(amount));
    if (!n || isNaN(n)) return;
    adjust.mutate({ amount: sign * Math.abs(n), target, reason: reason || undefined });
    setAmount("");
    setReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full flex-col overflow-y-auto border-l border-fuchsia-500/40 bg-gradient-to-b from-[#0c0620] to-[#060210] shadow-[0_0_30px_rgba(217,70,239,0.3)] sm:my-6 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:border">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-purple-500/30 bg-[#060210]/90 px-4 py-3 backdrop-blur">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white">
            Detalle del usuario
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-purple-200 hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {detail.isLoading || !detail.data ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-purple-300" />
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {/* Identity */}
            <div className="flex items-center gap-3 rounded-2xl border border-fuchsia-500/40 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-fuchsia-400/60 bg-purple-900/40">
                <img src={astronaut} alt="" className="h-10 w-10 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-base font-black text-white">
                  {detail.data.profile?.username ?? "—"}
                </div>
                <div className="truncate text-[11px] text-purple-200/70">{detail.data.email}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      detail.data.profile?.is_blocked
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {detail.data.profile?.is_blocked ? "Bloqueado" : "Activo"}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      detail.data.profile?.verification_status === "verified"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {detail.data.profile?.verification_status === "verified"
                      ? "Verificado"
                      : "Sin verificar"}
                  </span>
                  <span className="text-[10px] text-purple-300/60">
                    #{shortId(detail.data.profile?.id)}
                  </span>
                </div>
              </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Balance Principal"
                value={`$${formatCOP(detail.data.balance)}`}
                icon={WalletIcon}
                accent="purple"
              />
              <KpiCard
                label="Balance Bonus"
                value={`$${formatCOP(detail.data.bonus_balance)}`}
                icon={Gift}
                accent="amber"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatChip label="Total apostado" value={`$${formatCOP(detail.data.stats.totalBet)}`} />
              <StatChip
                label="Total ganado"
                value={`$${formatCOP(detail.data.stats.totalWin)}`}
                color="emerald"
              />
              <StatChip
                label="Total depositado"
                value={`$${formatCOP(detail.data.stats.totalDeposit)}`}
              />
              <StatChip
                label="Total retirado"
                value={`$${formatCOP(detail.data.stats.totalWithdraw)}`}
              />
              <StatChip
                label="Ganancia neta"
                value={`$${formatCOP(detail.data.stats.net)}`}
                color={detail.data.stats.net >= 0 ? "emerald" : "rose"}
              />
              <StatChip
                label="Juego favorito"
                value={(detail.data.stats.favorite ?? "—").toUpperCase()}
              />
            </div>

            <div className="text-[10px] text-purple-200/60">
              Último acceso:{" "}
              {detail.data.lastSignInAt
                ? new Date(detail.data.lastSignInAt).toLocaleString("es-CO")
                : "—"}
            </div>

            {/* Balance actions */}
            <Panel title="Ajustar saldo">
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as "real" | "bonus")}
                  className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white"
                >
                  <option value="real">Saldo real</option>
                  <option value="bonus">Saldo bonus</option>
                </select>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Monto en COP"
                  className="flex-1 rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white placeholder:text-purple-300/40"
                />
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="mt-2 w-full rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white placeholder:text-purple-300/40"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => submitAdjust(1)}
                  disabled={adjust.isPending || !amount}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
                <button
                  onClick={() => submitAdjust(-1)}
                  disabled={adjust.isPending || !amount}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  <Minus className="h-3.5 w-3.5" />
                  Descontar
                </button>
              </div>
              {adjust.isError && (
                <div className="mt-2 text-[11px] text-rose-300">
                  Error: {(adjust.error as Error).message}
                </div>
              )}
            </Panel>

            {/* Actions */}
            <Panel title="Acciones administrativas">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => blockMut.mutate(!detail.data!.profile?.is_blocked)}
                  disabled={blockMut.isPending}
                  className={`flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                    detail.data.profile?.is_blocked
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  }`}
                >
                  {detail.data.profile?.is_blocked ? (
                    <>
                      <LockOpen className="h-3.5 w-3.5" />
                      Desbloquear
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Bloquear
                    </>
                  )}
                </button>
                <button
                  onClick={() => resetMut.mutate()}
                  disabled={resetMut.isPending}
                  className="flex items-center justify-center gap-1 rounded-md border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-purple-200 hover:bg-purple-500/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset contraseña
                </button>
              </div>
              {resetMut.data?.action_link && (
                <div className="mt-2 break-all rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-200">
                  Enlace de recuperación enviado al correo. URL: {resetMut.data.action_link}
                </div>
              )}
            </Panel>

            {/* History */}
            <Panel title="Historial reciente">
              {txs.isLoading ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
              ) : (
                <ul className="space-y-1">
                  {txs.data?.map((t: { id: string; type: string; amount: number; created_at: string; game?: string | null }) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-purple-500/15 bg-[#150830]/50 px-2 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            t.type === "win" || t.type === "deposit"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : t.type === "bet" || t.type === "withdrawal"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-purple-500/15 text-purple-200"
                          }`}
                        >
                          {t.type}
                        </span>
                        <span className="text-purple-200/70">{t.game ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-display text-xs font-bold ${
                            Number(t.amount) >= 0 ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {Number(t.amount) >= 0 ? "+" : ""}
                          {formatCOP(Number(t.amount))}
                        </span>
                        <span className="text-[9px] text-purple-300/50">
                          {t.created_at ? new Date(t.created_at).toLocaleString("es-CO") : ""}
                        </span>
                      </div>
                    </li>
                  )) ?? null}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "emerald" | "rose";
}) {
  const valColor =
    color === "emerald" ? "text-emerald-300" : color === "rose" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-lg border border-purple-500/20 bg-[#150830]/60 px-2 py-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-purple-200/70">{label}</div>
      <div className={`font-display mt-0.5 text-xs font-bold ${valColor}`}>{value}</div>
    </div>
  );
}

/* ============================ RTP =============================== */

const GAME_LABELS: Record<string, string> = {
  spaceman: "SPACEMAN",
  slot: "TRAGAMONEDAS",
  mines: "BUSCAMINAS",
  dice: "DADOS",
  blackjack: "BLACKJACK",
};

function RtpSection() {
  const fn = useServerFn(adminListRtp);
  const upd = useServerFn(adminUpdateRtp);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-rtp"], queryFn: () => fn() });

  const mut = useMutation({
    mutationFn: (vars: { game: string; rtp_target: number; is_active?: boolean }) =>
      upd({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-rtp"] }),
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Panel title="RTP de Juegos">
      <p className="mb-3 text-[11px] text-purple-200/70">
        Configura el RTP (Return to Player) de cada juego. Los cambios se almacenan en Lovable
        Cloud y se aplicarán a futuras partidas.
      </p>
      {q.isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
      ) : (
        <div className="space-y-2">
          {q.data?.map((row: { game: string; rtp_target: number; rtp_live: number | null; is_active: boolean; updated_at?: string | null; updated_by_label?: string | null }) => {
            const draft = drafts[row.game] ?? String(row.rtp_target);
            const dirty = Number(draft) !== Number(row.rtp_target);
            return (
              <div
                key={row.game}
                className="flex flex-col gap-2 rounded-xl border border-purple-500/20 bg-[#150830]/60 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-fuchsia-400/40 bg-purple-900/30">
                    <Percent className="h-4 w-4 text-fuchsia-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-xs font-bold uppercase tracking-widest text-white">
                      {GAME_LABELS[row.game] ?? row.game.toUpperCase()}
                    </div>
                    <div className="text-[10px] text-purple-200/60">
                      RTP real (30d):{" "}
                      <span className="text-purple-100">
                        {row.rtp_live != null ? `${row.rtp_live}%` : "Sin datos"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [row.game]: e.target.value.replace(/[^0-9.]/g, "") }))
                    }
                    className="w-20 rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-center text-xs font-bold text-white focus:border-fuchsia-400/60 focus:outline-none"
                  />
                  <span className="text-[10px] text-purple-300/60">%</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      row.is_active
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {row.is_active ? "Activo" : "Pausado"}
                  </span>
                  <button
                    disabled={!dirty || mut.isPending}
                    onClick={() => {
                      const n = Number(draft);
                      if (!isNaN(n) && n >= 50 && n <= 100)
                        mut.mutate({ game: row.game, rtp_target: Number(n.toFixed(2)) });
                    }}
                    className="rounded-md bg-purple-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-purple-500 disabled:opacity-40"
                  >
                    Guardar
                  </button>
                </div>
                <div className="text-right text-[9px] text-purple-300/60 sm:ml-2">
                  {row.updated_at ? new Date(row.updated_at).toLocaleString("es-CO") : "—"}
                  <br />
                  <span className="text-fuchsia-300/70">
                    {row.updated_by_label ? `por ${row.updated_by_label}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ============================ EARNINGS =============================== */

function EarningsSection() {
  const [range, setRange] = useState<"today" | "week" | "month" | "custom">("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const fn = useServerFn(adminGetCasinoStats);

  const q = useQuery({
    queryKey: ["admin-stats", range, from, to],
    queryFn: () =>
      fn({
        data: {
          range,
          from: range === "custom" && from ? new Date(from).toISOString() : undefined,
          to: range === "custom" && to ? new Date(to).toISOString() : undefined,
        },
      }),
    refetchInterval: 30_000,
  });

  // Realtime: invalidate when new transactions arrive
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("admin-stats-tx")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        () => {
          qc.invalidateQueries({ queryKey: ["admin-stats"] });
          qc.invalidateQueries({ queryKey: ["admin-dashboard-kpis"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const t = q.data?.totals;
  return (
    <div className="space-y-4">
      <Panel title="Ganancias del casino" actions={null}>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["today", "week", "month", "custom"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                range === r
                  ? "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-200"
                  : "border-purple-500/30 text-purple-200/70 hover:bg-white/5"
              }`}
            >
              {r === "today" ? "Hoy" : r === "week" ? "Semana" : r === "month" ? "Mes" : "Rango"}
            </button>
          ))}
          {range === "custom" && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-1 text-[10px] text-white"
              />
              <span className="text-purple-300/60">→</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-1 text-[10px] text-white"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Apuestas"
            value={t ? `$${formatCOP(t.bets)}` : "—"}
            icon={TrendingUp}
            accent="purple"
          />
          <KpiCard
            label="Premios pagados"
            value={t ? `$${formatCOP(t.wins)}` : "—"}
            icon={Gift}
            accent="amber"
          />
          <KpiCard
            label="Utilidad neta (GGR)"
            value={t ? `$${formatCOP(t.ggr)}` : "—"}
            icon={Coins}
            accent="emerald"
          />
          <KpiCard
            label="Ventaja de casa real"
            value={t ? `${t.houseEdge}%` : "—"}
            icon={Percent}
            accent="fuchsia"
          />
          <KpiCard
            label="Depósitos"
            value={t ? `$${formatCOP(t.deposits)}` : "—"}
            icon={WalletIcon}
            accent="purple"
          />
          <KpiCard
            label="Retiros"
            value={t ? `$${formatCOP(t.withdrawals)}` : "—"}
            icon={Download}
            accent="purple"
          />
        </div>
      </Panel>

      <Panel title="Métricas por juego">
        {q.isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
        ) : (q.data?.games.length ?? 0) === 0 ? (
          <div className="py-6 text-center text-xs text-purple-200/60">
            Sin actividad en el rango seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-purple-300/70">
                  <th className="py-2">Juego</th>
                  <th className="py-2 text-right">Apuestas</th>
                  <th className="py-2 text-right">Premios</th>
                  <th className="py-2 text-right">GGR</th>
                  <th className="py-2 text-right">RTP</th>
                  <th className="py-2 text-right">Edge</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.games.map((g) => (
                  <tr key={g.game} className="border-t border-purple-500/15">
                    <td className="py-2 font-bold text-white">
                      {GAME_LABELS[g.game] ?? g.game.toUpperCase()}
                    </td>
                    <td className="py-2 text-right">${formatCOP(g.bets)}</td>
                    <td className="py-2 text-right text-amber-300">${formatCOP(g.wins)}</td>
                    <td
                      className={`py-2 text-right font-bold ${
                        g.ggr >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      ${formatCOP(g.ggr)}
                    </td>
                    <td className="py-2 text-right">{g.rtp}%</td>
                    <td className="py-2 text-right text-fuchsia-300">{g.edge}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ============================ DEPOSITS =============================== */

const DEPOSIT_STATUSES = [
  { v: "all", l: "Todos" },
  { v: "pendiente_revision", l: "Pendiente Revisión" },
  { v: "pendiente_pago", l: "Pendiente Pago" },
  { v: "aprobada", l: "Aprobada" },
  { v: "rechazada", l: "Rechazada" },
  { v: "expirada", l: "Expirada" },
] as const;

function depositStatusBadge(s: string) {
  const m: Record<string, string> = {
    pendiente_pago: "border-purple-500/40 bg-purple-500/10 text-purple-200",
    pendiente_revision: "border-amber-500/50 bg-amber-500/10 text-amber-200",
    aprobada: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
    rechazada: "border-rose-500/50 bg-rose-500/10 text-rose-200",
    expirada: "border-purple-500/30 bg-purple-500/5 text-purple-300/70",
  };
  return m[s] ?? "border-purple-500/30 bg-purple-500/5 text-purple-200";
}

type DepositRow = {
  id: string; user_id: string; username: string | null; email: string | null;
  amount: number; bonus: number; method: string; reference: string; status: string;
  created_at: string; confirmed_at: string | null;
  payer_first_name: string | null; payer_last_name: string | null; payer_phone: string | null;
  payer_self: boolean | null; reject_reason: string | null;
  prev_balance: number | null; new_balance: number | null;
};

function DepositsSection() {
  const listFn = useServerFn(adminListDeposits);
  const qc = useQueryClient();
  const [status, setStatus] = useState<typeof DEPOSIT_STATUSES[number]["v"]>("pendiente_revision");
  const [method, setMethod] = useState<"all"|"nequi"|"breb">("all");
  const [range, setRange] = useState<"today"|"week"|"month"|"all">("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  const q = useQuery({
    queryKey: ["admin-deposits", status, method, range, debounced, page],
    queryFn: () => listFn({ data: { status, method, range, search: debounced, page, pageSize: 25 } }),
  });

  useEffect(() => {
    const ch = supabase.channel("admin-deposits-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests" },
        () => { qc.invalidateQueries({ queryKey: ["admin-deposits"] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <Panel title="Recargas (depósitos manuales)" actions={
        <button onClick={() => q.refetch()} className="flex items-center gap-1 rounded-md border border-purple-500/30 px-2 py-1 text-[10px] uppercase tracking-widest text-purple-200 hover:bg-white/5">
          <RefreshCw className="h-3 w-3" /> Actualizar
        </button>
      }>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-300/60" />
            <input value={search} onChange={(e)=>{setSearch(e.target.value); setPage(1);}}
              placeholder="Referencia, correo, usuario o ID…"
              className="w-full rounded-md border border-purple-500/30 bg-[#150830] py-2 pl-7 pr-2 text-xs text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none" />
          </div>
          <select value={status} onChange={(e)=>{setStatus(e.target.value as typeof status); setPage(1);}}
            className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white">
            {DEPOSIT_STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
          <select value={method} onChange={(e)=>{setMethod(e.target.value as typeof method); setPage(1);}}
            className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white">
            <option value="all">Todos los métodos</option>
            <option value="nequi">Nequi</option>
            <option value="breb">BRE-B</option>
          </select>
          <select value={range} onChange={(e)=>{setRange(e.target.value as typeof range); setPage(1);}}
            className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-2 text-xs text-white">
            <option value="all">Todo el tiempo</option>
            <option value="today">Hoy</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </div>

        {q.isLoading ? (
          <div className="flex items-center justify-center py-12 text-purple-200/70"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : q.data && q.data.rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-purple-200/60">Sin recargas.</div>
        ) : (
          <ul className="space-y-2">
            {(q.data?.rows as DepositRow[] | undefined)?.map(d => (
              <li key={d.id}>
                <button onClick={() => setSelected(d.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-purple-500/20 bg-[#150830]/60 p-2.5 text-left transition hover:border-fuchsia-500/50 hover:bg-[#1a0b3a]/80">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{d.reference}</span>
                      <span className="text-[10px] text-purple-300/70">#{shortId(d.user_id)}</span>
                      <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple-200">{d.method}</span>
                    </div>
                    <div className="truncate text-[11px] text-purple-200/60">{d.username ?? d.email} · {new Date(d.created_at).toLocaleString("es-CO")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xs font-bold text-white">
                      <span className="neon-green mr-0.5">$</span>{formatCOP(Number(d.amount))}
                    </div>
                    {Number(d.bonus) > 0 && <div className="text-[9px] font-bold text-amber-300">+${formatCOP(Number(d.bonus))}</div>}
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${depositStatusBadge(d.status)}`}>
                    {d.status.replace("_"," ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between text-[10px] text-purple-200/70">
          <span>Página {page} de {totalPages} · {q.data?.total ?? 0} recargas</span>
          <div className="flex gap-1">
            <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-md border border-purple-500/30 px-2 py-1 text-xs disabled:opacity-40">←</button>
            <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="rounded-md border border-purple-500/30 px-2 py-1 text-xs disabled:opacity-40">→</button>
          </div>
        </div>
      </Panel>

      {selected && <DepositDetailDrawer id={selected} onClose={()=>setSelected(null)} />}
    </div>
  );
}

function DepositDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const getFn = useServerFn(adminGetDeposit);
  const approveFn = useServerFn(adminApproveDeposit);
  const rejectFn = useServerFn(adminRejectDeposit);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-deposit", id], queryFn: () => getFn({ data: { id } }) });
  const approve = useMutation({
    mutationFn: () => approveFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-deposits"] }); qc.invalidateQueries({ queryKey: ["admin-deposit", id] }); },
  });
  const reject = useMutation({
    mutationFn: (reason: string) => rejectFn({ data: { id, reason } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-deposits"] }); qc.invalidateQueries({ queryKey: ["admin-deposit", id] }); },
  });
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const d = q.data as DepositRow | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full flex-col overflow-y-auto border-l border-fuchsia-500/40 bg-gradient-to-b from-[#0c0620] to-[#060210] shadow-[0_0_30px_rgba(217,70,239,0.3)] sm:my-6 sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-2xl sm:border">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-purple-500/30 bg-[#060210]/90 px-4 py-3 backdrop-blur">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white">Detalle de recarga</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-purple-200 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>
        {q.isLoading || !d ? (
          <div className="flex flex-1 items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-purple-300" /></div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3 rounded-xl border border-fuchsia-500/40 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-fuchsia-400/60 bg-purple-900/40">
                <img src={astronaut} alt="" className="h-9 w-9 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-base font-black text-white">{d.username ?? "—"}</div>
                <div className="truncate text-[11px] text-purple-200/70">{d.email}</div>
                <div className="text-[10px] text-purple-300/60">#{shortId(d.user_id)}</div>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${depositStatusBadge(d.status)}`}>
                {d.status.replace("_"," ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info2 k="Monto" v={`$${formatCOP(Number(d.amount))}`} />
              <Info2 k="Bonus" v={`$${formatCOP(Number(d.bonus))}`} />
              <Info2 k="Método" v={d.method.toUpperCase()} />
              <Info2 k="Referencia" v={d.reference} mono />
              <Info2 k="Creada" v={new Date(d.created_at).toLocaleString("es-CO")} />
              <Info2 k="Confirmada" v={d.confirmed_at ? new Date(d.confirmed_at).toLocaleString("es-CO") : "—"} />
            </div>

            <Panel title="Datos del pagador">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Info2 k="¿Es el titular?" v={d.payer_self == null ? "—" : d.payer_self ? "Sí" : "No"} />
                <Info2 k="Teléfono" v={d.payer_phone ?? "—"} />
                <Info2 k="Nombres" v={d.payer_first_name ?? "—"} />
                <Info2 k="Apellidos" v={d.payer_last_name ?? "—"} />
              </div>
            </Panel>

            {d.status === "aprobada" && (
              <Panel title="Movimiento aplicado">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Info2 k="Saldo anterior" v={`$${formatCOP(Number(d.prev_balance ?? 0))}`} />
                  <Info2 k="Saldo nuevo" v={`$${formatCOP(Number(d.new_balance ?? 0))}`} />
                </div>
              </Panel>
            )}
            {d.status === "rechazada" && d.reject_reason && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-rose-200">
                <b className="uppercase tracking-widest text-[10px]">Motivo del rechazo:</b><br />{d.reject_reason}
              </div>
            )}

            {d.status === "pendiente_revision" && (
              <>
                {!showReject ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => approve.mutate()}
                      disabled={approve.isPending}
                      className="flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />Aprobar
                    </button>
                    <button onClick={() => setShowReject(true)}
                      className="flex items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-500">
                      <X className="h-3.5 w-3.5" />Rechazar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea value={reason} onChange={(e)=>setReason(e.target.value)}
                      placeholder="Motivo del rechazo (obligatorio)" rows={3} maxLength={300}
                      className="w-full rounded-md border border-rose-500/30 bg-[#150830] px-2 py-2 text-xs text-white placeholder:text-purple-300/40" />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={()=>{setShowReject(false); setReason("");}}
                        className="rounded-md border border-purple-500/30 px-3 py-2 text-xs font-bold uppercase text-purple-200">Cancelar</button>
                      <button onClick={()=>reject.mutate(reason.trim())} disabled={reason.trim().length<3 || reject.isPending}
                        className="rounded-md bg-rose-600 px-3 py-2 text-xs font-bold uppercase text-white disabled:opacity-50">Confirmar rechazo</button>
                    </div>
                  </div>
                )}
                {approve.isError && <p className="text-xs text-rose-300">Error: {(approve.error as Error).message}</p>}
                {reject.isError && <p className="text-xs text-rose-300">Error: {(reject.error as Error).message}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Info2({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-purple-500/20 bg-[#150830]/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-purple-300/70">{k}</div>
      <div className={`text-xs font-bold text-white ${mono ? "font-mono" : ""}`}>{v}</div>
    </div>
  );
}

/* ============================ PLACEHOLDERS =============================== */

function PlaceholderSection({ label }: { label: string }) {
  return (
    <Panel title={label}>
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Bell className="h-8 w-8 text-fuchsia-400" />
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white">
          Próximamente
        </h3>
        <p className="max-w-md text-xs text-purple-200/70">
          Este módulo está reservado para una próxima fase. La estructura de datos y los permisos
          ya están listos en Lovable Cloud.
        </p>
      </div>
    </Panel>
  );
}