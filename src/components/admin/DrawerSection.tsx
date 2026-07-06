import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Save, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  adminGetDrawerSettings,
  adminUpdateDrawerSettings,
  SOCIAL_PLATFORMS,
  type DrawerSettings,
} from "@/lib/admin/drawer-content.functions";
import { adminUploadHomeImage } from "@/lib/admin/home-content.functions";
import { compressImageFile } from "@/lib/admin/image-compress";
import { Panel } from "./shared";

async function fileToBase64(file: File) {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), type: file.type || "image/jpeg", name: file.name };
}

export function DrawerSection() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetDrawerSettings);
  const saveFn = useServerFn(adminUpdateDrawerSettings);
  const uploadFn = useServerFn(adminUploadHomeImage);

  const q = useQuery({ queryKey: ["admin-drawer"], queryFn: () => getFn() });

  const [draft, setDraft] = useState<DrawerSettings | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    if (q.data) {
      setDraft(q.data.settings);
      setImagePreview(q.data.image_preview ?? "");
    }
  }, [q.data]);

  const dirty = useMemo(() => {
    if (!q.data || !draft) return false;
    return JSON.stringify(q.data.settings) !== JSON.stringify(draft);
  }, [q.data, draft]);

  const saveMut = useMutation({
    mutationFn: (d: DrawerSettings) => saveFn({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-drawer"] });
      qc.invalidateQueries({ queryKey: ["public-drawer"] });
      toast.success("Cambios guardados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    if (!draft) return;
    try {
      const compressed = await compressImageFile(file);
      const { base64, type, name } = await fileToBase64(compressed);
      const res = await uploadFn({
        data: { filename: name, content_type: type, data_base64: base64 },
      });
      setDraft({ ...draft, promo: { ...draft.promo, image_url: res.path } });
      setImagePreview(res.signedUrl);
      toast.success("Imagen subida");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (q.isLoading || !draft) {
    return (
      <Panel title="Menú lateral">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
      </Panel>
    );
  }

  const promo = draft.promo;
  const socials = draft.socials;

  return (
    <div className="space-y-3">
      <Panel
        title="Publicidad del menú lateral"
        actions={
          <button
            onClick={() => saveMut.mutate(draft)}
            disabled={!dirty || saveMut.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-fuchsia-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_10px_rgba(217,70,239,0.5)] hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Guardar todo
          </button>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex w-full flex-col gap-2 sm:w-48">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-purple-500/30 bg-[#0c0620]">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
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
                  if (f) void handleUpload(f);
                }}
              />
            </label>
            <p className="text-[9px] leading-tight text-purple-200/60">
              Recomendado 800×500 px (16:10), JPG o WebP &lt; 200 KB.
            </p>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Field
              label="Etiqueta (eyebrow)"
              value={promo.eyebrow}
              onChange={(v) => setDraft({ ...draft, promo: { ...promo, eyebrow: v } })}
            />
            <Field
              label="Título"
              value={promo.title}
              onChange={(v) => setDraft({ ...draft, promo: { ...promo, title: v } })}
            />
            <Field
              label="Descripción"
              value={promo.subtitle}
              onChange={(v) => setDraft({ ...draft, promo: { ...promo, subtitle: v } })}
              full
              textarea
            />
            <Field
              label="Texto botón"
              value={promo.cta_label}
              onChange={(v) => setDraft({ ...draft, promo: { ...promo, cta_label: v } })}
            />
            <Field
              label="Link destino"
              value={promo.cta_link}
              onChange={(v) => setDraft({ ...draft, promo: { ...promo, cta_link: v } })}
              placeholder="/arena"
            />
            <label className="col-span-2 flex items-center gap-2 text-[11px] text-purple-200">
              <input
                type="checkbox"
                checked={promo.active}
                onChange={(e) => setDraft({ ...draft, promo: { ...promo, active: e.target.checked } })}
              />
              Visible en el menú lateral
            </label>
          </div>
        </div>
      </Panel>

      <Panel
        title="Redes sociales"
        actions={
          <button
            onClick={() => {
              const id = `s-${Date.now()}`;
              setDraft({
                ...draft,
                socials: [
                  ...socials,
                  {
                    id,
                    platform: "instagram",
                    url: "",
                    active: true,
                    position: socials.length,
                  },
                ],
              });
            }}
            className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/40 bg-fuchsia-600/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-600/30"
          >
            <Plus className="h-3 w-3" /> Añadir red
          </button>
        }
      >
        {socials.length === 0 ? (
          <div className="rounded-md border border-purple-500/20 bg-[#0c0620]/60 p-3 text-center text-xs text-purple-200/80">
            No hay redes sociales configuradas. Pulsa <b>Añadir red</b> para empezar.
          </div>
        ) : (
          <div className="space-y-2">
            {socials.map((s, idx) => (
              <div
                key={s.id}
                className="grid grid-cols-12 items-end gap-2 rounded-lg border border-purple-500/20 bg-[#150830]/60 p-2"
              >
                <label className="col-span-12 flex flex-col gap-1 sm:col-span-3">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-300/70">
                    Plataforma
                  </span>
                  <select
                    value={s.platform}
                    onChange={(e) => {
                      const next = [...socials];
                      next[idx] = { ...s, platform: e.target.value as (typeof SOCIAL_PLATFORMS)[number] };
                      setDraft({ ...draft, socials: next });
                    }}
                    className="rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
                  >
                    {SOCIAL_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-8 flex flex-col gap-1 sm:col-span-6">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-300/70">
                    URL
                  </span>
                  <input
                    value={s.url}
                    placeholder="https://"
                    onChange={(e) => {
                      const next = [...socials];
                      next[idx] = { ...s, url: e.target.value };
                      setDraft({ ...draft, socials: next });
                    }}
                    className="rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
                  />
                </label>
                <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-300/70">
                    Orden
                  </span>
                  <input
                    type="number"
                    value={s.position}
                    onChange={(e) => {
                      const next = [...socials];
                      next[idx] = { ...s, position: Number(e.target.value) || 0 };
                      setDraft({ ...draft, socials: next });
                    }}
                    className="rounded-md border border-purple-500/30 bg-[#0c0620] px-2 py-1.5 text-xs text-white focus:border-fuchsia-400/60 focus:outline-none"
                  />
                </label>
                <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-2">
                  <label className="flex items-center gap-1 text-[10px] text-purple-200">
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={(e) => {
                        const next = [...socials];
                        next[idx] = { ...s, active: e.target.checked };
                        setDraft({ ...draft, socials: next });
                      }}
                    />
                    Activa
                  </label>
                  <button
                    onClick={() => {
                      const next = socials.filter((_, i) => i !== idx);
                      setDraft({ ...draft, socials: next });
                    }}
                    aria-label="Eliminar"
                    className="rounded-md border border-rose-500/40 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
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