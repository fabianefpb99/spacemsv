import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (pwd !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) {
      toast.error(error.message || "No se pudo actualizar");
      return;
    }
    toast.success("Contraseña actualizada");
    setPwd("");
    setConfirm("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-purple-500/30 bg-[#0c0620] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-fuchsia-300" />
            Cambiar contraseña
          </DialogTitle>
          <DialogDescription className="text-xs text-purple-200/70">
            Mínimo 8 caracteres. No la compartas con nadie.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
              Nueva contraseña
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-md border border-purple-500/30 bg-[#150830]/60 px-2">
              <input
                type={show ? "text" : "password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-purple-300/40"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              <button type="button" onClick={() => setShow((v) => !v)} className="text-purple-200/70">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
              Confirmar contraseña
            </label>
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border border-purple-500/30 bg-[#150830]/60 px-2 py-2 text-sm outline-none placeholder:text-purple-300/40"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-fuchsia-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Actualizar contraseña
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}