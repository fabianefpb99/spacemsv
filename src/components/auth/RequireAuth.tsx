import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "./AuthDialog";
import { Lock } from "lucide-react";

/**
 * Gate that requires the user to be signed in before showing children.
 * While auth state is hydrating we render nothing (avoids flashing a
 * "signed out" wall to logged-in users on slow networks).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated || loading) {
    return <div className="min-h-screen bg-[#060210]" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#060210] text-white">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10">
            <Lock className="h-7 w-7 text-fuchsia-300" />
          </div>
          <div>
            <h1 className="font-display text-lg font-black uppercase tracking-wider">
              Inicia sesión para jugar
            </h1>
            <p className="mt-2 text-sm text-purple-200/70">
              Necesitas una cuenta para apostar y cobrar tus ganancias.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <button
              onClick={() => setOpen(true)}
              className="w-full rounded-md bg-purple-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-purple-500"
            >
              Iniciar sesión / Registrarse
            </button>
            <Link
              to="/home"
              className="w-full rounded-md border border-purple-500/40 px-4 py-3 text-xs font-bold uppercase tracking-wider text-purple-200 hover:bg-white/5"
            >
              Volver al inicio
            </Link>
          </div>
          <AuthDialog open={open} onOpenChange={setOpen} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}