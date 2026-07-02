import { Bell, Home, ShieldAlert } from "lucide-react";
import type React from "react";

/* --------------------------------- Tipos --------------------------------- */

export type AdminSection =
  | "dashboard"
  | "usuarios"
  | "rtp"
  | "roulette"
  | "vip_rewards"
  | "beneficios"
  | "ganancias"
  | "recargas"
  | "retiros"
  | "home_content"
  | "drawer"
  | "eventos"
  | "boost"
  | "bonos"
  | "transacciones"
  | "reportes"
  | "logs"
  | "config";

export type UserRow = {
  id: string;
  email: string | null;
  username: string | null;
  verification_status: string | null;
  is_blocked: boolean | null;
  created_at: string | null;
  balance: number | null;
  bonus_balance: number | null;
  avatar_key: string | null;
  avatar_url: string | null;
};

export type DepositRow = {
  id: string;
  user_id: string;
  username: string | null;
  email: string | null;
  amount: number;
  bonus: number;
  method: string;
  reference: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  payer_first_name: string | null;
  payer_last_name: string | null;
  payer_phone: string | null;
  payer_self: boolean | null;
  reject_reason: string | null;
  prev_balance: number | null;
  new_balance: number | null;
};

/* -------------------------------- Helpers -------------------------------- */

export function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(
    Math.floor(n),
  );
}

export function shortId(id: string | null | undefined) {
  if (!id) return "—";
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(-6);
  const n = parseInt(hex || "0", 16) % 100000;
  return String(n).padStart(5, "0");
}

export const GAME_LABELS: Record<string, string> = {
  spaceman: "SPACEMAN",
  slot: "TRAGAMONEDAS",
  mines: "BUSCAMINAS",
  dice: "DADOS",
  blackjack: "BLACKJACK",
  arena: "ARENA",
  ruleta: "RULETA",
};

export function depositStatusBadge(s: string) {
  const m: Record<string, string> = {
    pendiente_pago: "border-purple-500/40 bg-purple-500/10 text-purple-200",
    pendiente_revision: "border-amber-500/50 bg-amber-500/10 text-amber-200",
    aprobada: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
    rechazada: "border-rose-500/50 bg-rose-500/10 text-rose-200",
    expirada: "border-purple-500/30 bg-purple-500/5 text-purple-300/70",
  };
  return m[s] ?? "border-purple-500/30 bg-purple-500/5 text-purple-200";
}

export function withdrawalStatusBadge(s: string) {
  const m: Record<string, string> = {
    pendiente: "border-amber-500/50 bg-amber-500/10 text-amber-200",
    aprobada: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
    rechazada: "border-rose-500/50 bg-rose-500/10 text-rose-200",
    cancelada: "border-purple-500/30 bg-purple-500/5 text-purple-300/70",
  };
  return m[s] ?? "border-purple-500/30 bg-purple-500/5 text-purple-200";
}

export type WithdrawalRow = {
  id: string;
  user_id: string;
  username: string | null;
  email: string | null;
  amount: number;
  fee: number;
  net_amount: number;
  method: string;
  account_identifier: string;
  account_label: string | null;
  status: string;
  reject_reason: string | null;
  prev_balance: number | null;
  new_balance: number | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
};

/* ------------------------------ UI primitives ----------------------------- */

export function Panel({
  title,
  children,
  actions,
}: {
  title: React.ReactNode;
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

export function KpiCard({
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

export function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "emerald" | "rose";
}) {
  const valColor =
    color === "emerald"
      ? "text-emerald-300"
      : color === "rose"
      ? "text-rose-300"
      : "text-white";
  return (
    <div className="rounded-lg border border-purple-500/20 bg-[#150830]/60 px-2 py-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-purple-200/70">{label}</div>
      <div className={`font-display mt-0.5 text-xs font-bold ${valColor}`}>{value}</div>
    </div>
  );
}

export function Info2({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-purple-500/20 bg-[#150830]/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-purple-300/70">{k}</div>
      <div className={`text-xs font-bold text-white ${mono ? "font-mono" : ""}`}>{v}</div>
    </div>
  );
}

export function SidebarHeader() {
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

export function GateMessage({
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

export function PlaceholderSection({ label }: { label: string }) {
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