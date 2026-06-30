import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  const { data, error } = await supabaseAdmin
    .from("boost_sessions")
    .select("excluded_games")
    .is("ended_at", null)
    .eq("target_user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return false;
  const excluded = (data.excluded_games as string[] | null) ?? [];
  return !excluded.includes(game);
}