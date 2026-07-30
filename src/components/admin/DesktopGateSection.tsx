import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Monitor, Save } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Panel } from "./shared";
import {
  adminGetDesktopGate,
  adminSetDesktopGate,
} from "@/lib/admin/desktop-gate.functions";
import { DESKTOP_GATE_DEFAULTS, type DesktopGate } from "@/lib/admin/desktop-gate.shared";

export function DesktopGateSection() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetDesktopGate);
  const setFn = useServerFn(adminSetDesktopGate);

  const q = useQuery({
    queryKey: ["admin-desktop-gate"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<DesktopGate>(DESKTOP_GATE_DEFAULTS);
  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: async (value: DesktopGate) => await setFn({ data: value }),
    onSuccess: () => {
      toast.success("Vista PC actualizada");
      qc.invalidateQueries({ queryKey: ["admin-desktop-gate"] });
      qc.invalidateQueries({ queryKey: ["public-desktop-gate"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar"),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-purple-200">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <Monitor className="h-4 w-4 text-fuchsia-300" /> Vista de escritorio
          </span>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-purple-500/25 bg-purple-600/10 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-white">
                Bloquear versión de escritorio
              </div>
              <p className="mt-0.5 text-xs text-purple-200/70">
                Muestra una pantalla premium de "en construcción" a quienes entren desde PC.
                Los administradores y /adminpanel nunca se bloquean.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              aria-label="Bloquear versión de escritorio"
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200/80">
              Ancho mínimo para bloquear (px)
            </span>
            <input
              type="number"
              min={700}
              max={2200}
              value={form.min_width}
              onChange={(e) =>
                setForm((f) => ({ ...f, min_width: Number(e.target.value) || 0 }))
              }
              className="w-40 rounded-lg border border-purple-500/30 bg-[#0d0522] px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
            />
            <span className="text-[11px] text-purple-200/60">
              Recomendado: 1024. Pantallas menores seguirán viendo la versión móvil.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200/80">
              Título
            </span>
            <input
              value={form.title}
              maxLength={60}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-lg border border-purple-500/30 bg-[#0d0522] px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200/80">
              Mensaje
            </span>
            <textarea
              value={form.message}
              maxLength={240}
              rows={3}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="rounded-lg border border-purple-500/30 bg-[#0d0522] px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
            />
          </label>

          <button
            onClick={() => save.mutate(form)}
            disabled={save.isPending}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[0_6px_20px_rgba(217,70,239,0.35)] disabled:opacity-60"
          >
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar cambios
          </button>
        </div>
      </Panel>
    </div>
  );
}
