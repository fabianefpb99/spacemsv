import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Upload, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Panel } from "./shared";
import { MISSION_ICONS, getMissionIconUrl, type MissionIconKey } from "@/lib/mission-icons";
import { useAuth } from "@/hooks/useAuth";

type MissionType = "daily" | "weekly" | "special";
type RewardKind = "bonus" | "spins" | "xp" | "avatar";
type Accent = "purple" | "emerald" | "amber" | "rose" | "blue";

type Mission = {
  id: string;
  type: MissionType;
  title: string;
  subtitle: string | null;
  goal: number;
  icon_key: MissionIconKey;
  accent: Accent;
  reward_kind: RewardKind;
  reward_value: number;
  reward_label: string;
  reward_image_url: string | null;
  cta_label: string;
  cta_to: string;
  sort_order: number;
  is_active: boolean;
};

const TYPE_LABELS: Record<MissionType, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  special: "Especial",
};

const REWARD_LABELS: Record<RewardKind, string> = {
  bonus: "Bonus ($)",
  spins: "Free Spins",
  xp: "Bonus XP",
  avatar: "Avatar",
};

const ACCENT_SWATCH: Record<Accent, string> = {
  purple: "bg-purple-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  blue: "bg-sky-500",
};

const EMPTY: Omit<Mission, "id"> = {
  type: "daily",
  title: "",
  subtitle: "",
  goal: 1,
  icon_key: "swords",
  accent: "purple",
  reward_kind: "bonus",
  reward_value: 0,
  reward_label: "",
  reward_image_url: null,
  cta_label: "Jugar",
  cta_to: "/home",
  sort_order: 0,
  is_active: true,
};

