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
  email: z.string().trim().email("Email inválido"),
  username: z
    .string()
    .trim()
    .min(3, "Usuario: mínimo 3 caracteres")
    .max(20, "Usuario: máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Usuario: solo letras, números, punto, guion y guion bajo")
    .refine((v) => (v.match(/[0-9]/g) ?? []).length <= 4, "Usuario: máximo 4 números"),
  password: z
    .string()
    .min(6, "Contraseña: mínimo 6 caracteres")
    .regex(/[A-Za-z]/, "Contraseña: debe incluir al menos una letra")
    .regex(/[0-9]/, "Contraseña: debe incluir al menos un número"),
  referralCode: z
    .string()
    .trim()
    .max(12, "Código de referido demasiado largo")
    .regex(/^[A-Za-z0-9]*$/, "Código inválido")
    .optional()
    .or(z.literal("")),
});

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido"),
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
    <AuthDialogContent onOpenChange={onOpenChange} />,
    document.body,
  );
}

function AuthDialogContent({ onOpenChange }: { onOpenChange: (v: boolean) => void }) {
  return (
    <div className="fixed inset-0 z-[120] overflow-hidden" role="dialog" aria-modal="true" aria-label="Inicio de sesión">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 pb-[12vh] sm:pb-[10vh]">
        <div className="auth-dialog-panel relative box-border w-full max-w-md overflow-x-hidden overflow-y-auto rounded-lg border p-4 sm:p-6 max-h-[calc(100dvh-2rem)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar inicio de sesión"
            className="auth-dialog-close absolute right-4 top-4 transition-colors"
          >
            ×
          </button>

          <div className="flex flex-col space-y-1.5 pr-8 text-center sm:text-left">
            <h2 className="auth-dialog-title font-display text-2xl font-black tracking-wide">BIENVENIDO</h2>
            <p className="auth-dialog-subtitle text-sm">
              Inicia sesión o crea tu cuenta para guardar tu progreso y balance.
            </p>
          </div>

          <Tabs defaultValue="signin" className="mt-4 w-full">
            <TabsList className="auth-dialog-tabs grid w-full grid-cols-2">
              <TabsTrigger className="auth-dialog-tab" value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger className="auth-dialog-tab" value="signup">Registrarse</TabsTrigger>
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
    </div>
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
        <div className="auth-dialog-separator h-px flex-1" />
        <span className="auth-dialog-muted px-2 text-[10px] uppercase tracking-widest">o</span>
        <div className="auth-dialog-separator h-px flex-1" />
      </div>
      <Button
        type="button"
        onClick={onClick}
        disabled={loading}
        variant="outline"
        className="auth-dialog-google w-full"
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
      {error && <p className="auth-dialog-error text-xs">{error}</p>}
    </div>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { refreshSession, user } = useAuth();
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
    if (!session?.user && !user) {
      setError("La cuenta sí inició, pero el teléfono tardó en recuperar la sesión. Intenta una vez más.");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 pt-3">
      <div className="space-y-1.5">
        <Label className="auth-dialog-label" htmlFor="signin-email">Email</Label>
        <Input className="auth-dialog-input" id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label className="auth-dialog-label" htmlFor="signin-password">Contraseña</Label>
        <Input className="auth-dialog-input" id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {error && <p className="auth-dialog-error text-xs">{error}</p>}
      <Button type="submit" disabled={loading} className="auth-dialog-submit w-full">
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
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [userId, setUserId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    const cleanReferral = referralCode.trim().toUpperCase();
    const parsed = signUpSchema.safeParse({
      email: cleanEmail,
      username: cleanUsername,
      password,
      referralCode: cleanReferral,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { username: cleanUsername },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      await refreshSession();
      if (cleanReferral) {
        const { error: refError } = await supabase.rpc("redeem_referral", { p_code: cleanReferral });
        if (refError) {
          const msg = refError.message ?? "";
          let friendly = "El código de referido no se pudo aplicar.";
          if (msg.includes("invalid_code")) friendly = "El código de referido no existe.";
          else if (msg.includes("self_referral")) friendly = "No puedes usar tu propio código.";
          else if (msg.includes("already_referred")) friendly = "Ya usaste un código de referido.";
          setInfo(`Cuenta creada, pero ${friendly}`);
        } else {
          setInfo("¡Código aplicado! Recibiste $2.000 de saldo bonus.");
        }
      }
      if (data.user) {
        setUserId(data.user.id);
        setStep(2);
      } else {
        onSuccess();
      }
    } else {
      setInfo("Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión.");
    }
  }

  if (step === 2 && userId) {
    return (
      <div className="space-y-3 pt-3">
        <div className="auth-dialog-success rounded-md border px-3 py-2 text-xs">
          Cuenta creada. Completa tus datos personales para finalizar el registro.
        </div>
        <PersonalDataForm
          userId={userId}
          onSaved={onSuccess}
          submitLabel="Finalizar registro"
        />
        <button
          type="button"
          onClick={onSuccess}
          className="auth-dialog-skip w-full text-center text-[11px]"
        >
          Completar después
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 pt-3">
      <div className="space-y-1.5">
        <Label className="auth-dialog-label" htmlFor="signup-email">Email</Label>
        <Input className="auth-dialog-input" id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label className="auth-dialog-label" htmlFor="signup-username">Usuario</Label>
        <Input className="auth-dialog-input" id="signup-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </div>
      <div className="space-y-1.5">
        <Label className="auth-dialog-label" htmlFor="signup-password">Contraseña</Label>
        <Input className="auth-dialog-input" id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </div>
      <div className="space-y-1.5">
        <Label className="auth-dialog-label" htmlFor="signup-referral">Código de referido <span className="auth-dialog-muted">(opcional)</span></Label>
        <Input
          className="auth-dialog-input"
          id="signup-referral"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder="Ej: AB23CDEF"
          maxLength={12}
          autoComplete="off"
        />
      </div>
      {error && <p className="auth-dialog-error text-xs">{error}</p>}
      {info && <p className="auth-dialog-info text-xs">{info}</p>}
      <Button type="submit" disabled={loading} className="auth-dialog-submit w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}
      </Button>
    </form>
  );
}