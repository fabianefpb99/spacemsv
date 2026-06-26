/**
 * Server-side helper that resolves `mission:<id>` and `vip:<id>` avatar keys
 * to their image URL using the admin client (bypasses RLS). Used by public
 * ranking and recent-wins server functions so the client never has to wait
 * for a separate query to populate the avatar cache.
 */
export async function resolveAvatarUrls(
  keys: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const missionIds = new Set<string>();
  const vipIds = new Set<string>();
  for (const k of keys) {
    if (!k) continue;
    if (k.startsWith("mission:")) missionIds.add(k.slice("mission:".length));
    else if (k.startsWith("vip:")) vipIds.add(k.slice("vip:".length));
  }
  if (missionIds.size === 0 && vipIds.size === 0) return result;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tasks: Promise<unknown>[] = [];
  if (missionIds.size > 0) {
    tasks.push(
      supabaseAdmin
        .from("missions")
        .select("id, reward_image_url")
        .in("id", Array.from(missionIds))
        .then(({ data }) => {
          for (const r of data ?? []) {
            if (r.reward_image_url) {
              result.set(`mission:${r.id}`, r.reward_image_url as string);
            }
          }
        }),
    );
  }
  if (vipIds.size > 0) {
    tasks.push(
      supabaseAdmin
        .from("user_vip_rewards")
        .select("id, reward_image_url")
        .in("id", Array.from(vipIds))
        .then(({ data }) => {
          for (const r of (data ?? []) as Array<{
            id: string;
            reward_image_url: string | null;
          }>) {
            if (r.reward_image_url) {
              result.set(`vip:${r.id}`, r.reward_image_url);
            }
          }
        }),
    );
  }
  await Promise.all(tasks);
  return result;
}