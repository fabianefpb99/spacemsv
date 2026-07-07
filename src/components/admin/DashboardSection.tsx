import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Coins, TrendingUp, Users } from "lucide-react";
import { adminGetDashboardKpis, adminGetHighWinners } from "@/lib/admin/admin.functions";
import { KpiCard, Panel, formatCOP } from "./shared";

const GAME_LABEL: Record<string, string> = {
  arena: "Arena",
  blackjack: "Blackjack",
  blackjack_vip: "Blackjack VIP",
  chicken: "Chicken",
  dice: "Dados",
  mines: "Mines",
  ruleta: "Ruleta",
  slot: "Slot Mafia",
  slot_samurai: "Slot Samurai",
  spaceman: "Spaceman",
  sports: "Deportes",
};

export function DashboardSection() {
  const fn = useServerFn(adminGetDashboardKpis);
  const q = useQuery({
    queryKey: ["admin-dashboard-kpis"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });
  const totals = q.data;

  const winnersFn = useServerFn(adminGetHighWinners);
  const [threshold, setThreshold] = useState<number>(20000);
  const winnersQ = useQuery({
    queryKey: ["admin-high-winners", threshold],
    queryFn: () => winnersFn({ data: { threshold, top_limit: 10 } }),
    refetchInterval: 60_000,
  });
  const winners = winnersQ.data?.winners ?? [];
  const topPositive = winnersQ.data?.top ?? [];

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
            <span>
              Alertas de ganancias altas (&gt; ${formatCOP(threshold)} netos del casino)
            </span>
            {winners.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {winners.length}
              </span>
            )}
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-purple-200/70">
          <span>Umbral neto:</span>
          {[5000, 10000, 20000, 50000, 100000].map((v) => (
            <button
              key={v}
              onClick={() => setThreshold(v)}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
                threshold === v
                  ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
                  : "border-purple-500/30 bg-purple-900/20 text-purple-200/70 hover:bg-purple-900/40"
              }`}
            >
              ${formatCOP(v)}
            </button>
          ))}
        </div>
        {winnersQ.isLoading ? (
          <p className="text-sm text-purple-200/60">Cargando…</p>
        ) : winners.length === 0 ? (
          <p className="text-sm text-purple-200/60">
            Ningún usuario supera ${formatCOP(threshold)} de utilidad neta (ganancias −
            apuestas). Abajo te muestro los que van ganando aunque estén por debajo.
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
                    {w.top_game && (
                      <>
                        {" "}· Top: {GAME_LABEL[w.top_game.game] ?? w.top_game.game} ($
                        {formatCOP(w.top_game.net)})
                      </>
                    )}
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
      <Panel
        title={
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span>Top 10 ganadores netos (histórico)</span>
          </div>
        }
      >
        {winnersQ.isLoading ? (
          <p className="text-sm text-purple-200/60">Cargando…</p>
        ) : topPositive.length === 0 ? (
          <p className="text-sm text-purple-200/60">
            Aún nadie tiene utilidad neta positiva. El casino va ganando en todas las cuentas.
          </p>
        ) : (
          <div className="space-y-2">
            {topPositive.map((w, i) => (
              <div
                key={w.user_id}
                className="flex items-center justify-between rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-emerald-300/80">
                    #{i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {w.username ?? w.email ?? w.user_id.slice(0, 8)}
                    </div>
                    <div className="truncate text-xs text-purple-200/60">
                      Apostó ${formatCOP(w.bet)} · Ganó ${formatCOP(w.win)}
                      {w.top_game && (
                        <>
                          {" "}· Top: {GAME_LABEL[w.top_game.game] ?? w.top_game.game} ($
                          {formatCOP(w.top_game.net)})
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-300">
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