import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  ChevronRight,
  Gift,
  LogOut,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Trophy,
  Wallet as WalletIcon,
  Dice5,
  Banknote,
  History,
  Settings as SettingsIcon,
  IdCard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { supabase } from "@/integrations/supabase/client";
import astronaut from "@/assets/astronaut.svg";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Mi Perfil — BetSpaceman" },
      { name: "description", content: "Tu cuenta, seguridad, balance y estadísticas en BetSpaceman." },
    ],
  }),
  component: PerfilPage,
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

function shortId(id: string) {
  // Numeric-looking short ID derived from uuid
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(-6);
  const n = parseInt(hex || "0", 16) % 100000;
  return String(n).padStart(5, "0");
}

function useStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["perfil-stats", userId ?? null],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("type, amount, game")
        .eq("user_id", userId!)
        .limit(1000);
      const rows = data ?? [];
      let bets = 0;
      let won = 0;
      let withdrawn = 0;
      const gameCounts: Record<string, number> = {};
      for (const r of rows) {
        if (r.type === "bet") {
          bets++;
          if (r.game) gameCounts[r.game] = (gameCounts[r.game] ?? 0) + 1;
        }
        if (r.type === "win") won += Number(r.amount) || 0;
        if (r.type === "withdrawal") withdrawn += Math.abs(Number(r.amount) || 0);
      }
      const favorite = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      return { bets, won, withdrawn, favorite };
    },
  });
}

