import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AVATAR_OPTIONS, type AvatarKey } from "@/lib/avatars";
import { useUnlockedAvatars } from "@/hooks/useUnlockedAvatars";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | undefined;
  currentKey: AvatarKey | string | null | undefined;
};

export function AvatarPickerDialog({ open, onOpenChange, userId, currentKey }: Props) {
  const qc = useQueryClient();
  const unlockedQ = useUnlockedAvatars();
  const [selected, setSelected] = useState<string | null>(
    (currentKey as string) ?? null,
  );

  useEffect(() => {
    if (open) setSelected((currentKey as string) ?? null);
  }, [open, currentKey]);

  // Lock scroll + ESC to close while open (mirrors AuthDialog pattern so the
  // page doesn't shift sideways when the scrollbar gutter disappears).
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    const prevTouch = body.style.touchAction;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.touchAction = "none";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
      body.style.touchAction = prevTouch;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const save = useMutation({
    mutationFn: async (key: string) => {
      if (!userId) throw new Error("Sin sesión");
      const { error } = await supabase.rpc("set_my_avatar_key", {
        _avatar_key: key,
      });
      if (error) throw error;
      return key;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Foto de perfil actualizada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar"),
  });

  if (!open || typeof document === "undefined") return null;

  // Combine legacy avatar options with unlocked-aware mission avatars so the
  // user can equip rewards earned from missions directly from the picker.
  type PickerItem = {
    key: string;
    url: string;
    label: string;
    locked: boolean;
    unlockHint?: string;
  };
  const missionItems: PickerItem[] = (unlockedQ.data?.items ?? [])
    .filter((i) => !!i.avatarKey)
    .map((i) => ({
      key: i.avatarKey as string,
      url: i.imageUrl,
      label: i.label,
      locked: !i.unlocked,
      unlockHint: i.unlockHint,
    }));
  // Legacy collectibles are superseded by mission rewards; hide them from
  // the picker so the only "locked" entries shown come from active missions.
  const legacyItems: PickerItem[] = AVATAR_OPTIONS.filter(
    (opt) => !opt.collectible,
  ).map((opt) => ({
    key: opt.key,
    url: opt.url,
    label: opt.label,
    locked: false,
    unlockHint: opt.unlockHint,
  }));
  const allItems: PickerItem[] = [...legacyItems, ...missionItems];

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Elige tu avatar"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6">
        <div className="relative box-border w-full max-w-md overflow-x-hidden overflow-y-auto rounded-2xl border border-fuchsia-400/30 bg-[#0c0620] p-4 text-white shadow-2xl sm:p-6 max-h-[calc(100dvh-2rem)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 text-purple-200/80 transition-colors hover:text-white"
          >
            ×
          </button>

          <div className="flex flex-col space-y-1 pr-8">
            <h2 className="text-base font-bold uppercase tracking-wide text-fuchsia-200">
              Elige tu avatar
            </h2>
            <p className="text-xs text-purple-200/70">
              Selecciona una imagen y guarda los cambios.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3">
          {allItems.map((opt) => {
            const isSelected = selected === opt.key;
            const isLocked = opt.locked;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (isLocked) {
                    toast.info(opt.unlockHint ?? "Aún no has desbloqueado este avatar");
                    return;
                  }
                  setSelected(opt.key);
                }}
                aria-label={isLocked ? `${opt.label} (bloqueado)` : opt.label}
                aria-pressed={isSelected}
                title={isLocked ? opt.unlockHint : opt.label}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                  isSelected
                    ? "border-fuchsia-400 ring-2 ring-fuchsia-400/60"
                    : isLocked
                      ? "border-white/10 opacity-60"
                      : "border-white/10 hover:border-fuchsia-400/50",
                )}
                style={
                  isSelected
                    ? { boxShadow: "0 0 14px rgba(217,70,239,0.55)" }
                    : undefined
                }
              >
                <img
                  src={opt.url}
                  alt={opt.label}
                  className={cn(
                    "h-full w-full object-cover",
                    isLocked && "grayscale",
                  )}
                  loading="lazy"
                />
                {isLocked && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Lock className="h-4 w-4 text-white/90" />
                  </span>
                )}
                {isSelected && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500 text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
          </div>

          <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-purple-200 hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => selected && save.mutate(selected)}
            disabled={!selected || save.isPending || selected === currentKey}
            className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white hover:opacity-90"
          >
            {save.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando
              </>
            ) : (
              "Guardar"
            )}
          </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}