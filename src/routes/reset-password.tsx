import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Restablecer Contraseña | BETSPACE Casino Online" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase redirige con un hash (#access_token=...&type=recovery)
    // El cliente lo procesa automáticamente y dispara PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Si ya hay sesión (recuperación procesada antes de montar) marcamos listo.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("Mínimo 8 caracteres");
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
    navigate({ to: "/perfil" });
  }

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
        <div className="rounded-2xl border border-purple-500/30 bg-[#0c0620]/80 p-5 shadow-[0_0_24px_rgba(168,85,247,0.15)]">
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-5 w-5 text-fuchsia-300" />
            <h1 className="font-display text-lg font-bold uppercase tracking-widest">
              Nueva contraseña
            </h1>
          </div>
          {!ready ? (
            <p className="text-xs text-purple-200/70">
              Validando enlace de recuperación…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs text-purple-200/70">
                Elige una nueva contraseña para tu cuenta.
              </p>
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
                Guardar nueva contraseña
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}