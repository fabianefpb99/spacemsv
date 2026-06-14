import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Coins, TrendingUp, Users } from "lucide-react";
import { adminGetDashboardKpis, adminGetHighWinners } from "@/lib/admin/admin.functions";
import { KpiCard, Panel, formatCOP } from "./shared";

export function DashboardSection() {
  const fn = useServerFn(adminGetDashboardKpis);
  const q = useQuery({
    queryKey: ["admin-dashboard-kpis"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });
  const totals = q.data;

  const winnersFn = useServerFn(adminGetHighWinners);
  const winnersQ = useQuery({
    queryKey: ["admin-high-winners", 50000],
    queryFn: () => winnersFn({ data: { threshold: 50000 } }),
    refetchInterval: 60_000,
  });
  const winners = winnersQ.data?.winners ?? [];

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
      <Panel
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span>Alertas de ganancias altas (&gt; $50.000 netos del casino)</span>
            {winners.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {winners.length}
              </span>
            )}
          </div>
        }
      >
        {winnersQ.isLoading ? (
          <p className="text-sm text-purple-200/60">Cargando…</p>
        ) : winners.length === 0 ? (
          <p className="text-sm text-purple-200/60">
            Ningún usuario supera $50.000 de utilidad neta (ganancias − apuestas).
          </p>
        ) : (
          <div className="space-y-2">
            {winners.map((w) => (
              <div
                key={w.user_id}
                className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {w.username ?? w.email ?? w.user_id.slice(0, 8)}
                  </div>
                  <div className="truncate text-xs text-purple-200/60">
                    Apostó ${formatCOP(w.bet)} · Ganó ${formatCOP(w.win)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-amber-300">
                    +${formatCOP(w.net)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-purple-200/50">
                    saldo ${formatCOP(w.balance)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
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