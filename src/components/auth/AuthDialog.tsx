import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PersonalDataForm } from "@/components/profile/PersonalDataForm";

const signUpSchema = z.object({
  email: z.string().email("Email inválido"),
  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo"),
  password: z
    .string()
    .min(1, "Requerido")
    .regex(/[A-Za-z]/, "Debe incluir al menos una letra")
    .regex(/[0-9]/, "Debe incluir al menos un número"),
});

const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Requerido"),
});

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyTouchAction = body.style.touchAction;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.touchAction = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.touchAction = previousBodyTouchAction;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-hidden" role="dialog" aria-modal="true" aria-label="Inicio de sesión">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6">
        <div className="relative box-border w-full max-w-md overflow-x-hidden overflow-y-auto rounded-lg border border-purple-500/40 bg-[#0c0620] p-4 text-white shadow-2xl sm:p-6 max-h-[calc(100dvh-2rem)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar inicio de sesión"
            className="absolute right-4 top-4 text-purple-200/80 transition-colors hover:text-white"
          >
            ×
          </button>

          <div className="flex flex-col space-y-1.5 pr-8 text-center sm:text-left">
            <h2 className="font-display text-2xl font-black tracking-wide text-white">BIENVENIDO</h2>
            <p className="text-sm text-purple-200/70">
              Inicia sesión o crea tu cuenta para guardar tu progreso y balance.
            </p>
          </div>

          <Tabs defaultValue="signin" className="mt-4 w-full">
            <TabsList className="grid w-full grid-cols-2 bg-purple-950/40">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <SignInForm onSuccess={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm onSuccess={() => onOpenChange(false)} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GoogleButton() {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(false);
    void navigate({ to: "/perfil" });
  }, [navigate, user]);

  async function onClick() {
    setError(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.redirected) {
      return;
    }
    if (result.error) {
      setLoading(false);
      setError(result.error.message ?? "No se pudo iniciar sesión con Google.");
      return;
    }

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      const recovered = await refreshSession();
      if (!recovered?.user) {
        setLoading(false);
        setError("Google autenticó la cuenta, pero la sesión no quedó activa. Intenta de nuevo.");
        return;
      }
    }

    setLoading(false);
    void navigate({ to: "/perfil" });
  }
  return (
    <div className="space-y-2 pt-3">
      <div className="relative my-1 flex items-center">
        <div className="h-px flex-1 bg-purple-500/20" />
        <span className="px-2 text-[10px] uppercase tracking-widest text-purple-200/60">o</span>
        <div className="h-px flex-1 bg-purple-500/20" />
      </div>
      <Button
        type="button"
        onClick={onClick}
        disabled={loading}
        variant="outline"
        className="w-full border-purple-500/40 bg-transparent text-white hover:bg-purple-500/10"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.9-.1-1.3H12z"/>
            </svg>
            Continuar con Google
          </>
        )}
      </Button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(
        error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : error.message,
      );
      return;
    }
    const session = await refreshSession();
    setLoading(false);
    if (!session?.user) {
      setError("La cuenta sí inició, pero el teléfono tardó en recuperar la sesión. Intenta una vez más.");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 pt-3">
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">Contraseña</Label>
        <Input id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar sesión"}
      </Button>
    </form>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = signUpSchema.safeParse({ email, username, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { username },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      await refreshSession();
      onSuccess();
    } else {
      setInfo("Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 pt-3">
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-username">Usuario</Label>
        <Input id="signup-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Contraseña</Label>
        <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {info && <p className="text-xs text-emerald-300">{info}</p>}
      <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}
      </Button>
    </form>
  );
}