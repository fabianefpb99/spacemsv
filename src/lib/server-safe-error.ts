/**
 * Server-side error sanitizer. Use to wrap PostgREST / Supabase RPC errors
 * before re-throwing to the client so we don't leak schema details, table
 * names, constraint names or other internal identifiers.
 *
 * Business-level errors raised explicitly from SQL (e.g. `insufficient_funds`,
 * `not_found`, `bj_session_closed`, snake_case codes ≤ 64 chars without
 * spaces) are forwarded as-is so the existing client UI mapping in
 * `friendly-error.ts` keeps working. Everything else collapses to a
 * generic message and is logged server-side with full detail.
 */
type SupabaseLikeError = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
} | null | undefined;

const SAFE_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

export function safeRpcError(
  error: SupabaseLikeError,
  fallback = "server_error",
): Error {
  const raw = (error?.message ?? "").trim();
  // Server-side audit log keeps full detail.
  console.error("[safeRpcError]", {
    message: raw,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
  // Forward explicit business codes (e.g. P0001 RAISE EXCEPTION with a
  // snake_case message) untouched so client mappers keep working.
  if (raw && SAFE_PATTERN.test(raw)) return new Error(raw);
  return new Error(fallback);
}