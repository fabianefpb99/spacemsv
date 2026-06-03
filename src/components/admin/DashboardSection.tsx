import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, TrendingUp, Users } from "lucide-react";
import { adminGetDashboardKpis } from "@/lib/admin/admin.functions";
import { KpiCard, Panel, formatCOP } from "./shared";

export function DashboardSection() {
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