import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Save, Upload, Image as ImageIcon, Download, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  adminListHomeSlides,
  adminUpsertHomeSlide,
  adminDeleteHomeSlide,
  adminListFeaturedGames,
  adminUpsertFeaturedGame,
  adminDeleteFeaturedGame,
  adminUploadHomeImage,
  adminListHomeStorageObjects,
  adminReplaceHomeImage,
} from "@/lib/admin/home-content.functions";
import { DEFAULT_SLIDES, DEFAULT_FEATURED } from "@/lib/admin/home-defaults";
import { Panel } from "./shared";
import { compressImageFile } from "@/lib/admin/image-compress";

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
  text_hidden?: boolean;
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

async function urlToUploadInput(url: string, fallbackName: string): Promise<{ base64: string; type: string; name: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer la imagen (${res.status})`);
  const blob = await res.blob();
  const original = new File([blob], fallbackName, { type: blob.type || "image/jpeg" });
  const compressed = await compressImageFile(original);
  return fileToBase64(compressed);
}

function filenameFromUrl(url: string, fallback: string) {
  try {
    const u = new URL(url, window.location.origin);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return (last && /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(last)) ? last : fallback;
  } catch {
    return fallback;
  }
}

export function HomeContentSection() {
  const [tab, setTab] = useState<"slides" | "featured">("slides");
  return (
    <div className="space-y-3">
      <BulkCompressPanel />
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
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-100/80">
        <span className="font-bold uppercase tracking-wider text-amber-200">Nota: </span>
        {tab === "slides" ? (
          <>
            Usa imágenes en formato <b>JPG</b> o <b>WebP</b>, resolución recomendada <b>1600×900 px</b> (16:9) y peso ideal <b>menos de 300 KB</b> para una carga rápida.
          </>
        ) : (
          <>
            Usa imágenes <b>cuadradas</b> en formato <b>JPG</b> o <b>WebP</b>, resolución recomendada <b>600×600 px</b> y peso ideal <b>menos de 150 KB</b> para una carga rápida.
          </>
        )}
      </div>
      {tab === "slides" ? <SlidesEditor /> : <FeaturedEditor />}
    </div>
  );
}

function BulkCompressPanel() {
  const listFn = useServerFn(adminListHomeStorageObjects);
  const replaceFn = useServerFn(adminReplaceHomeImage);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; saved: number; skipped: number }>({
    done: 0,
    total: 0,
    saved: 0,
    skipped: 0,
  });

  async function run() {
    if (!confirm("Esto recomprimirá TODAS las imágenes ya subidas al servidor (slides y juegos destacados) reemplazándolas por versiones WebP más livianas. ¿Continuar?")) return;
    setRunning(true);
    setProgress({ done: 0, total: 0, saved: 0, skipped: 0 });
    try {
      const objects = await listFn();
      const raster = objects.filter((o) => /^image\/(png|jpeg|jpg|webp)$/i.test(o.mime));
      setProgress((p) => ({ ...p, total: raster.length }));
      let savedBytes = 0;
      let skipped = 0;
      for (let i = 0; i < raster.length; i++) {
        const o = raster[i];
        try {
          const res = await fetch(o.signedUrl);
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          const blob = await res.blob();
          const original = new File([blob], o.path, { type: o.mime || blob.type });
          const compressed = await compressImageFile(original, { maxDimension: 1600, quality: 0.82 });
          if (compressed.size >= original.size) {
            skipped++;
          } else {
            const { base64, type } = await fileToBase64(compressed);
            await replaceFn({ data: { path: o.path, content_type: type, data_base64: base64 } });
            savedBytes += original.size - compressed.size;
          }
        } catch (e) {
          console.warn("compress fail", o.path, e);
          skipped++;
        }
        setProgress({ done: i + 1, total: raster.length, saved: savedBytes, skipped });
      }
      toast.success(`Listo. Ahorro: ${(savedBytes / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-emerald-100/90">
          <div className="font-bold uppercase tracking-wider text-emerald-200">Optimizar imágenes existentes</div>
          <div className="text-[10px] text-emerald-100/70">Recomprime a WebP todas las imágenes ya subidas (slides + juegos). Mantiene la misma URL.</div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/50 bg-emerald-600/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-100 hover:bg-emerald-600/35 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          {running ? "Procesando..." : "Comprimir todo"}
        </button>
      </div>
      {running || progress.done > 0 ? (
        <div className="mt-2 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-900/40">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] text-emerald-100/80">
            {progress.done}/{progress.total} · ahorro {(progress.saved / 1024 / 1024).toFixed(2)} MB · sin cambio {progress.skipped}
          </div>
        </div>
      ) : null}
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
  const [seeding, setSeeding] = useState(false);

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
    text_hidden: r.text_hidden ?? false,
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
          text_hidden: d.text_hidden ?? false,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-slides"] });
      qc.invalidateQueries({ queryKey: ["public-home-slides"] });
      setDrafts({});
      toast.success("Slide guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-slides"] });
      qc.invalidateQueries({ queryKey: ["public-home-slides"] });
      toast.success("Slide eliminado");
    },
  });

  async function handleUpload(key: string, file: File, current: SlideDraft) {
    try {
      const compressed = await compressImageFile(file);
      const { base64, type, name } = await fileToBase64(compressed);
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
        cta_link: "/",
        active: true,
        text_hidden: false,
      },
    }));
  }

  const newDrafts = Object.entries(drafts).filter(([k]) => k.startsWith("new-"));

  async function seedDefaults() {
    if (!confirm(`Esto cargará ${DEFAULT_SLIDES.length} slides actuales del Home en la base de datos para que puedas editarlos. ¿Continuar?`)) return;
    setSeeding(true);
    try {
      for (let i = 0; i < DEFAULT_SLIDES.length; i++) {
        const s = DEFAULT_SLIDES[i];
        const name = filenameFromUrl(s.img, `slide-${i + 1}.jpg`);
        const up = await urlToUploadInput(s.img, name);
        const stored = await uploadFn({
          data: { filename: up.name, content_type: up.type, data_base64: up.base64 },
        });
        await upFn({
          data: {
            position: i,
            image_url: stored.path,
            eyebrow: s.eyebrow,
            title: s.title,
            description: s.desc,
            cta_label: s.cta,
            cta_link: s.to,
            active: true,
            text_hidden: false,
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-home-slides"] });
      qc.invalidateQueries({ queryKey: ["public-home-slides"] });
      toast.success("Slides actuales cargados");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Panel
      title="Slider del Home"
      actions={
        <div className="flex items-center gap-2">
          {(q.data?.length ?? 0) === 0 && (
            <button
              onClick={seedDefaults}
              disabled={seeding}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-600/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-600/25 disabled:opacity-50"
            >
              {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Cargar actuales
            </button>
          )}
          <button
            onClick={addNew}
            className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/40 bg-fuchsia-600/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-600/30"
          >
            <Plus className="h-3 w-3" /> Nuevo slide
          </button>
        </div>
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
            <div className="rounded-md border border-purple-500/20 bg-[#0c0620]/60 p-3 text-center text-xs text-purple-200/80">
              No hay slides en la base de datos. El Home está usando los <span className="font-bold text-purple-100">{DEFAULT_SLIDES.length} slides por defecto</span>.
              <br />
              Pulsa <span className="font-bold text-emerald-300">“Cargar actuales”</span> arriba para importarlos y poder editarlos o eliminarlos uno por uno.
            </div>
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
          <label className="col-span-2 flex items-start gap-2 rounded-md border border-fuchsia-500/25 bg-fuchsia-600/10 px-2 py-1.5 text-[11px] text-fuchsia-100">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={draft.text_hidden ?? false}
              onChange={(e) => onChange({ ...draft, text_hidden: e.target.checked })}
            />
            <span>
              Solo imagen (sin textos)
              <span className="block text-[10px] text-fuchsia-200/70">
                Oculta encabezado, título, descripción y botón. La imagen completa queda enlazada al “Link destino”.
              </span>
            </span>
          </label>
          <Field
            label="Encabezado"
            value={draft.eyebrow}
            onChange={(v) => onChange({ ...draft, eyebrow: v })}
            disabled={draft.text_hidden}
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
            disabled={draft.text_hidden}
          />
          <Field
            label="Texto botón"
            value={draft.cta_label}
            onChange={(v) => onChange({ ...draft, cta_label: v })}
            disabled={draft.text_hidden}
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  full?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""} ${disabled ? "opacity-40" : ""}`}>
      <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-300/70">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          disabled={disabled}
          className="rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
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
  const [seeding, setSeeding] = useState(false);

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
      qc.invalidateQueries({ queryKey: ["public-featured-games"] });
      setDrafts({});
      toast.success("Juego guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-featured"] });
      qc.invalidateQueries({ queryKey: ["public-featured-games"] });
      toast.success("Juego eliminado");
    },
  });

  async function handleUpload(key: string, file: File, current: FeaturedDraft) {
    try {
      const compressed = await compressImageFile(file);
      const { base64, type, name } = await fileToBase64(compressed);
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
        name: "NUEVO",
        tag: "POPULAR",
        tag_color: "purple",
        link: "/",
        active: true,
      },
    }));
  }

  const newDrafts = Object.entries(drafts).filter(([k]) => k.startsWith("new-"));

  async function seedDefaults() {
    if (!confirm(`Esto cargará ${DEFAULT_FEATURED.length} juegos destacados actuales del Home en la base de datos para que puedas editarlos. ¿Continuar?`)) return;
    setSeeding(true);
    try {
      for (let i = 0; i < DEFAULT_FEATURED.length; i++) {
        const g = DEFAULT_FEATURED[i];
        const name = filenameFromUrl(g.img, `featured-${i + 1}.jpg`);
        const up = await urlToUploadInput(g.img, name);
        const stored = await uploadFn({
          data: { filename: up.name, content_type: up.type, data_base64: up.base64 },
        });
        await upFn({
          data: {
            position: i,
            image_url: stored.path,
            name: g.name,
            tag: g.tag,
            tag_color: g.tag_color,
            link: g.to,
            active: true,
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-home-featured"] });
      qc.invalidateQueries({ queryKey: ["public-featured-games"] });
      toast.success("Juegos destacados cargados");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Panel
      title="Juegos Destacados"
      actions={
        <div className="flex items-center gap-2">
          {(q.data?.length ?? 0) === 0 && (
            <button
              onClick={seedDefaults}
              disabled={seeding}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-600/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-600/25 disabled:opacity-50"
            >
              {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Cargar actuales
            </button>
          )}
          <button
            onClick={addNew}
            className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/40 bg-fuchsia-600/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-600/30"
          >
            <Plus className="h-3 w-3" /> Nuevo
          </button>
        </div>
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
            <div className="rounded-md border border-purple-500/20 bg-[#0c0620]/60 p-3 text-center text-xs text-purple-200/80">
              No hay juegos destacados en la base de datos. El Home está usando los <span className="font-bold text-purple-100">{DEFAULT_FEATURED.length} juegos por defecto</span>.
              <br />
              Pulsa <span className="font-bold text-emerald-300">“Cargar actuales”</span> arriba para importarlos y poder editarlos o eliminarlos uno por uno.
            </div>
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
            label="Nombre (Enter = 2 líneas)"
            value={draft.name}
            onChange={(v) => onChange({ ...draft, name: v })}
            textarea
            placeholder={"SPACE\nMAN"}
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