function PerfilPage() {
  const { user, loading, signOut } = useAuth();
  const me = useMe();
  const stats = useStats(user?.id);
  const navigate = useNavigate();

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-[#060210] text-white">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-purple-200/80">Inicia sesión para ver tu perfil.</p>
          <Link
            to="/home"
            className="rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-purple-500"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  const email = user?.email ?? "";
  const username =
    me.data?.profile?.username ??
    (user?.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0] ??
    "Usuario";
  const providers: string[] =
    (user?.app_metadata?.providers as string[] | undefined) ??
    (user?.app_metadata?.provider ? [user.app_metadata.provider as string] : []);
  const googleLinked = providers.includes("google");
  const emailVerified = !!user?.email_confirmed_at;
  const phone = user?.phone || (user?.user_metadata?.phone as string | undefined) || "";
  const balanceText = me.data ? formatCOP(me.data.balance) : "—";
  const bonusText = me.data ? formatCOP(me.data.bonus_balance) : "—";
  const verification = me.data?.profile?.verification_status ?? "unverified";
  const verified = verification === "verified";

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-10 pt-4 sm:max-w-lg sm:px-4">
        {/* Header */}
        <header
          className="-mx-3 flex items-center justify-between border-b border-purple-500/20 bg-[#060210] px-3 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <button
            onClick={() => navigate({ to: "/home" })}
            aria-label="Atrás"
            className="rounded-md p-2 text-purple-100 hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-sm font-bold uppercase tracking-widest">Mi Perfil</h1>
          <div className="w-9" />
        </header>

        {/* Identity card */}
        <section className="mt-4 rounded-2xl border border-fuchsia-500/60 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-4 shadow-[0_0_14px_rgba(217,70,239,0.25)]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-fuchsia-400/70 bg-purple-900/40 shadow-[0_0_18px_rgba(217,70,239,0.45)]">
                <img src={astronaut} alt="" className="h-12 w-12 object-contain" />
              </div>
              <button
                aria-label="Cambiar foto"
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-fuchsia-400/60 bg-[#0c0620] text-fuchsia-200 shadow"
              >
                <Camera className="h-3 w-3" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display truncate text-lg font-black uppercase tracking-wide text-white">
                {username}
              </div>
              <div className="text-[11px] text-purple-200/70">Usuario #{user ? shortId(user.id) : "00000"}</div>
              <div
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  verified
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                }`}
              >
                <BadgeCheck className="h-3 w-3" />
                {verified ? "Cuenta Verificada" : "Sin Verificar"}
              </div>
            </div>
          </div>

          {googleLinked && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-purple-500/30 bg-[#0c0620]/80 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <GoogleIcon className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">Google</div>
                  <div className="truncate text-[10px] text-purple-200/60">{email}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <BadgeCheck className="h-3 w-3" />
                Vinculado
              </span>
            </div>
          )}
        </section>

        {/* Balances */}
        <section className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-3 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-purple-200/80">
              <WalletIcon className="h-3.5 w-3.5" />
              Balance Principal
            </div>
            <div className="font-display mt-1 text-lg font-black">
              <span className="neon-green mr-0.5">$</span>
              <span className="text-white">{balanceText}</span>
            </div>
            <Link
              to="/pay"
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-purple-600 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-purple-500"
            >
              + Depositar
            </Link>
          </div>
          <div className="rounded-2xl border border-amber-400/60 bg-gradient-to-b from-[#2a1a05] to-[#0c0620] p-3 shadow-[0_0_10px_rgba(251,191,36,0.25)]">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber-200/90">
              <Gift className="h-3.5 w-3.5" />
              Balance Bonus
            </div>
            <div className="font-display mt-1 text-lg font-black">
              <span className="neon-green mr-0.5">$</span>
              <span className="text-white">{bonusText}</span>
            </div>
            <button className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-amber-400/60 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/20">
              Ver bonos
            </button>
          </div>
        </section>

        {/* Seguridad */}
        <SectionTitle>Seguridad de la cuenta</SectionTitle>
        <div className="space-y-2">
          <SecurityRow
            icon={<GoogleIcon className="h-4 w-4" />}
            title="Google"
            subtitle={email}
            status={googleLinked ? "ok" : "muted"}
            statusLabel={googleLinked ? "Vinculado" : "No vinculado"}
          />
          <SecurityRow
            icon={<Mail className="h-4 w-4 text-purple-200" />}
            title="Correo Electrónico"
            subtitle={email}
            status={emailVerified ? "ok" : "muted"}
            statusLabel={emailVerified ? "Verificado" : "Sin verificar"}
          />
          <SecurityRow
            icon={<Lock className="h-4 w-4 text-purple-200" />}
            title="Contraseña"
            subtitle="Actualízala con frecuencia"
            actionLabel="Cambiar"
          />
          <SecurityRow
            icon={<Phone className="h-4 w-4 text-purple-200" />}
            title="Número de Teléfono"
            subtitle={phone || "No vinculado"}
            actionLabel={phone ? "Cambiar" : "Vincular"}
          />
        </div>

        {/* Estadísticas */}
        <SectionTitle>Estadísticas</SectionTitle>
        <section className="grid grid-cols-4 gap-2 rounded-2xl border border-purple-500/30 bg-[#0c0620]/80 p-3">
          <StatCell
            icon={<Dice5 className="h-4 w-4 text-purple-200" />}
            label="Apuestas"
            value={String(stats.data?.bets ?? 0)}
          />
          <StatCell
            icon={<Trophy className="h-4 w-4 text-emerald-300" />}
            label="Ganado"
            value={`$${formatCOP(stats.data?.won ?? 0)}`}
            highlight="emerald"
          />
          <StatCell
            icon={<Banknote className="h-4 w-4 text-amber-300" />}
            label="Retirado"
            value={`$${formatCOP(stats.data?.withdrawn ?? 0)}`}
          />
          <StatCell
            icon={<Gift className="h-4 w-4 text-fuchsia-300" />}
            label="Favorito"
            value={(stats.data?.favorite ?? "—").toUpperCase()}
          />
        </section>

        {/* Acciones */}
        <div className="mt-5 space-y-2">
          <LinkRow icon={<History className="h-4 w-4 text-purple-200" />} label="Historial de Transacciones" />
          <LinkRow icon={<Gift className="h-4 w-4 text-purple-200" />} label="Mis Bonos" />
          <LinkRow
            icon={<IdCard className="h-4 w-4 text-purple-200" />}
            label="Verificación de Identidad"
            trailing={
              <span className={`text-[10px] font-semibold ${verified ? "text-emerald-300" : "text-amber-300"}`}>
                {verified ? "Completado" : "No completado"}
              </span>
            }
          />
          <LinkRow icon={<SettingsIcon className="h-4 w-4 text-purple-200" />} label="Configuración" />
        </div>

        {/* Logout */}
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/home" });
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/50 bg-rose-500/10 py-3 text-sm font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/20"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display mt-5 mb-2 text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
      {children}
    </h2>
  );
}

function SecurityRow({
  icon,
  title,
  subtitle,
  status,
  statusLabel,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  status?: "ok" | "muted";
  statusLabel?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-[#0c0620]/80 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600/20 ring-1 ring-purple-400/30">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white">{title}</div>
          {subtitle && <div className="truncate text-[10px] text-purple-200/60">{subtitle}</div>}
        </div>
      </div>
      {statusLabel ? (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            status === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-purple-500/40 bg-purple-500/10 text-purple-200"
          }`}
        >
          {status === "ok" && <BadgeCheck className="h-3 w-3" />}
          {statusLabel}
        </span>
      ) : actionLabel ? (
        <button className="flex items-center gap-1 text-[11px] font-bold text-fuchsia-300 hover:text-fuchsia-200">
          {actionLabel}
          <ChevronRight className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function StatCell({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: "emerald";
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-purple-500/20 bg-[#150830]/60 px-1.5 py-2 text-center">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-600/20 ring-1 ring-purple-400/30">
        {icon}
      </div>
      <div className={`font-display truncate w-full text-[11px] font-bold ${highlight === "emerald" ? "text-emerald-300" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-purple-200/70">{label}</div>
    </div>
  );
}

function LinkRow({
  icon,
  label,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button className="flex w-full items-center justify-between rounded-xl border border-purple-500/30 bg-[#0c0620]/80 px-3 py-3 hover:border-fuchsia-500/50 hover:bg-[#150830]/70">
      <span className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20 ring-1 ring-purple-400/30">
          {icon}
        </span>
        <span className="text-xs font-semibold text-white">{label}</span>
      </span>
      <span className="flex items-center gap-2 text-purple-300/70">
        {trailing}
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.3 35.4 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}