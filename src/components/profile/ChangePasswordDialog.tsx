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
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current) {
      toast.error("Ingresa tu contraseña actual");
      return;
    }
    if (pwd.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (pwd === current) {
      toast.error("La nueva contraseña debe ser distinta a la actual");
      return;
    }
    if (pwd !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    // Re-autenticar con la contraseña actual
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) {
      setBusy(false);
      toast.error("No se pudo verificar tu sesión");
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInError) {
      setBusy(false);
      toast.error("La contraseña actual es incorrecta");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) {
      toast.error(error.message || "No se pudo actualizar");
      return;
    }
    toast.success("Contraseña actualizada");
    setCurrent("");
    setPwd("");
    setConfirm("");
    onOpenChange(false);
  }

  async function handleForgot() {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) {
      toast.error("No se pudo identificar tu correo");
      return;
    }
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error(error.message || "No se pudo enviar el correo");
      return;
    }
    toast.success(`Te enviamos un enlace a ${email}`);
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
            Confirma tu contraseña actual y elige una nueva (mínimo 8 caracteres).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
              Contraseña actual
            </label>
            <input
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="mt-1 w-full rounded-md border border-purple-500/30 bg-[#150830]/60 px-2 py-2 text-sm outline-none placeholder:text-purple-300/40"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
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
          <button
            type="button"
            onClick={handleForgot}
            disabled={sendingReset}
            className="flex w-full items-center justify-center gap-2 text-[11px] font-semibold text-fuchsia-300 hover:text-fuchsia-200 disabled:opacity-60"
          >
            {sendingReset ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            ¿Olvidaste tu contraseña? Recuperar por correo
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}