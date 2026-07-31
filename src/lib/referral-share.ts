const STORAGE_KEY = "betspace_ref_code";

/** Normaliza un código de referido (mayúsculas, solo alfanumérico, máx 12). */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

/** Captura ?ref=CODE de la URL y lo guarda para usarlo al registrarse. */
export function captureReferralFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const code = normalizeReferralCode(url.searchParams.get("ref"));
    if (!code) return;
    window.localStorage.setItem(STORAGE_KEY, code);
    url.searchParams.delete("ref");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {
    /* noop */
  }
}

export function getStoredReferralCode(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeReferralCode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "";
  }
}

export function clearStoredReferralCode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

const SITE_URL = "https://betspace.app";

function siteOrigin(): string {
  if (typeof window === "undefined") return SITE_URL;
  const { origin } = window.location;
  // En preview/localhost usamos el dominio público para que el enlace sirva.
  if (/localhost|127\.0\.0\.1|lovable\.app/.test(origin)) return SITE_URL;
  return origin;
}

/** Link a compartir: con ?ref= si hay código, plano si no hay sesión. */
export function buildInviteUrl(code?: string | null): string {
  const clean = normalizeReferralCode(code);
  return clean ? `${siteOrigin()}/?ref=${clean}` : siteOrigin();
}

export function buildInviteMessage(code?: string | null): string {
  const url = buildInviteUrl(code);
  return normalizeReferralCode(code)
    ? `🚀 Juega conmigo en BetSpace y recibe $2.000 de bono al registrarte con mi enlace:\n${url}`
    : `🚀 Juega en BetSpace, el casino espacial: tragamonedas, crash, ruleta y más.\n${url}`;
}

/**
 * Comparte el enlace de invitación. Usa el share nativo cuando existe
 * (WhatsApp, Telegram, etc.) y cae a WhatsApp Web / portapapeles.
 */
export async function shareInvite(code?: string | null): Promise<"shared" | "whatsapp" | "copied"> {
  const message = buildInviteMessage(code);
  const url = buildInviteUrl(code);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "BetSpace", text: message, url });
      return "shared";
    } catch (err) {
      // El usuario canceló: no abrimos WhatsApp encima.
      if ((err as DOMException)?.name === "AbortError") return "shared";
    }
  }

  if (typeof window !== "undefined") {
    const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const opened = window.open(wa, "_blank", "noopener,noreferrer");
    if (opened) return "whatsapp";
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      /* noop */
    }
  }
  return "copied";
}
