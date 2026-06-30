import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAvatarUrls } from "@/lib/avatars.server";

/**
 * Real active users = distinct user_ids that produced a transaction in the
 * last 10 minutes. Cheap proxy for "currently playing".
 */
const ACTIVE_WINDOW_MIN = 10;

export type ActiveUser = {
  user_id: string;
  username: string | null;
  avatar_key: string | null;
  avatar_url?: string | null;
  last_activity: string;
  last_game: string | null;
};

export const getActiveUsersCount = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ count: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - ACTIVE_WINDOW_MIN * 60_000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("user_id")
      .gte("created_at", since)
      .limit(5000);
    if (error || !data) return { count: 0 };
    const set = new Set<string>();
    for (const r of data as Array<{ user_id: string | null }>) {
      if (r.user_id) set.add(r.user_id);
    }
    return { count: set.size };
  },
);

export const getActiveUsersList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActiveUser[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Authorize: admin only
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("not_admin");

    const since = new Date(Date.now() - ACTIVE_WINDOW_MIN * 60_000).toISOString();
    const { data: txs } = await supabaseAdmin
      .from("transactions")
      .select("user_id, game, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    const perUser = new Map<string, { last: string; game: string | null }>();
    for (const r of (txs ?? []) as Array<{ user_id: string | null; game: string | null; created_at: string }>) {
      if (!r.user_id) continue;
      if (!perUser.has(r.user_id)) {
        perUser.set(r.user_id, { last: r.created_at, game: r.game });
      }
    }
    const ids = Array.from(perUser.keys());
    if (ids.length === 0) return [];

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, username, email, avatar_key")
      .in("id", ids);
    const profMap = new Map<string, { username: string | null; email: string | null; avatar_key: string | null }>();
    for (const p of profs ?? []) {
      profMap.set(p.id, { username: p.username ?? null, email: p.email ?? null, avatar_key: (p as { avatar_key?: string | null }).avatar_key ?? null });
    }

    const urlMap = await resolveAvatarUrls(ids.map((id) => profMap.get(id)?.avatar_key ?? null));

    return ids
      .map((id) => {
        const info = perUser.get(id)!;
        const p = profMap.get(id);
        const key = p?.avatar_key ?? null;
        return {
          user_id: id,
          username: p?.username ?? (p?.email ? p.email.split("@")[0] : null),
          avatar_key: key,
          avatar_url: key ? urlMap.get(key) ?? null : null,
          last_activity: info.last,
          last_game: info.game,
        };
      })
      .sort((a, b) => (a.last_activity < b.last_activity ? 1 : -1));
  });