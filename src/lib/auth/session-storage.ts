import type { Session } from "@supabase/supabase-js";

type StoredSessionShape =
  | Session
  | { currentSession?: Session | null; session?: Session | null }
  | null;

export function getSupabaseStorageKey() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;

  try {
    const host = new URL(url).hostname;
    const projectRef = host.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

export function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;

  const key = getSupabaseStorageKey();
  if (!key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredSessionShape;
    if (!parsed || typeof parsed !== "object") return null;

    if ("access_token" in parsed) {
      return parsed as Session;
    }

    return parsed.currentSession ?? parsed.session ?? null;
  } catch {
    return null;
  }
}

export function readStoredAccessToken(): string | null {
  return readStoredSession()?.access_token ?? null;
}