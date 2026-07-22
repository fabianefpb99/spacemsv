import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2, Mail, User as UserIcon, Lock, Ticket, Eye, EyeOff, X, Rocket, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { requestPostSignupPersonalDataPrompt } from "@/lib/auth/post-signup-personal-data";

type Mode = "signin" | "signup";

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
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(<AuthDialogContent onOpenChange={onOpenChange} />, document.body);
}

function AuthDialogContent({ onOpenChange }: { onOpenChange: (v: boolean) => void }) {
  const [mode, setMode] = useState<Mode>("signin");

  const headline =
    mode === "signin" ? "Tu misión te espera" : "Empieza a ganar hoy";
  const sub =
    mode === "signin"
      ? "Entra y sigue ganando desde donde lo dejaste."
      : "Crea tu cuenta en 30 segundos y activa tu bono de bienvenida.";

  return (
    <div
      className="auth-scope fixed inset-0 z-[120] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Acceso a BETSPACE"
    >
      <div
        className="auth-backdrop absolute inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div
        className="auth-modal-scroll relative flex min-h-dvh w-full items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6"
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="auth-panel relative box-border w-full max-w-[420px] rounded-[22px] p-5 sm:p-7 animate-scale-in">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="auth-close absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center auth-header-block">
            <div className="flex flex-col items-center">
              <span className="auth-welcome text-[11px] font-semibold tracking-[0.18em]">
                BIENVENIDO a
              </span>
              <div className="auth-wordmark font-display text-[26px] font-black tracking-[0.18em] leading-none">
                BET<span className="auth-wordmark-accent">SPACE</span>
              </div>
            </div>
            <h2 className="auth-headline mt-3 font-display text-[21px] font-extrabold leading-tight sm:mt-4 sm:text-2xl">
              {headline}
            </h2>
            <p className="auth-sub mt-1.5 text-[13px] leading-snug">{sub}</p>
          </div>

          {/* Tabs */}
          <div className="auth-tabs mt-4 grid grid-cols-2 gap-1 rounded-full p-1 sm:mt-5">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`auth-tab ${mode === "signin" ? "is-active" : ""}`}
              aria-pressed={mode === "signin"}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`auth-tab ${mode === "signup" ? "is-active" : ""}`}
              aria-pressed={mode === "signup"}
            >
              Registrarse
            </button>
          </div>

          <div className="mt-3 sm:mt-4">
            {mode === "signin" ? (
              <SignInForm onSuccess={() => onOpenChange(false)} onSwitch={() => setMode("signup")} />
            ) : (
              <SignUpForm onSuccess={() => onOpenChange(false)} onSwitch={() => setMode("signin")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Field primitive ------------------------------ */

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
  placeholder,
  maxLength,
  icon,
  optional,
  rightSlot,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  icon: React.ReactNode;
  optional?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="auth-label flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
        {label}
        {optional && <span className="auth-label-optional text-[10px] font-normal normal-case tracking-normal">(opcional)</span>}
      </label>
      <div className="auth-input-wrap relative">
        <span className="auth-input-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          maxLength={maxLength}
          className="auth-input w-full rounded-xl pl-10 pr-11 py-3 text-sm outline-none"
        />
        {rightSlot && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</div>}
      </div>
    </div>
  );
}

function PasswordField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field
      id={props.id}
      label={props.label}
      type={show ? "text" : "password"}
      value={props.value}
      onChange={props.onChange}
      autoComplete={props.autoComplete}
      required
      icon={<Lock className="h-4 w-4" />}
      rightSlot={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="auth-eye grid h-8 w-8 place-items-center rounded-lg"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

/* --------------------------------- Sign in --------------------------------- */

function SignInForm({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const { refreshSession, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return setError(
        error.message === "Invalid login credentials" ? "Email o contraseña incorrectos." : error.message,
      );
    }
    const session = await refreshSession();
    setLoading(false);
    if (!session?.user && !user) {
      return setError("La sesión tardó en establecerse. Intenta una vez más.");
    }
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        id="signin-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
        icon={<Mail className="h-4 w-4" />}
        placeholder="tu@email.com"
      />
      <PasswordField
        id="signin-password"
        label="Contraseña"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      {error && <p className="auth-error text-xs">{error}</p>}
      <button type="submit" disabled={loading} className="auth-cta mt-1 flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold tracking-wide">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <Rocket className="mr-2 h-4 w-4" />
            Entrar a jugar
          </>
        )}
      </button>
      <p className="auth-switch pt-1 text-center text-[13px]">
        ¿No tienes cuenta?{" "}
        <button type="button" onClick={onSwitch} className="auth-switch-link font-bold underline-offset-2 hover:underline">
          Regístrate gratis
        </button>
      </p>
      <p className="auth-legal text-center text-[10px]">
        Al continuar aceptas los <a href="/terminos" className="underline underline-offset-2">Términos y Condiciones</a>.
      </p>
    </form>
  );
}

/* --------------------------------- Sign up --------------------------------- */

function SignUpForm({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
    if (!parsed.success) return setError(parsed.error.issues[0].message);
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
    if (error) return setError(error.message);
    if (data.session) {
      const session = await refreshSession();
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
      const signedUpUserId = data.user?.id ?? session?.user?.id;
      await navigate({ to: "/", replace: true });
      onSuccess();
      if (signedUpUserId) {
        window.setTimeout(() => requestPostSignupPersonalDataPrompt(signedUpUserId), 0);
      }
    } else {
      setInfo("Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        id="signup-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
        icon={<Mail className="h-4 w-4" />}
        placeholder="tu@email.com"
      />
      <Field
        id="signup-username"
        label="Usuario"
        value={username}
        onChange={setUsername}
        autoComplete="username"
        required
        icon={<UserIcon className="h-4 w-4" />}
        placeholder="capitán_nova"
      />
      <PasswordField
        id="signup-password"
        label="Contraseña"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />
      <Field
        id="signup-referral"
        label="Código de referido"
        value={referralCode}
        onChange={(v) => setReferralCode(v.toUpperCase())}
        icon={<Ticket className="h-4 w-4" />}
        placeholder="Ej: AB23CDEF"
        maxLength={12}
        optional
      />
      {error && <p className="auth-error text-xs">{error}</p>}
      {info && <p className="auth-info text-xs">{info}</p>}
      <button type="submit" disabled={loading} className="auth-cta mt-1 flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold tracking-wide">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Crear cuenta y ganar
          </>
        )}
      </button>
      <p className="auth-switch pt-1 text-center text-[13px]">
        ¿Ya juegas con nosotros?{" "}
        <button type="button" onClick={onSwitch} className="auth-switch-link font-bold underline-offset-2 hover:underline">
          Inicia sesión
        </button>
      </p>
      <p className="auth-legal text-center text-[10px]">
        Al continuar aceptas los <a href="/terminos" className="underline underline-offset-2">Términos y Condiciones</a>.
      </p>
    </form>
  );
}
