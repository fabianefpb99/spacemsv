import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const { authorization_id: authorizationId } = Route.useSearch();
  const [session, setSession] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !authorizationId) return;
    let active = true;
    oauth()
      .getAuthorizationDetails(authorizationId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) return setError(error.message ?? "No se pudo cargar la solicitud.");
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      });
    return () => {
      active = false;
    };
  }, [session, authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauth();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message ?? "No se pudo completar la autorización.");
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("El servidor de autorización no devolvió una URL de retorno.");
      return;
    }
    window.location.href = target;
  }

  if (!authorizationId) {
    return <Shell><p className="text-sm text-purple-200/80">Solicitud de autorización inválida.</p></Shell>;
  }

  if (!ready) return <Shell><p className="text-sm text-purple-200/70">Cargando…</p></Shell>;

  if (!session) return <Shell><SignInForm /></Shell>;

  return (
    <Shell>
      <h1 className="font-display text-lg font-black uppercase tracking-wider">
        Conectar {details?.client?.name ?? "una aplicación"} a BetSpace
      </h1>
      <p className="mt-2 text-sm text-purple-200/75">
        Esto permite que {details?.client?.name ?? "la aplicación"} use BetSpace como tú.
      </p>
      {details?.redirect_uri && (
        <p className="mt-1 break-all text-xs text-purple-200/50">{details.redirect_uri}</p>
      )}
      <p className="mt-3 text-xs text-purple-200/50">
        Esto no evita los permisos ni las políticas de seguridad de BetSpace.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 flex flex-col gap-2">
        <button
          disabled={busy || !details}
          onClick={() => decide(true)}
          className="w-full rounded-md bg-purple-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-purple-500 disabled:opacity-50"
        >
          Aprobar
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="w-full rounded-md border border-purple-500/40 px-4 py-3 text-xs font-bold uppercase tracking-wider text-purple-200 hover:bg-white/5 disabled:opacity-50"
        >
          Cancelar conexión
        </button>
      </div>
    </Shell>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-left">
      <h1 className="font-display text-lg font-black uppercase tracking-wider">
        Inicia sesión para continuar
      </h1>
      <p className="text-sm text-purple-200/70">
        Necesitas tu cuenta de BetSpace para autorizar esta conexión.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="email"
        className="w-full rounded-md border border-purple-500/30 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-purple-200/40"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        autoComplete="current-password"
        className="w-full rounded-md border border-purple-500/30 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-purple-200/40"
      />
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-purple-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-purple-500 disabled:opacity-50"
      >
        Iniciar sesión
      </button>
    </form>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <div className="rounded-xl border border-purple-500/25 bg-white/[0.03] p-6">{children}</div>
      </div>
    </main>
  );
}