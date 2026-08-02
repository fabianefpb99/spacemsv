import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Loader2 } from "lucide-react";
import { adminGetBetInsights } from "@/lib/admin/admin.functions";
import { GAME_LABELS, formatCOP } from "./shared";

type Props = {
  range: "today" | "week" | "month" | "3months" | "6months" | "all" | "custom";
  from: string;
  to: string;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-purple-500/25 bg-[#150830]/70 p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-widest text-purple-300/70">{label}</div>
      <div className="mt-0.5 truncate font-display text-sm font-bold text-white">{value}</div>
      {hint ? <div className="mt-0.5 text-[9px] text-purple-200/50">{hint}</div> : null}
    </div>
  );
}

export function BetInsightsPanel({ range, from, to }: Props) {
  const [open, setOpen] = useState(false);
  const fn = useServerFn(adminGetBetInsights);

  const q = useQuery({
    queryKey: ["admin-bet-insights", range, from, to],
    enabled: open,
    staleTime: 120_000,
    queryFn: () =>
      fn({
        data: {
          range,
          from: range === "custom" && from ? new Date(from).toISOString() : undefined,
          to: range === "custom" && to ? new Date(to).toISOString() : undefined,
        },
      }),
  });

  const d = q.data;
  const s = d?.summary;
  const mostUsed = d?.topAmounts?.[0];
  const maxUses = Math.max(1, ...(d?.buckets?.map((b) => Number(b.uses)) ?? [1]));

  return (
    <section className="rounded-2xl border border-purple-500/30 bg-[#0c0620]/80 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left sm:p-4"
      >
        <div>
          <h3 className="font-display text-xs font-bold uppercase tracking-widest text-white sm:text-sm">
            Comportamiento de apuestas
          </h3>
          <p className="mt-0.5 text-[10px] text-purple-200/60">
            Monto más usado, promedio, distribución, horas pico y jugadores
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-purple-300 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-purple-500/20 p-3 sm:p-4">
          {q.isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
          ) : q.isError ? (
            <div className="py-4 text-center text-xs text-rose-300">No se pudo cargar la información.</div>
          ) : !s || Number(s.bet_count) === 0 ? (
            <div className="py-4 text-center text-xs text-purple-200/60">
              Sin apuestas en el rango seleccionado.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Apuesta más común"
                  value={mostUsed ? `$${formatCOP(Number(mostUsed.amt))}` : "—"}
                  hint={mostUsed ? `${formatCOP(Number(mostUsed.uses))} veces` : undefined}
                />
                <Stat label="Apuesta promedio" value={`$${formatCOP(Number(s.avg_bet))}`} />
                <Stat label="Apuesta mediana" value={`$${formatCOP(Number(s.median_bet))}`} hint="La mitad apuesta menos que esto" />
                <Stat
                  label="Mín / Máx"
                  value={`$${formatCOP(Number(s.min_bet))} · $${formatCOP(Number(s.max_bet))}`}
                />
                <Stat label="Jugadores activos" value={formatCOP(Number(s.players))} />
                <Stat label="Total de apuestas" value={formatCOP(Number(s.bet_count))} />
                <Stat label="Apuestas por jugador" value={formatCOP(Number(s.bets_per_player))} />
                <Stat
                  label="Apostado por jugador"
                  value={`$${formatCOP(Number(s.wagered_per_player))}`}
                  hint="Volumen medio por usuario"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-purple-300/70">
                    Montos más usados
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-widest text-purple-300/60">
                        <th className="py-1">Monto</th>
                        <th className="py-1 text-right">Veces</th>
                        <th className="py-1 text-right">Volumen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d?.topAmounts?.map((a) => (
                        <tr key={a.amt} className="border-t border-purple-500/15">
                          <td className="py-1.5 font-bold text-white">${formatCOP(Number(a.amt))}</td>
                          <td className="py-1.5 text-right text-purple-100">{formatCOP(Number(a.uses))}</td>
                          <td className="py-1.5 text-right text-emerald-300">
                            ${formatCOP(Number(a.wagered))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-purple-300/70">
                    Distribución por rango
                  </div>
                  <div className="space-y-1.5">
                    {d?.buckets?.map((b) => (
                      <div key={b.bucket} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[10px] font-bold text-purple-200">
                          {b.bucket}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-purple-500/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                            style={{ width: `${(Number(b.uses) / maxUses) * 100}%` }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-[10px] text-purple-100">
                          {formatCOP(Number(b.uses))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-purple-300/70">
                    Horas pico (hora Colombia)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d?.peakHours?.map((h) => (
                      <div
                        key={h.hour}
                        className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-1.5"
                      >
                        <div className="font-display text-xs font-bold text-white">
                          {String(h.hour).padStart(2, "0")}:00
                        </div>
                        <div className="text-[9px] text-fuchsia-200/80">
                          {formatCOP(Number(h.uses))} apuestas
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-purple-300/70">
                    Apuesta típica por juego
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-widest text-purple-300/60">
                        <th className="py-1">Juego</th>
                        <th className="py-1 text-right">Más usada</th>
                        <th className="py-1 text-right">Promedio</th>
                        <th className="py-1 text-right">Jugadores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d?.perGame?.map((g) => (
                        <tr key={g.game} className="border-t border-purple-500/15">
                          <td className="py-1.5 font-bold text-white">
                            {GAME_LABELS[g.game] ?? g.game.toUpperCase()}
                          </td>
                          <td className="py-1.5 text-right text-purple-100">
                            ${formatCOP(Number(g.common_bet))}
                          </td>
                          <td className="py-1.5 text-right text-purple-200/80">
                            ${formatCOP(Number(g.avg_bet))}
                          </td>
                          <td className="py-1.5 text-right text-purple-200/80">
                            {formatCOP(Number(g.players))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