export function MissionsSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<(Partial<Mission> & { id?: string }) | null>(null);

  const list = useQuery({
    queryKey: ["admin-missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("type")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Mission[];
    },
  });

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta misión?")) return;
    const { error } = await supabase.from("missions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Misión eliminada");
    qc.invalidateQueries({ queryKey: ["admin-missions"] });
  }

  async function handleToggleActive(m: Mission) {
    const { error } = await supabase
      .from("missions")
      .update({ is_active: !m.is_active })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-missions"] });
  }

  const grouped: Record<MissionType, Mission[]> = { daily: [], weekly: [], special: [] };
  for (const m of list.data ?? []) grouped[m.type].push(m);

  return (
    <div className="space-y-4">
      <SpecialEventPanel />

      <Panel
        title="Eventos y Misiones"
        actions={
          <button
            onClick={() => setEditing({ ...EMPTY })}
            className="inline-flex items-center gap-1.5 rounded-md bg-fuchsia-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva misión
          </button>
        }
      >
        {list.isLoading ? (
          <div className="flex items-center justify-center py-8 text-purple-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (list.data ?? []).length === 0 ? (
          <div className="py-10 text-center text-xs text-purple-200/70">
            Aún no has creado misiones. Crea la primera para que aparezca en /eventos.
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(grouped) as MissionType[]).map((t) =>
              grouped[t].length === 0 ? null : (
                <div key={t}>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/80">
                    {TYPE_LABELS[t]}s
                  </div>
                  <div className="space-y-1.5">
                    {grouped[t].map((m) => (
                      <MissionRow
                        key={m.id}
                        m={m}
                        onEdit={() => setEditing(m)}
                        onDelete={() => handleDelete(m.id)}
                        onToggle={() => handleToggleActive(m)}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </Panel>

      {editing && (
        <MissionEditor
          initial={editing}
          userId={user?.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-missions"] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MissionRow({
  m,
  onEdit,
  onDelete,
  onToggle,
}: {
  m: Mission;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-[#150830]/50 p-2.5">
      <img src={getMissionIconUrl(m.icon_key)} alt="" className="h-10 w-10 object-contain" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-white">
          {m.title} {m.subtitle ? <span className="text-fuchsia-200">{m.subtitle}</span> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-purple-200/70">
          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 font-semibold text-purple-100">
            {TYPE_LABELS[m.type]}
          </span>
          <span>Meta: {m.goal}</span>
          <span>•</span>
          <span>
            {REWARD_LABELS[m.reward_kind]}
            {m.reward_kind !== "avatar" && m.reward_value ? `: ${m.reward_value}` : ""}
          </span>
          {m.reward_image_url && (
            <img src={m.reward_image_url} alt="" className="h-5 w-5 rounded border border-amber-400/50 object-cover" />
          )}
          <span className={`ml-1 inline-block h-2.5 w-2.5 rounded-full ${ACCENT_SWATCH[m.accent]}`} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onToggle}
          title={m.is_active ? "Desactivar" : "Activar"}
          className={`rounded-md p-1.5 transition ${m.is_active ? "text-emerald-300 hover:bg-emerald-500/15" : "text-purple-300/50 hover:bg-purple-500/15"}`}
        >
          {m.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button onClick={onEdit} className="rounded-md p-1.5 text-purple-200 hover:bg-purple-500/15">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="rounded-md p-1.5 text-rose-300 hover:bg-rose-500/15">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MissionEditor({
  initial,
  userId,
  onClose,
  onSaved,
}: {
  initial: Partial<Mission> & { id?: string };
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [m, setM] = useState<Partial<Mission> & { id?: string }>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof Mission>(key: K, value: Mission[K] | null) {
    setM((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUpload(file: File) {
    if (!userId) {
      toast.error("Sesión no detectada");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Máximo 2 MB. Recomendado 512×512 PNG.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("mission-rewards")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    // Bucket privado → URL firmada de larga duración (10 años)
    const { data, error: signErr } = await supabase.storage
      .from("mission-rewards")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setUploading(false);
    if (signErr || !data?.signedUrl) {
      toast.error(signErr?.message || "No se pudo generar URL");
      return;
    }
    set("reward_image_url", data.signedUrl);
    toast.success("Imagen subida");
  }

  async function handleSave() {
    if (!m.title?.trim()) return toast.error("Falta el título");
    if (m.reward_kind === "avatar" && !m.reward_image_url) {
      return toast.error("Sube la imagen del avatar");
    }
    setSaving(true);
    const payload = {
      type: m.type!,
      title: m.title!.trim(),
      subtitle: m.subtitle?.trim() || null,
      goal: Number(m.goal) || 1,
      icon_key: m.icon_key!,
      accent: m.accent!,
      reward_kind: m.reward_kind!,
      reward_value: Number(m.reward_value) || 0,
      reward_label: m.reward_label?.trim() || autoLabel(m),
      reward_image_url: m.reward_image_url ?? null,
      cta_label: m.cta_label?.trim() || "Jugar",
      cta_to: m.cta_to?.trim() || "/home",
      sort_order: Number(m.sort_order) || 0,
      is_active: m.is_active ?? true,
    };
    const res = m.id
      ? await supabase.from("missions").update(payload).eq("id", m.id)
      : await supabase.from("missions").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(m.id ? "Misión actualizada" : "Misión creada");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-fuchsia-500/40 bg-[#0c0620] p-4 shadow-[0_0_30px_rgba(217,70,239,0.3)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white">
            {m.id ? "Editar misión" : "Nueva misión"}
          </h3>
          <button onClick={onClose} className="text-purple-300 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              value={m.type}
              onChange={(e) => set("type", e.target.value as MissionType)}
              className={inputCls}
            >
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
              <option value="special">Especial</option>
            </select>
          </Field>

          <Field label="Color (acento)">
            <select value={m.accent} onChange={(e) => set("accent", e.target.value as Accent)} className={inputCls}>
              <option value="purple">Morado</option>
              <option value="emerald">Verde</option>
              <option value="amber">Dorado</option>
              <option value="rose">Rosa</option>
              <option value="blue">Azul</option>
            </select>
          </Field>

          <Field label="Título" className="sm:col-span-2">
            <input
              type="text"
              value={m.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Haz 10 apuestas en"
              className={inputCls}
            />
          </Field>

          <Field label="Subtítulo (opcional)" className="sm:col-span-2">
            <input
              type="text"
              value={m.subtitle ?? ""}
              onChange={(e) => set("subtitle", e.target.value)}
              placeholder="ARENA"
              className={inputCls}
            />
          </Field>

          <Field label="Meta (objetivo numérico)">
            <input
              type="number"
              min={1}
              value={Number(m.goal ?? 1)}
              onChange={(e) => set("goal", Number(e.target.value))}
              className={inputCls}
            />
          </Field>

          <Field label="Orden (menor = primero)">
            <input
              type="number"
              value={Number(m.sort_order ?? 0)}
              onChange={(e) => set("sort_order", Number(e.target.value))}
              className={inputCls}
            />
          </Field>

          <Field label="Ícono" className="sm:col-span-2">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {MISSION_ICONS.map((ic) => (
                <button
                  key={ic.key}
                  type="button"
                  onClick={() => set("icon_key", ic.key)}
                  title={ic.label}
                  className={`flex aspect-square items-center justify-center rounded-lg border p-1 transition ${
                    m.icon_key === ic.key
                      ? "border-fuchsia-400 bg-fuchsia-500/15 shadow-[0_0_10px_rgba(217,70,239,0.5)]"
                      : "border-purple-500/30 hover:border-fuchsia-400/60"
                  }`}
                >
                  <img src={ic.url} alt={ic.label} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </Field>

          <Field label="Tipo de recompensa">
            <select
              value={m.reward_kind}
              onChange={(e) => set("reward_kind", e.target.value as RewardKind)}
              className={inputCls}
            >
              <option value="bonus">Bonus ($)</option>
              <option value="spins">Free Spins</option>
              <option value="xp">Bonus XP</option>
              <option value="avatar">Avatar exclusivo</option>
            </select>
          </Field>

          {m.reward_kind !== "avatar" && (
            <Field
              label={
                m.reward_kind === "bonus"
                  ? "Monto en COP"
                  : m.reward_kind === "spins"
                    ? "Cantidad de spins"
                    : "Cantidad de XP"
              }
            >
              <input
                type="number"
                min={0}
                value={Number(m.reward_value ?? 0)}
                onChange={(e) => set("reward_value", Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          )}

          {m.reward_kind === "avatar" && (
            <Field label="Imagen del avatar (recomendado 512×512 PNG)" className="sm:col-span-2">
              <div className="flex items-center gap-3">
                {m.reward_image_url ? (
                  <img
                    src={m.reward_image_url}
                    alt="Avatar"
                    className="h-16 w-16 rounded-lg border border-amber-400/60 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-purple-500/40 text-[9px] text-purple-300/60">
                    Sin imagen
                  </div>
                )}
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-500/20 ${uploading ? "pointer-events-none opacity-60" : ""}`}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {m.reward_image_url ? "Reemplazar" : "Subir imagen"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="mt-1.5 text-[10px] text-purple-300/60">
                Tamaño ideal: 512×512 px, fondo transparente o sólido, PNG. Máx 2 MB.
              </p>
            </Field>
          )}

          <Field label="Etiqueta de recompensa (opcional)" className="sm:col-span-2">
            <input
              type="text"
              value={m.reward_label ?? ""}
              onChange={(e) => set("reward_label", e.target.value)}
              placeholder={autoLabel(m)}
              className={inputCls}
            />
          </Field>

          <Field label="Texto del botón">
            <input
              type="text"
              value={m.cta_label ?? ""}
              onChange={(e) => set("cta_label", e.target.value)}
              placeholder="Jugar"
              className={inputCls}
            />
          </Field>

          <Field label="Ruta del botón (interna)">
            <input
              type="text"
              value={m.cta_to ?? ""}
              onChange={(e) => set("cta_to", e.target.value)}
              placeholder="/home"
              className={inputCls}
            />
          </Field>

          <Field label="Estado" className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-purple-100">
              <input
                type="checkbox"
                checked={m.is_active ?? true}
                onChange={(e) => set("is_active", e.target.checked)}
              />
              Activa (visible en /eventos)
            </label>
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-purple-500/40 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500/10"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-fuchsia-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function autoLabel(m: Partial<Mission>): string {
  if (m.reward_kind === "bonus") return `${Number(m.reward_value ?? 0)} Bonus`;
  if (m.reward_kind === "spins") return `${Number(m.reward_value ?? 0)} Free Spins`;
  if (m.reward_kind === "xp") return `+${Number(m.reward_value ?? 0)} XP`;
  if (m.reward_kind === "avatar") return "Avatar exclusivo";
  return "";
}

const inputCls =
  "w-full rounded-md border border-purple-500/30 bg-[#150830]/60 px-2.5 py-2 text-xs text-white outline-none placeholder:text-purple-300/40 focus:border-fuchsia-400/60";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}