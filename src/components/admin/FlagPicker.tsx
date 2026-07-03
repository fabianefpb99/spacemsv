import { useMemo, useState } from "react";
import { Search, X as XIcon, Trophy, Check } from "lucide-react";
import {
  WORLD_CUP_2026_TEAMS,
  WORLD_CUP_2026_TEAMS_BY_CODE,
  CONFEDERATION_LABELS,
  flagSvgUrl,
  type Confederation,
  type WorldCupTeam,
} from "@/lib/sports/world-cup-2026-teams";

/**
 * Renderiza una bandera SVG desde el CDN público flagcdn.com.
 * Usa `loading="lazy"` para no penalizar la carga inicial del admin.
 */
export function TeamFlag({
  code,
  className = "h-5 w-7",
  title,
}: {
  code: string;
  className?: string;
  title?: string;
}) {
  const team = WORLD_CUP_2026_TEAMS_BY_CODE[code];
  const label = title ?? team?.name ?? code;
  if (!code) {
    return (
      <div
        className={`flex items-center justify-center rounded border border-purple-500/30 bg-[#0c0620] text-[9px] font-bold text-purple-300/60 ${className}`}
        aria-label="Sin bandera"
      >
        —
      </div>
    );
  }
  return (
    <img
      src={flagSvgUrl(code)}
      alt={label}
      title={label}
      loading="lazy"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      className={`rounded border border-purple-500/30 bg-[#0c0620] object-cover ${className}`}
    />
  );
}

/**
 * Botón que abre el modal FlagPickerModal.
 */
export function FlagPickerButton({
  value,
  onChange,
  label = "Bandera",
  placeholder = "Elegir…",
}: {
  value: string;
  onChange: (next: { code: string; name: string }) => void;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const team = value ? WORLD_CUP_2026_TEAMS_BY_CODE[value] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-left text-sm text-white transition hover:border-fuchsia-400/50"
        aria-label={label}
      >
        {team ? (
          <>
            <TeamFlag code={team.code} className="h-4 w-6" />
            <span className="flex-1 truncate">{team.name}</span>
            <span className="font-mono text-[10px] text-purple-300/70">{team.code}</span>
          </>
        ) : (
          <span className="flex-1 text-purple-300/60">{placeholder}</span>
        )}
      </button>
      {open && (
        <FlagPickerModal
          selected={value}
          onClose={() => setOpen(false)}
          onSelect={(t) => {
            onChange({ code: t.code, name: t.name });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function FlagPickerModal({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (t: WorldCupTeam) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [conf, setConf] = useState<Confederation | "ALL">("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return WORLD_CUP_2026_TEAMS.filter((t) => {
      if (conf !== "ALL" && t.confederation !== conf) return false;
      if (!q) return true;
      return norm(t.name).includes(norm(q)) || t.code.toLowerCase().includes(q);
    });
  }, [query, conf]);

  const confs: Array<Confederation | "ALL"> = ["ALL", "CONMEBOL", "CONCACAF", "UEFA", "AFC", "CAF", "OFC"];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-3 py-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] shadow-[0_0_40px_rgba(168,85,247,0.4)]"
      >
        <div className="flex items-center justify-between border-b border-purple-500/25 px-4 py-3">
          <h3 className="flex items-center gap-2 font-display text-sm font-black uppercase tracking-widest text-white">
            <Trophy className="h-4 w-4 text-fuchsia-300" />
            Mundial 2026
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-purple-200 hover:bg-white/5"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-purple-500/20 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-300/60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar selección…"
              className="w-full rounded-md border border-purple-500/30 bg-[#0c0620] py-2 pl-8 pr-2 text-sm text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {confs.map((c) => (
              <button
                key={c}
                onClick={() => setConf(c)}
                type="button"
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                  conf === c
                    ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100"
                    : "border-purple-500/30 bg-[#0c0620] text-purple-200 hover:bg-purple-500/10"
                }`}
              >
                {c === "ALL" ? "Todas" : c}
              </button>
            ))}
          </div>
          {conf !== "ALL" && (
            <p className="mt-1.5 text-[10px] text-purple-300/70">{CONFEDERATION_LABELS[conf]}</p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-purple-200/70">Sin resultados.</div>
          ) : (
            <ul className="grid grid-cols-1 gap-1">
              {filtered.map((t) => {
                const active = t.code === selected;
                return (
                  <li key={t.code}>
                    <button
                      onClick={() => onSelect(t)}
                      type="button"
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition ${
                        active
                          ? "border-fuchsia-400/60 bg-fuchsia-500/15"
                          : "border-purple-500/20 bg-[#0c0620] hover:border-purple-400/50 hover:bg-purple-500/10"
                      }`}
                    >
                      <TeamFlag code={t.code} className="h-6 w-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">{t.name}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-purple-300/70">
                          <span className="font-mono">{t.code}</span>
                          <span>·</span>
                          <span>{t.confederation}</span>
                          {t.isHost && (
                            <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold uppercase text-amber-200">
                              Anfitrión
                            </span>
                          )}
                        </div>
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0 text-fuchsia-300" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}