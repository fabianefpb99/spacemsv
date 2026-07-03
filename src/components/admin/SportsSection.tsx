import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  Star,
  Eye,
  EyeOff,
  Trophy,
  Radio,
  Ban,
  Flag as FlagIcon,
  X as XIcon,
  Clock,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, KpiCard } from "./shared";
import { TeamFlag, FlagPickerButton } from "./FlagPicker";
import { teamName } from "@/lib/sports/world-cup-2026-teams";
import {
  adminListCompetitions,
  adminUpsertCompetition,
  adminDeleteCompetition,
  adminListMatches,
  adminUpsertMatch,
  adminPatchMatchFlags,
  adminSettleMatch,
  adminCancelMatch,
  adminDeleteMatch,
  adminGetSportsTimezone,
  adminSetSportsTimezone,
  type SportsCompetition,
  type SportsMatch,
  type SportsMatchStatus,
} from "@/lib/admin/sports.functions";

/* ============================================================
 * Timezone helpers (wall-time <-> ISO instant in an arbitrary TZ)
 * ========================================================== */

function localToIsoInTz(localDateTimeStr: string, timeZone: string): string {
  const [datePart, timePart] = localDateTimeStr.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = (timePart ?? "00:00").split(":").map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi, 0);
  let utc = target;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(utc));
    const g: Record<string, number> = {};
    for (const p of parts) if (p.type !== "literal") g[p.type] = Number(p.value);
    if (g.hour === 24) g.hour = 0;
    const wall = Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute, 0);
    const diff = target - wall;
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc).toISOString();
}

function isoToLocalInTz(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const g: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") g[p.type] = p.value;
  const h = g.hour === "24" ? "00" : g.hour;
  return `${g.year}-${g.month}-${g.day}T${h}:${g.minute}`;
}

function formatDisplay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function statusLabel(s: SportsMatchStatus) {
  return { scheduled: "Programado", live: "En vivo", finished: "Finalizado", cancelled: "Cancelado" }[s];
}
function statusBadgeClass(s: SportsMatchStatus) {
  return {
    scheduled: "border-purple-500/40 bg-purple-500/10 text-purple-200",
    live: "border-rose-500/50 bg-rose-500/15 text-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.35)]",
    finished: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    cancelled: "border-purple-500/25 bg-purple-500/5 text-purple-300/70",
  }[s];
}

/* ============================================================
 * Section
 * ========================================================== */

