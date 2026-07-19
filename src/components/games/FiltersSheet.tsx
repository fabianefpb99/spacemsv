import { X } from "lucide-react";

export type GamesFilters = {
  onlyFavorites: boolean;
  onlyNew: boolean;
  hideComingSoon: boolean;
};

export function countActiveFilters(f: GamesFilters): number {
  let n = 0;
  if (f.onlyFavorites) n++;
  if (f.onlyNew) n++;
  if (f.hideComingSoon) n++;
  return n;
}

export function FiltersSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: GamesFilters;
  onChange: (f: GamesFilters) => void;
}) {
  if (!open) return null;

  const set = <K extends keyof GamesFilters>(k: K, v: GamesFilters[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/10 bg-background p-5 shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-80 sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">Filtros</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Row
            label="Solo favoritos"
            checked={value.onlyFavorites}
            onChange={(v) => set("onlyFavorites", v)}
          />
          <Row
            label="Solo nuevos"
            checked={value.onlyNew}
            onChange={(v) => set("onlyNew", v)}
          />
          <Row
            label="Ocultar próximamente"
            checked={value.hideComingSoon}
            onChange={(v) => set("hideComingSoon", v)}
          />
        </div>

        <button
          type="button"
          onClick={() =>
            onChange({ onlyFavorites: false, onlyNew: false, hideComingSoon: false })
          }
          className="mt-6 w-full rounded-lg border border-white/10 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-card/50 px-3 py-2.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[hsl(var(--primary))]"
      />
    </label>
  );
}