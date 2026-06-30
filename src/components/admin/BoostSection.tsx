import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Power, Search, ShieldAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminListUsers } from "@/lib/admin/admin.functions";
import { adminStartBoostFn, adminStopBoostFn } from "@/lib/admin/boost.functions";
import { Panel } from "./shared";

type ActiveBoost = {
  id: string;
  target_user_id: string;
  started_at: string;
  rtp_value: number;
  excluded_games: string[];
};

type DryRunResult = {
  dry_run: true;
  session_id: string;
  target_user_id: string;
  started_at: string;
  would_delete: Record<string, number>;
  will_reset_balance_from: { real: number; bonus: number };
  will_reset_xp_from: number | null;
};

export function BoostSection() {
  const qc = useQueryClient();

  /* Sesión activa --------------------------------------------------- */
  const activeQ = useQuery({
    queryKey: ["admin-boost-active"],
    queryFn: async (): Promise<ActiveBoost | null> => {
      const { data, error } = await supabase
        .from("boost_sessions")
        .select("id, target_user_id, started_at, rtp_value, excluded_games")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as ActiveBoost | null) ?? null;
    },
    refetchInterval: 15000,
  });

  /* Buscar usuarios ------------------------------------------------- */
  const listFn = useServerFn(adminListUsers);
  const startFn = useServerFn(adminStartBoostFn);
  const stopFn = useServerFn(adminStopBoostFn);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const usersQ = useQuery({
    queryKey: ["admin-boost-users", search],
    queryFn: () => listFn({ data: { search, status: "all", page: 1, pageSize: 10 } }),
    enabled: search.trim().length >= 2,
  });

  /* Mutaciones ------------------------------------------------------ */
  const startMut = useMutation({
    mutationFn: async (args: { user_id: string; rtp: number }) => {
      return await startFn({
        data: { target_user_id: args.user_id, rtp: args.rtp },
      });
    },
    onSuccess: () => {
      toast.success("Boost activado");
      setSelected(null);
      setSearch("");
      qc.invalidateQueries({ queryKey: ["admin-boost-active"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const previewMut = useMutation({
    mutationFn: async (): Promise<DryRunResult> => {
      const res = await stopFn({ data: { dry_run: true } });
      return res as DryRunResult;
    },
  });

  const stopMut = useMutation({
    mutationFn: async () => {
      return await stopFn({ data: { dry_run: false } });
    },
    onSuccess: () => {
      toast.success("Boost cerrado y datos del target borrados");
      previewMut.reset();
      qc.invalidateQueries({ queryKey: ["admin-boost-active"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const [rtp, setRtp] = useState(99.1);

  return (
    <div className="space-y-4">
      <Panel
        title="Modo Boost (contenido promocional)"
        actions={
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-200">
            <ShieldAlert className="h-3 w-3" /> Solo admin
          </span>
        }
      >
        <p className="mb-3 text-[11px] leading-relaxed text-purple-200/70">
          Sube el RTP de los juegos individuales (Chicken, Mines, Dice, Roulette, Arena, Slot)
          únicamente para la cuenta seleccionada. Spaceman queda fuera. La UI es idéntica a la
          normal; nadie ve ningún indicador. Al apagarlo, el sistema borra quirúrgicamente
          transacciones, rondas, misiones y reinicia saldo/VIP solo del target.
        </p>

        {activeQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-purple-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : activeQ.data ? (
          <ActiveBoostCard
            row={activeQ.data}
            onPreview={() => previewMut.mutate()}
            preview={previewMut.data ?? null}
            previewLoading={previewMut.isPending}
            onStop={() => stopMut.mutate()}
            stopLoading={stopMut.isPending}
          />
        ) : (
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-widest text-purple-200/70">
              Cuenta objetivo
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-300/60" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelected(null);
                }}
                placeholder="Email, username o ID…"
                className="w-full rounded-md border border-purple-500/30 bg-black/30 py-2 pl-7 pr-3 text-xs text-white placeholder:text-purple-300/40 focus:border-purple-400 focus:outline-none"
              />
            </div>

            {search.trim().length >= 2 && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-white/10">
                {usersQ.isLoading ? (
                  <div className="flex items-center justify-center py-6 text-purple-200/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  (usersQ.data?.rows ?? []).map((u) => {
                    const row = u as unknown as {
                      id: string;
                      email: string | null;
                      username: string | null;
                    };
                    const label = row.username || row.email || row.id.slice(0, 8);
                    const isSel = selected?.id === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelected({ id: row.id, label })}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs ${
                          isSel
                            ? "bg-amber-400/20 text-amber-100"
                            : "text-purple-100 hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate">{label}</span>
                        <span className="ml-2 truncate text-[10px] text-purple-300/60">
                          {row.email}
                        </span>
                      </button>
                    );
                  })
                )}
                {usersQ.data && usersQ.data.rows.length === 0 && (
                  <div className="px-3 py-4 text-center text-[11px] text-purple-200/60">
                    Sin resultados
                  </div>
                )}
              </div>
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-widest text-purple-200/70">
                  RTP forzado (%)
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={90}
                  max={99.9}
                  value={rtp}
                  onChange={(e) => setRtp(Number(e.target.value) || 99.1)}
                  className="mt-1 w-full rounded-md border border-purple-500/30 bg-black/30 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                />
              </div>
              <button
                disabled={!selected || startMut.isPending}
                onClick={() =>
                  selected && startMut.mutate({ user_id: selected.id, rtp })
                }
                className="flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {startMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Activar
              </button>
            </div>
            {selected && (
              <p className="text-[11px] text-purple-200/70">
                Target seleccionado: <span className="font-bold text-amber-200">{selected.label}</span>
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ActiveBoostCard({
  row,
  onPreview,
  preview,
  previewLoading,
  onStop,
  stopLoading,
}: {
  row: ActiveBoost;
  onPreview: () => void;
  preview: DryRunResult | null;
  previewLoading: boolean;
  onStop: () => void;
  stopLoading: boolean;
}) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(row.started_at).getTime()) / 60000),
  );

  return (
    <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-amber-200/80">
            Boost activo
          </div>
          <div className="font-mono text-xs text-white break-all">{row.target_user_id}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-amber-200/80">RTP</div>
          <div className="text-lg font-bold text-amber-200">{row.rtp_value}%</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-purple-100/80">
        <span>Activo hace <b className="text-white">{minutes} min</b></span>
        <span>Excluidos: <b className="text-white">{row.excluded_games.join(", ") || "—"}</b></span>
      </div>

      {preview && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] text-purple-100">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-purple-200/70">
            Se borrará al apagar
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(preview.would_delete).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="capitalize">{k.replace(/_/g, " ")}</span>
                <span className="font-bold text-white">{v}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[11px]">
            Saldo objetivo se reiniciará desde <b className="text-white">${preview.will_reset_balance_from.real}</b> (real) / <b className="text-white">${preview.will_reset_balance_from.bonus}</b> (bonus).
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onPreview}
          disabled={previewLoading}
          className="flex-1 rounded-md border border-purple-400/40 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-purple-100 transition hover:bg-white/5 disabled:opacity-40"
        >
          {previewLoading ? "Calculando…" : "Previsualizar limpieza"}
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                "Esto borrará TODO lo generado por la cuenta target durante esta sesión: transacciones, rondas, misiones, saldo y VIP. ¿Continuar?",
              )
            ) {
              onStop();
            }
          }}
          disabled={stopLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-rose-500 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-rose-400 disabled:opacity-40"
        >
          {stopLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          Apagar + limpiar
        </button>
      </div>
    </div>
  );
}