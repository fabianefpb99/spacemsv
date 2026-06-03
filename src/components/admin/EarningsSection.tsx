import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Coins,
  Download,
  Gift,
  Loader2,
  Percent,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminGetCasinoStats } from "@/lib/admin/admin.functions";
import { GAME_LABELS, KpiCard, Panel, formatCOP } from "./shared";

export function EarningsSection() {
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