import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Save, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  adminListHomeSlides,
  adminUpsertHomeSlide,
  adminDeleteHomeSlide,
  adminListFeaturedGames,
  adminUpsertFeaturedGame,
  adminDeleteFeaturedGame,
  adminUploadHomeImage,
} from "@/lib/admin/home-content.functions";
import { Panel } from "./shared";

type SlideDraft = {
  id?: string;
  position: number;
  image_url: string;
  image_preview?: string;
  eyebrow: string;
  title: string;
  description: string;
  cta_label: string;
  cta_link: string;
  active: boolean;
};

type FeaturedDraft = {
  id?: string;
  position: number;
  image_url: string;
  image_preview?: string;
  name: string;
  tag: string;
  tag_color: "purple" | "emerald" | "rose" | "amber" | "fuchsia";
  link: string;
  active: boolean;
};

async function fileToBase64(file: File): Promise<{ base64: string; type: string; name: string }> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), type: file.type || "image/jpeg", name: file.name };
}

export function HomeContentSection() {
  const [tab, setTab] = useState<"slides" | "featured">("slides");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("slides")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
            tab === "slides"
              ? "bg-purple-600/30 text-white shadow-[inset_0_0_0_1px_rgba(168,85,247,0.5)]"
              : "text-purple-200/70 hover:bg-white/5"
          }`}
        >
          Slider del Home
        </button>
        <button
          onClick={() => setTab("featured")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
            tab === "featured"
              ? "bg-purple-600/30 text-white shadow-[inset_0_0_0_1px_rgba(168,85,247,0.5)]"
              : "text-purple-200/70 hover:bg-white/5"
          }`}
        >
          Juegos Destacados
        </button>
      </div>
      {tab === "slides" ? <SlidesEditor /> : <FeaturedEditor />}
    </div>
  );
}

function SlidesEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListHomeSlides);
  const upFn = useServerFn(adminUpsertHomeSlide);
  const delFn = useServerFn(adminDeleteHomeSlide);
  const uploadFn = useServerFn(adminUploadHomeImage);

  const q = useQuery({ queryKey: ["admin-home-slides"], queryFn: () => listFn() });
  const [drafts, setDrafts] = useState<Record<string, SlideDraft>>({});

  const items: SlideDraft[] = (q.data ?? []).map((r) => ({
    id: r.id,
    position: r.position,
    image_url: r.image_url,
    image_preview: r.image_resolved,
    eyebrow: r.eyebrow,
    title: r.title,
    description: r.description,
    cta_label: r.cta_label,
    cta_link: r.cta_link,
    active: r.active,
  }));

  function get(id: string, base: SlideDraft) {
    return drafts[id] ?? base;
  }

  const saveMut = useMutation({
    mutationFn: (d: SlideDraft) =>
      upFn({
        data: {
          id: d.id,
          position: d.position,
          image_url: d.image_url,
          eyebrow: d.eyebrow,
          title: d.title,
          description: d.description,
          cta_label: d.cta_label,
          cta_link: d.cta_link,
          active: d.active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-slides"] });
      setDrafts({});
      toast.success("Slide guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-slides"] });
      toast.success("Slide eliminado");
    },
  });

  async function handleUpload(key: string, file: File, current: SlideDraft) {
    try {
      const { base64, type, name } = await fileToBase64(file);
      const res = await uploadFn({
        data: { filename: name, content_type: type, data_base64: base64 },
      });
      setDrafts((d) => ({
        ...d,
        [key]: { ...current, image_url: res.path, image_preview: res.signedUrl },
      }));
      toast.success("Imagen subida");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function addNew() {
    const key = `new-${Date.now()}`;
    setDrafts((d) => ({
      ...d,
      [key]: {
        position: items.length,
        image_url: "",
        eyebrow: "",
        title: "Nuevo slide",
        description: "",
        cta_label: "Ver más",
        cta_link: "/home",
        active: true,
      },
    }));
  }

  const newDrafts = Object.entries(drafts).filter(([k]) => k.startsWith("new-"));

  return (
    <Panel
      title="Slider del Home"
      actions={
        <button
          onClick={addNew}
          className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/40 bg-fuchsia-600/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-600/30"
        >
          <Plus className="h-3 w-3" /> Nuevo slide
        </button>
      }
    >
      {q.isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
      ) : (
        <div className="space-y-3">
          {newDrafts.map(([key, d]) => (
            <SlideCard
              key={key}
              draft={d}
              onChange={(nd) => setDrafts((all) => ({ ...all, [key]: nd }))}
              onUpload={(f) => handleUpload(key, f, d)}
              onSave={() => saveMut.mutate(d)}
              onCancel={() =>
                setDrafts((all) => {
                  const { [key]: _drop, ...rest } = all;
                  void _drop;
                  return rest;
                })
              }
              saving={saveMut.isPending}
              isNew
            />
          ))}
          {items.map((base) => {
            const key = base.id!;
            const d = get(key, base);
            const dirty = JSON.stringify(d) !== JSON.stringify(base);
            return (
              <SlideCard
                key={key}
                draft={d}
                onChange={(nd) => setDrafts((all) => ({ ...all, [key]: nd }))}
                onUpload={(f) => handleUpload(key, f, d)}
                onSave={() => saveMut.mutate(d)}
                onDelete={() => {
                  if (confirm("¿Eliminar este slide?")) delMut.mutate(key);
                }}
                dirty={dirty}
                saving={saveMut.isPending}
              />
            );
          })}
          {items.length === 0 && newDrafts.length === 0 && (
            <p className="text-center text-xs text-purple-200/60">
              No hay slides aún. Si dejas la lista vacía, el Home usa los slides por defecto.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

function SlideCard({
  draft,
  onChange,
  onUpload,
  onSave,
  onDelete,
  onCancel,
  dirty,
  saving,
  isNew,
}: {
  draft: SlideDraft;
  onChange: (d: SlideDraft) => void;
  onUpload: (f: File) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  dirty?: boolean;
  saving?: boolean;
  isNew?: boolean;
}) {
  return (
    <div className="rounded-xl border border-purple-500/30 bg-[#150830]/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex w-full flex-col gap-2 sm:w-40">
          <div className="relative aspect-video w-full overflow-hidden rounded-md border border-purple-500/30 bg-[#0c0620]">
            {draft.image_preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.image_preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-purple-300/40">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-purple-500/40 bg-purple-600/20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-600/30">
            <Upload className="h-3 w-3" /> Subir imagen
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Field
            label="Encabezado"
            value={draft.eyebrow}
            onChange={(v) => onChange({ ...draft, eyebrow: v })}
          />
          <Field
            label="Título"
            value={draft.title}
            onChange={(v) => onChange({ ...draft, title: v })}
          />
          <Field
            label="Descripción"
            value={draft.description}
            onChange={(v) => onChange({ ...draft, description: v })}
            textarea
            full
          />
          <Field
            label="Texto botón"
            value={draft.cta_label}
            onChange={(v) => onChange({ ...draft, cta_label: v })}
          />
          <Field
            label="Link destino"
            value={draft.cta_link}
            onChange={(v) => onChange({ ...draft, cta_link: v })}
            placeholder="/spaceman, /arena, etc."
          />
          <Field
            label="Orden"
            value={String(draft.position)}
            onChange={(v) => onChange({ ...draft, position: Number(v) || 0 })}
          />
          <label className="col-span-2 flex items-center gap-2 text-[11px] text-purple-200">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => onChange({ ...draft, active: e.target.checked })}
            />
            Activo (visible en el Home)
          </label>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-md border border-purple-500/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-200 hover:bg-white/5"
          >
            Cancelar
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/20"
          >
            <Trash2 className="h-3 w-3" /> Eliminar
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving || (!isNew && !dirty) || !draft.image_url || !draft.title}
          className="inline-flex items-center gap-1 rounded-md bg-fuchsia-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_10px_rgba(217,70,239,0.5)] hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Guardar
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  full,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  full?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-300/70">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
        />
      )}
    </label>
  );
}

/* -------------------- FEATURED -------------------- */

function FeaturedEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListFeaturedGames);
  const upFn = useServerFn(adminUpsertFeaturedGame);
  const delFn = useServerFn(adminDeleteFeaturedGame);
  const uploadFn = useServerFn(adminUploadHomeImage);

  const q = useQuery({ queryKey: ["admin-home-featured"], queryFn: () => listFn() });
  const [drafts, setDrafts] = useState<Record<string, FeaturedDraft>>({});

  const items: FeaturedDraft[] = (q.data ?? []).map((r) => ({
    id: r.id,
    position: r.position,
    image_url: r.image_url,
    image_preview: r.image_resolved,
    name: r.name,
    tag: r.tag,
    tag_color: r.tag_color as FeaturedDraft["tag_color"],
    link: r.link,
    active: r.active,
  }));

  const saveMut = useMutation({
    mutationFn: (d: FeaturedDraft) =>
      upFn({
        data: {
          id: d.id,
          position: d.position,
          image_url: d.image_url,
          name: d.name,
          tag: d.tag,
          tag_color: d.tag_color,
          link: d.link,
          active: d.active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-featured"] });
      setDrafts({});
      toast.success("Juego guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-featured"] });
      toast.success("Juego eliminado");
    },
  });

  async function handleUpload(key: string, file: File, current: FeaturedDraft) {
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const arr = new Uint8Array(buf);
      for (let i = 0; i < arr.byteLength; i++) bin += String.fromCharCode(arr[i]);
      const res = await uploadFn({
        data: {
          filename: file.name,
          content_type: file.type || "image/jpeg",
          data_base64: btoa(bin),
        },
      });
      setDrafts((d) => ({
        ...d,
        [key]: { ...current, image_url: res.path, image_preview: res.signedUrl },
      }));
      toast.success("Imagen subida");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function addNew() {
    const key = `new-${Date.now()}`;
    setDrafts((d) => ({
      ...d,
      [key]: {
        position: items.length,
        image_url: "",
        name: "NUEVO",
        tag: "POPULAR",
        tag_color: "purple",
        link: "/home",
        active: true,
      },
    }));
  }

  const newDrafts = Object.entries(drafts).filter(([k]) => k.startsWith("new-"));

  return (
    <Panel
      title="Juegos Destacados"
      actions={
        <button
          onClick={addNew}
          className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/40 bg-fuchsia-600/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-600/30"
        >
          <Plus className="h-3 w-3" /> Nuevo
        </button>
      }
    >
      {q.isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
      ) : (
        <div className="space-y-3">
          {newDrafts.map(([key, d]) => (
            <FeaturedCard
              key={key}
              draft={d}
              onChange={(nd) => setDrafts((all) => ({ ...all, [key]: nd }))}
              onUpload={(f) => handleUpload(key, f, d)}
              onSave={() => saveMut.mutate(d)}
              onCancel={() =>
                setDrafts((all) => {
                  const { [key]: _drop, ...rest } = all;
                  void _drop;
                  return rest;
                })
              }
              saving={saveMut.isPending}
              isNew
            />
          ))}
          {items.map((base) => {
            const key = base.id!;
            const d = drafts[key] ?? base;
            const dirty = JSON.stringify(d) !== JSON.stringify(base);
            return (
              <FeaturedCard
                key={key}
                draft={d}
                onChange={(nd) => setDrafts((all) => ({ ...all, [key]: nd }))}
                onUpload={(f) => handleUpload(key, f, d)}
                onSave={() => saveMut.mutate(d)}
                onDelete={() => {
                  if (confirm("¿Eliminar este juego?")) delMut.mutate(key);
                }}
                dirty={dirty}
                saving={saveMut.isPending}
              />
            );
          })}
          {items.length === 0 && newDrafts.length === 0 && (
            <p className="text-center text-xs text-purple-200/60">
              No hay juegos destacados aún. Si la lista está vacía, el Home usa los juegos por defecto.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

function FeaturedCard({
  draft,
  onChange,
  onUpload,
  onSave,
  onDelete,
  onCancel,
  dirty,
  saving,
  isNew,
}: {
  draft: FeaturedDraft;
  onChange: (d: FeaturedDraft) => void;
  onUpload: (f: File) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  dirty?: boolean;
  saving?: boolean;
  isNew?: boolean;
}) {
  return (
    <div className="rounded-xl border border-purple-500/30 bg-[#150830]/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex w-full flex-col gap-2 sm:w-32">
          <div className="relative aspect-square w-full overflow-hidden rounded-md border border-purple-500/30 bg-[#0c0620]">
            {draft.image_preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.image_preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-purple-300/40">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-purple-500/40 bg-purple-600/20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-600/30">
            <Upload className="h-3 w-3" /> Imagen
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Field
            label="Nombre"
            value={draft.name}
            onChange={(v) => onChange({ ...draft, name: v })}
          />
          <Field
            label="Etiqueta"
            value={draft.tag}
            onChange={(v) => onChange({ ...draft, tag: v })}
          />
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-300/70">
              Color etiqueta
            </span>
            <select
              value={draft.tag_color}
              onChange={(e) =>
                onChange({ ...draft, tag_color: e.target.value as FeaturedDraft["tag_color"] })
              }
              className="rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
            >
              <option value="purple">Morado</option>
              <option value="emerald">Verde</option>
              <option value="rose">Rojo</option>
              <option value="amber">Ámbar</option>
              <option value="fuchsia">Fucsia</option>
            </select>
          </label>
          <Field
            label="Orden"
            value={String(draft.position)}
            onChange={(v) => onChange({ ...draft, position: Number(v) || 0 })}
          />
          <Field
            label="Link destino"
            value={draft.link}
            onChange={(v) => onChange({ ...draft, link: v })}
            full
          />
          <label className="col-span-2 flex items-center gap-2 text-[11px] text-purple-200">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => onChange({ ...draft, active: e.target.checked })}
            />
            Activo
          </label>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-md border border-purple-500/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-200 hover:bg-white/5"
          >
            Cancelar
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/20"
          >
            <Trash2 className="h-3 w-3" /> Eliminar
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving || (!isNew && !dirty) || !draft.image_url || !draft.name}
          className="inline-flex items-center gap-1 rounded-md bg-fuchsia-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_10px_rgba(217,70,239,0.5)] hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Guardar
        </button>
      </div>
    </div>
  );
}