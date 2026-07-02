import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Settings2 } from "lucide-react";
import { adminGetRouletteConfig, adminUpdateRouletteConfig } from "@/lib/admin/admin.functions";
import { Panel } from "./shared";

export function RouletteConfigSection() {
  const fn = useServerFn(adminGetRouletteConfig);
  const upd = useServerFn(adminUpdateRouletteConfig);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-roulette-config"], queryFn: () => fn() });

  const mut = useMutation({
    mutationFn: (green_weight: number) => upd({ data: { green_weight } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-roulette-config"] }),
  });

  const [draft, setDraft] = useState<string>("");

  const current = q.data?.green_weight ?? 1.0;
  const value = draft !== "" ? Number(draft) : current;
  const dirty = draft !== "" && Number(draft) !== current;

  const greenProb = (value / (36 + value)) * 100;
  const redProb = (18 / (36 + value)) * 100;
  const blackProb = (18 / (36 + value)) * 100;

  const handleSave = () => {
    if (!isNaN(value) && value >= 1 && value <= 5) {
      mut.mutate(Number(value.toFixed(1)));
    }
  };

  return (
    <Panel title="Probabilidad de la Ruleta">
      <p className="mb-3 text-[11px] text-purple-200/70">
        Ajusta el peso del número verde (0). Un peso de 1.0 es la ruleta europea
        estándar (2.7%). Aumentar el peso sube la probabilidad del verde y da más
        ventaja a la casa en las apuestas a rojo y negro.
      </p>

      {q.isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
      ) : (
        <div className="space-y-4 rounded-xl border border-purple-500/20 bg-[#150830]/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-fuchsia-400/40 bg-purple-900/30">
              <Settings2 className="h-4 w-4 text-fuchsia-300" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-xs font-bold uppercase tracking-widest text-white">
                Peso del verde
              </div>
              <div className="text-[10px] text-purple-200/60">
                Valor actual: {" "}
                <span className="text-purple-100">{current.toFixed(1)}</span>
                {q.data?.updated_at && (
                  <span className="ml-1 text-purple-200/40">
                    · actualizado{" "}
                    {new Date(q.data.updated_at).toLocaleString("es-CO")}
                    {q.data.updated_by_label ? ` por ${q.data.updated_by_label}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-purple-300/70">
                Nuevo peso
              </label>
              <div className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={draft !== "" ? draft : current.toFixed(1)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, "");
                    setDraft(raw);
                  }}
                  className="w-24 rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-center text-xs font-bold text-white focus:border-fuchsia-400/60 focus:outline-none"
                />
                <span className="text-[10px] text-purple-300/60">1.0 — 5.0</span>
              </div>
            </div>
            <button
              disabled={!dirty || mut.isPending}
              onClick={handleSave}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-purple-500 disabled:opacity-40"
            >
              {mut.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>

          {mut.isError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
              No se pudo guardar. Intenta de nuevo.
            </div>
          )}
          {mut.isSuccess && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
              Configuración guardada correctamente.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300/70">Verde</div>
              <div className="font-display text-sm font-bold text-emerald-200">{greenProb.toFixed(2)}%</div>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-rose-300/70">Rojo</div>
              <div className="font-display text-sm font-bold text-rose-200">{redProb.toFixed(2)}%</div>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-purple-300/70">Negro</div>
              <div className="font-display text-sm font-bold text-purple-200">{blackProb.toFixed(2)}%</div>
            </div>
          </div>

          <div className="text-[10px] text-purple-200/50">
            Con peso {value.toFixed(1)} el verde cae ~1 de cada {((36 + value) / value).toFixed(1)} giros.
          </div>
        </div>
      )}
    </Panel>
  );
}