export function SportsSection() {
  const qc = useQueryClient();
  const listCompetitionsFn = useServerFn(adminListCompetitions);
  const listMatchesFn = useServerFn(adminListMatches);
  const getTzFn = useServerFn(adminGetSportsTimezone);

  const tzQ = useQuery({ queryKey: ["admin", "sports", "timezone"], queryFn: () => getTzFn() });
  const timezone = tzQ.data?.timezone ?? "America/Bogota";

  const compQ = useQuery({
    queryKey: ["admin", "sports", "competitions"],
    queryFn: () => listCompetitionsFn(),
  });

  const [statusFilter, setStatusFilter] = useState<"all" | SportsMatchStatus>("all");
  const [compFilter, setCompFilter] = useState<string>("");

  const matchesQ = useQuery({
    queryKey: ["admin", "sports", "matches", statusFilter, compFilter],
    queryFn: () =>
      listMatchesFn({
        data: {
          status: statusFilter,
          ...(compFilter ? { competition_id: compFilter } : {}),
        },
      }),
  });

  const matches = matchesQ.data?.matches ?? [];

  const kpis = useMemo(() => {
    let live = 0,
      scheduled = 0,
      finished = 0,
      totalBets = 0;
    for (const m of matches) {
      if (m.status === "live") live++;
      else if (m.status === "scheduled") scheduled++;
      else if (m.status === "finished") finished++;
      totalBets += m.bet_count;
    }
    return { total: matches.length, live, scheduled, finished, totalBets };
  }, [matches]);

  const [editingMatch, setEditingMatch] = useState<SportsMatch | "new" | null>(null);
  const [settlingMatch, setSettlingMatch] = useState<SportsMatch | null>(null);
  const [editingComps, setEditingComps] = useState(false);
  const [editingTz, setEditingTz] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "sports"] });
  };

  return (
    <div className="space-y-4">
      {/* Header with TZ + KPIs */}
      <Panel
        title="Panel Deportes"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingTz(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-500/40 bg-[#150830] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/15"
            >
              <Clock className="h-3 w-3" />
              {timezone}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCard label="Partidos" value={String(kpis.total)} icon={Trophy} accent="purple" />
          <KpiCard label="En vivo" value={String(kpis.live)} icon={Radio} accent="fuchsia" />
          <KpiCard label="Programados" value={String(kpis.scheduled)} icon={Clock} accent="amber" />
          <KpiCard label="Apuestas" value={String(kpis.totalBets)} icon={CheckCircle2} accent="emerald" />
        </div>
      </Panel>

      {/* Competitions */}
      <Panel
        title="Competiciones"
        actions={
          <button
            onClick={() => setEditingComps(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-purple-500/40 bg-[#150830] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/15"
          >
            <Pencil className="h-3 w-3" /> Administrar
          </button>
        }
      >
        {compQ.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-purple-300" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(compQ.data?.competitions ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setCompFilter((prev) => (prev === c.id ? "" : c.id))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                  compFilter === c.id
                    ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100"
                    : "border-purple-500/30 bg-[#150830]/60 text-purple-200 hover:bg-purple-500/15"
                } ${c.is_active ? "" : "opacity-50"}`}
              >
                <Trophy className="h-3 w-3" />
                {c.name}
              </button>
            ))}
            {(compQ.data?.competitions ?? []).length === 0 && (
              <div className="text-xs text-purple-200/70">Aún no hay competiciones. Crea una.</div>
            )}
          </div>
        )}
      </Panel>

      {/* Matches list */}
      <Panel
        title="Partidos"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-md border border-purple-500/30 bg-[#150830] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-100 focus:border-fuchsia-400/60 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="scheduled">Programados</option>
              <option value="live">En vivo</option>
              <option value="finished">Finalizados</option>
              <option value="cancelled">Cancelados</option>
            </select>
            <button
              onClick={() => setEditingMatch("new")}
              disabled={(compQ.data?.competitions ?? []).length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-fuchsia-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Nuevo
            </button>
          </div>
        }
      >
        {matchesQ.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-purple-300" />
          </div>
        ) : matches.length === 0 ? (
          <div className="py-6 text-center text-xs text-purple-200/70">
            No hay partidos con estos filtros.
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                timezone={timezone}
                onEdit={() => setEditingMatch(m)}
                onSettle={() => setSettlingMatch(m)}
                onAfterMutation={invalidateAll}
              />
            ))}
          </div>
        )}
      </Panel>

      {editingComps && (
        <CompetitionsModal
          competitions={compQ.data?.competitions ?? []}
          onClose={() => setEditingComps(false)}
        />
      )}

      {editingMatch !== null && (
        <MatchModal
          match={editingMatch === "new" ? null : editingMatch}
          competitions={compQ.data?.competitions ?? []}
          timezone={timezone}
          onClose={() => setEditingMatch(null)}
        />
      )}

      {settlingMatch && (
        <SettleModal match={settlingMatch} onClose={() => setSettlingMatch(null)} />
      )}

      {editingTz && (
        <TimezoneModal current={timezone} onClose={() => setEditingTz(false)} />
      )}
    </div>
  );
}

/* ============================================================
 * MatchRow
 * ========================================================== */

function MatchRow({
  match,
  timezone,
  onEdit,
  onSettle,
  onAfterMutation,
}: {
  match: SportsMatch;
  timezone: string;
  onEdit: () => void;
  onSettle: () => void;
  onAfterMutation: () => void;
}) {
  const patchFn = useServerFn(adminPatchMatchFlags);
  const cancelFn = useServerFn(adminCancelMatch);
  const deleteFn = useServerFn(adminDeleteMatch);

  const patchMut = useMutation({
    mutationFn: (data: { is_featured?: boolean; is_published?: boolean }) =>
      patchFn({ data: { id: match.id, ...data } }),
    onSuccess: () => {
      onAfterMutation();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { id: match.id } }),
    onSuccess: () => {
      toast.success("Partido cancelado y apuestas reembolsadas.");
      onAfterMutation();
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { id: match.id } }),
    onSuccess: () => {
      toast.success("Partido eliminado.");
      onAfterMutation();
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  const canEdit = match.status === "scheduled";
  const canSettle = match.status === "live" || match.status === "scheduled" || match.status === "finished";
  const canCancel = match.status === "scheduled" || match.status === "live";

  return (
    <div className="rounded-xl border border-purple-500/25 bg-[#150830]/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${statusBadgeClass(match.status)}`}>
          {match.status === "live" && <Radio className="h-2.5 w-2.5" />}
          {statusLabel(match.status)}
        </span>
        {match.competition_name && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
            {match.competition_name}
          </span>
        )}
        <span className="ml-auto text-[10px] text-purple-200/70">
          {formatDisplay(match.start_at, timezone)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs font-bold text-white text-right">{match.home_name}</span>
          <MiniFlag code={match.home_flag_code} />
        </div>
        <div className="rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1 text-center font-mono text-xs font-bold text-white">
          {match.home_score != null && match.away_score != null
            ? `${match.home_score} - ${match.away_score}`
            : "vs"}
        </div>
        <div className="flex items-center gap-2">
          <MiniFlag code={match.away_flag_code} />
          <span className="text-xs font-bold text-white">{match.away_name}</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <OddChip label="1" value={match.odds_home} />
        <OddChip label="X" value={match.odds_draw} />
        <OddChip label="2" value={match.odds_away} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => patchMut.mutate({ is_published: !match.is_published })}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            match.is_published
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-purple-500/30 bg-[#0c0620] text-purple-200"
          }`}
        >
          {match.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {match.is_published ? "Publicado" : "Oculto"}
        </button>
        <button
          onClick={() => patchMut.mutate({ is_featured: !match.is_featured })}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            match.is_featured
              ? "border-amber-400/50 bg-amber-500/10 text-amber-200"
              : "border-purple-500/30 bg-[#0c0620] text-purple-200"
          }`}
        >
          <Star className="h-3 w-3" />
          {match.is_featured ? "Destacado" : "Destacar"}
        </button>
        {match.bet_count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1 text-[10px] font-semibold text-purple-200">
            {match.bet_count} apuesta{match.bet_count === 1 ? "" : "s"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {canEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-md border border-purple-500/40 bg-[#0c0620] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/15"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
          {canSettle && (
            <button
              onClick={onSettle}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20"
            >
              <FlagIcon className="h-3 w-3" /> Liquidar
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => {
                if (confirm(`¿Cancelar el partido y reembolsar ${match.bet_count} apuesta(s)?`)) cancelMut.mutate();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-500/20"
            >
              <Ban className="h-3 w-3" /> Cancelar
            </button>
          )}
          {match.status === "cancelled" && match.bet_count === 0 && (
            <button
              onClick={() => {
                if (confirm("¿Eliminar este partido definitivamente?")) deleteMut.mutate();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-[#0c0620] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-500/15"
            >
              <Trash2 className="h-3 w-3" /> Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OddChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-purple-500/25 bg-[#0c0620] px-2 py-1 text-center">
      <div className="text-[9px] uppercase tracking-widest text-purple-300/70">{label}</div>
      <div className="font-display text-xs font-bold text-white">{value.toFixed(2)}</div>
    </div>
  );
}

function MiniFlag({ code }: { code: string }) {
  return <TeamFlag code={code} className="h-5 w-7" title={teamName(code)} />;
}

/* ============================================================
 * Match modal
 * ========================================================== */

function MatchModal({
  match,
  competitions,
  timezone,
  onClose,
}: {
  match: SportsMatch | null;
  competitions: SportsCompetition[];
  timezone: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(adminUpsertMatch);

  const [competitionId, setCompetitionId] = useState<string>(
    match?.competition_id ?? competitions[0]?.id ?? "",
  );
  const [homeName, setHomeName] = useState(match?.home_name ?? "");
  const [homeFlag, setHomeFlag] = useState(match?.home_flag_code ?? "");
  const [awayName, setAwayName] = useState(match?.away_name ?? "");
  const [awayFlag, setAwayFlag] = useState(match?.away_flag_code ?? "");
  const [slug, setSlug] = useState(match?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!match);
  const [startLocal, setStartLocal] = useState<string>(
    match ? isoToLocalInTz(match.start_at, timezone) : "",
  );
  const [oddsHome, setOddsHome] = useState(match ? String(match.odds_home) : "2.00");
  const [oddsDraw, setOddsDraw] = useState(match ? String(match.odds_draw) : "3.20");
  const [oddsAway, setOddsAway] = useState(match ? String(match.odds_away) : "3.50");
  const [isPublished, setIsPublished] = useState(match?.is_published ?? true);
  const [isFeatured, setIsFeatured] = useState(match?.is_featured ?? false);

  // auto-slug
  const autoSlug = useMemo(() => {
    if (!homeName || !awayName) return "";
    return slugify(`${homeName}-vs-${awayName}`);
  }, [homeName, awayName]);
  const finalSlug = slugTouched ? slug : autoSlug;

  const mut = useMutation({
    mutationFn: async () => {
      if (!competitionId) throw new Error("Selecciona una competición");
      if (!homeName.trim() || !awayName.trim()) throw new Error("Faltan equipos");
      if (!homeFlag.trim() || !awayFlag.trim()) throw new Error("Faltan códigos de bandera");
      if (!startLocal) throw new Error("Falta la fecha y hora");
      if (!finalSlug) throw new Error("Falta el identificador");
      const start_at = localToIsoInTz(startLocal, timezone);
      const oddH = Number(oddsHome);
      const oddD = Number(oddsDraw);
      const oddA = Number(oddsAway);
      if (![oddH, oddD, oddA].every((n) => Number.isFinite(n) && n >= 1.01)) {
        throw new Error("Cuotas inválidas (mín. 1.01)");
      }
      return upsertFn({
        data: {
          ...(match?.id ? { id: match.id } : {}),
          competition_id: competitionId,
          slug: finalSlug,
          home_name: homeName.trim(),
          home_flag_code: homeFlag.trim().toUpperCase(),
          away_name: awayName.trim(),
          away_flag_code: awayFlag.trim().toUpperCase(),
          start_at,
          odds_home: oddH,
          odds_draw: oddD,
          odds_away: oddA,
          is_featured: isFeatured,
          is_published: isPublished,
        },
      });
    },
    onSuccess: () => {
      toast.success(match ? "Partido actualizado." : "Partido creado.");
      qc.invalidateQueries({ queryKey: ["admin", "sports"] });
      onClose();
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  return (
    <ModalShell title={match ? "Editar partido" : "Nuevo partido"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Competición">
          <select
            value={competitionId}
            onChange={(e) => setCompetitionId(e.target.value)}
            className="w-full rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-2 text-sm text-white focus:border-fuchsia-400/60 focus:outline-none"
          >
            <option value="">Selecciona…</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 rounded-lg border border-purple-500/25 bg-[#150830]/40 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-purple-200/80">Local</div>
            <FlagPickerButton
              value={homeFlag}
              label="Bandera local"
              onChange={(t) => {
                setHomeFlag(t.code);
                if (!homeName.trim()) setHomeName(t.name);
              }}
            />
            <input
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
              placeholder="Nombre del equipo"
              className={inputCls}
            />
          </div>
          <div className="space-y-2 rounded-lg border border-purple-500/25 bg-[#150830]/40 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-purple-200/80">Visitante</div>
            <FlagPickerButton
              value={awayFlag}
              label="Bandera visitante"
              onChange={(t) => {
                setAwayFlag(t.code);
                if (!awayName.trim()) setAwayName(t.name);
              }}
            />
            <input
              value={awayName}
              onChange={(e) => setAwayName(e.target.value)}
              placeholder="Nombre del equipo"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label={`Fecha (${timezone})`}>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Identificador">
            <input
              value={finalSlug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="argentina-vs-francia"
              className={`${inputCls} font-mono lowercase`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Cuota Local">
            <input value={oddsHome} onChange={(e) => setOddsHome(e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Cuota Empate">
            <input value={oddsDraw} onChange={(e) => setOddsDraw(e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Cuota Visitante">
            <input value={oddsAway} onChange={(e) => setOddsAway(e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <ToggleChip active={isPublished} onClick={() => setIsPublished((v) => !v)} label="Publicado" icon={Eye} />
          <ToggleChip active={isFeatured} onClick={() => setIsFeatured((v) => !v)} label="Destacado" icon={Star} />
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-purple-500/30 bg-[#0c0620] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/10"
          >
            Cancelar
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-fuchsia-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================
 * Settle modal
 * ========================================================== */

function SettleModal({ match, onClose }: { match: SportsMatch; onClose: () => void }) {
  const qc = useQueryClient();
  const settleFn = useServerFn(adminSettleMatch);
  const [home, setHome] = useState<string>(match.home_score != null ? String(match.home_score) : "");
  const [away, setAway] = useState<string>(match.away_score != null ? String(match.away_score) : "");

  const mut = useMutation({
    mutationFn: async () => {
      const h = Number(home);
      const a = Number(away);
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
        throw new Error("Ingresa marcadores válidos");
      }
      return settleFn({ data: { id: match.id, home_score: h, away_score: a } });
    },
    onSuccess: () => {
      toast.success("Partido liquidado.");
      qc.invalidateQueries({ queryKey: ["admin", "sports"] });
      onClose();
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  return (
    <ModalShell title="Liquidar partido" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-md border border-purple-500/25 bg-[#150830]/60 p-2 text-center text-xs text-purple-100">
          <span className="font-bold">{match.home_name}</span> vs <span className="font-bold">{match.away_name}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label={match.home_name}>
            <input
              value={home}
              onChange={(e) => setHome(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className={`${inputCls} text-center text-lg font-black`}
            />
          </Field>
          <div className="pb-2 text-center text-xs font-bold text-purple-300">–</div>
          <Field label={match.away_name}>
            <input
              value={away}
              onChange={(e) => setAway(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className={`${inputCls} text-center text-lg font-black`}
            />
          </Field>
        </div>
        <p className="text-[10px] text-purple-200/70">
          El resultado se determinará automáticamente. Las apuestas ganadoras se pagarán y se registrarán las transacciones.
        </p>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-purple-500/30 bg-[#0c0620] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/10"
          >
            Cancelar
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlagIcon className="h-3.5 w-3.5" />}
            Liquidar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================
 * Competitions modal
 * ========================================================== */

function CompetitionsModal({
  competitions,
  onClose,
}: {
  competitions: SportsCompetition[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(adminUpsertCompetition);
  const deleteFn = useServerFn(adminDeleteCompetition);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const finalSlug = slugTouched ? newSlug : slugify(newName);

  const createMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          slug: finalSlug,
          name: newName.trim(),
          is_active: true,
          sort_order: competitions.length,
        },
      }),
    onSuccess: () => {
      setNewName("");
      setNewSlug("");
      setSlugTouched(false);
      qc.invalidateQueries({ queryKey: ["admin", "sports"] });
      toast.success("Competición creada.");
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  const toggleMut = useMutation({
    mutationFn: (c: SportsCompetition) =>
      upsertFn({
        data: {
          id: c.id,
          slug: c.slug,
          name: c.name,
          is_active: !c.is_active,
          sort_order: c.sort_order,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "sports"] }),
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Competición eliminada.");
      qc.invalidateQueries({ queryKey: ["admin", "sports"] });
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  return (
    <ModalShell title="Competiciones" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-md border border-purple-500/25 bg-[#150830]/60 p-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Field label="Nombre">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Copa América" className={inputCls} />
            </Field>
            <Field label="Identificador">
              <input
                value={finalSlug}
                onChange={(e) => {
                  setNewSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="copa-america"
                className={`${inputCls} font-mono lowercase`}
              />
            </Field>
            <div className="flex items-end">
              <button
                onClick={() => createMut.mutate()}
                disabled={!newName.trim() || createMut.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-fuchsia-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:opacity-50"
              >
                {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Añadir
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {competitions.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md border border-purple-500/25 bg-[#0c0620] px-2 py-1.5">
              <Trophy className="h-3.5 w-3.5 text-purple-300" />
              <div className="flex-1">
                <div className="text-xs font-bold text-white">{c.name}</div>
                <div className="font-mono text-[10px] text-purple-300/70">{c.slug}</div>
              </div>
              <button
                onClick={() => toggleMut.mutate(c)}
                className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  c.is_active
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-purple-500/30 bg-[#150830] text-purple-200"
                }`}
              >
                {c.is_active ? "Activa" : "Inactiva"}
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar "${c.name}"?`)) deleteMut.mutate(c.id);
                }}
                className="rounded-md border border-rose-500/40 bg-rose-500/10 p-1.5 text-rose-200 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {competitions.length === 0 && (
            <div className="py-2 text-center text-xs text-purple-200/70">Aún no hay competiciones.</div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================
 * Timezone modal
 * ========================================================== */

function TimezoneModal({ current, onClose }: { current: string; onClose: () => void }) {
  const qc = useQueryClient();
  const setTzFn = useServerFn(adminSetSportsTimezone);
  const [value, setValue] = useState(current);

  const mut = useMutation({
    mutationFn: () => setTzFn({ data: { timezone: value.trim() } }),
    onSuccess: () => {
      toast.success("Zona horaria actualizada.");
      qc.invalidateQueries({ queryKey: ["admin", "sports"] });
      onClose();
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  const presets = ["America/Bogota", "America/Mexico_City", "America/Argentina/Buenos_Aires", "America/Santiago", "UTC"];

  return (
    <ModalShell title="Zona horaria del sistema" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-purple-200/80">
          Todos los partidos y cierres de apuestas se calcularán con esta zona horaria en el servidor.
        </p>
        <Field label="Zona horaria (IANA)">
          <input value={value} onChange={(e) => setValue(e.target.value)} className={`${inputCls} font-mono`} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((tz) => (
            <button
              key={tz}
              onClick={() => setValue(tz)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                value === tz
                  ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100"
                  : "border-purple-500/30 bg-[#0c0620] text-purple-200 hover:bg-purple-500/10"
              }`}
            >
              {tz}
            </button>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-purple-500/30 bg-[#0c0620] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/10"
          >
            Cancelar
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-fuchsia-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================
 * Small primitives
 * ========================================================== */

const inputCls =
  "w-full rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-sm text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-purple-200/80">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Star;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
        active
          ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100"
          : "border-purple-500/30 bg-[#0c0620] text-purple-200"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-3 py-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] shadow-[0_0_40px_rgba(168,85,247,0.4)]"
      >
        <div className="flex items-center justify-between border-b border-purple-500/25 px-4 py-3">
          <h3 className="font-display text-sm font-black uppercase tracking-widest text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-purple-200 hover:bg-white/5"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function friendly(msg: string) {
  const map: Record<string, string> = {
    not_admin: "No tienes permisos para esta acción.",
    not_authenticated: "Necesitas iniciar sesión.",
    invalid_stake: "Monto de apuesta inválido.",
    match_not_found: "El partido no existe.",
    match_not_available: "El partido no está publicado.",
    bets_closed: "Las apuestas ya están cerradas.",
    invalid_score: "Marcador inválido.",
    already_settled: "Este partido ya fue liquidado.",
    match_cancelled: "El partido está cancelado.",
    balance_not_found: "Saldo del usuario no encontrado.",
    insufficient_funds: "Saldo insuficiente.",
    match_locked_after_start: "No se puede editar un partido que ya inició.",
    match_has_bets: "No se puede eliminar: hay apuestas registradas.",
    competition_has_matches: "No se puede eliminar: tiene partidos asociados.",
    slug_invalid: "El identificador solo admite minúsculas, números y guiones.",
    invalid_timezone: "Zona horaria no reconocida.",
  };
  const raw = msg.replace(/^Error:\s*/, "").trim();
  return map[raw] ?? raw;
}