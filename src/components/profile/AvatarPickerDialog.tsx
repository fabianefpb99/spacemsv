import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AVATAR_OPTIONS, type AvatarKey } from "@/lib/avatars";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | undefined;
  currentKey: AvatarKey | string | null | undefined;
};

export function AvatarPickerDialog({ open, onOpenChange, userId, currentKey }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AvatarKey | null>(
    (currentKey as AvatarKey) ?? null,
  );

  useEffect(() => {
    if (open) setSelected((currentKey as AvatarKey) ?? null);
  }, [open, currentKey]);

  const save = useMutation({
    mutationFn: async (key: AvatarKey) => {
      if (!userId) throw new Error("Sin sesión");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_key: key })
        .eq("id", userId);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-fuchsia-400/30 bg-[#0c0620] text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold uppercase tracking-wide text-fuchsia-200">
            Elige tu avatar
          </DialogTitle>
          <DialogDescription className="text-xs text-purple-200/70">
            Selecciona una imagen y guarda los cambios.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-3">
          {AVATAR_OPTIONS.map((opt) => {
            const isSelected = selected === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelected(opt.key)}
                aria-label={opt.label}
                aria-pressed={isSelected}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                  isSelected
                    ? "border-fuchsia-400 ring-2 ring-fuchsia-400/60"
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
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500 text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex justify-end gap-2">
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
      </DialogContent>
    </Dialog>
  );
}