import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Short-lived cache: Boost state changes rarely (admin driven). */
const BOOST_TTL_MS = 15_000;
const boostCache = new Map<string, { value: boolean; expires: number }>();

/**
 * Server-only: returns true if `userId` is currently the target of an active
 * Boost session and `game` is not in the excluded list. Read directly from the
 * `boost_sessions` table using the service-role client so RLS doesn't block it.
 *
 * Never expose this signal to the client — caller decides how to bias the
 * outcome silently.
 */
export async function isBoostTarget(
  userId: string,
  game: string,
): Promise<boolean> {
  const key = `${userId}:${game}`;
  const hit = boostCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (boostCache.size > 500) boostCache.clear();
  const { data, error } = await supabaseAdmin
    .from("boost_sessions")
    .select("excluded_games")
    .is("ended_at", null)
    .eq("target_user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    if (!error) boostCache.set(key, { value: false, expires: Date.now() + BOOST_TTL_MS });
    return false;
  }
  const excluded = (data.excluded_games as string[] | null) ?? [];
  const value = !excluded.includes(game);
  boostCache.set(key, { value, expires: Date.now() + BOOST_TTL_MS });
  return value;
}