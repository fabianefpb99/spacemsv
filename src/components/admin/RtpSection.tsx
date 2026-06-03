import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Percent } from "lucide-react";
import { adminListRtp, adminUpdateRtp } from "@/lib/admin/admin.functions";
import { GAME_LABELS, Panel } from "./shared";

export function RtpSection() {
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
          {q.data?.map(
            (row: {
              game: string;
              rtp_target?: number | null;
              rtp_live: number | null;
              is_active?: boolean | null;
              updated_at?: string | null;
              updated_by_label?: string | null;
            }) => {
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
                        setDrafts((d) => ({
                          ...d,
                          [row.game]: e.target.value.replace(/[^0-9.]/g, ""),
                        }))
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
            },
          )}
        </div>
      )}
    </Panel>
  );
}