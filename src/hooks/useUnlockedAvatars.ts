import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { AvatarKey } from "@/lib/avatars";

/**
 * Frontend-derived unlocked collectible avatars.
 * - "avatar-arena": granted after 10 wins in Arena (transactions: type='win', game='arena').
 *
 * Until a dedicated user_unlocks table exists this is a read-only derivation,
 * which keeps the UI honest without inventing schema.
 */
export function useUnlockedAvatars() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unlocked-avatars", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<{ unlocked: Set<AvatarKey>; arenaWins: number }> => {
      const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("type", "win")
        .eq("game", "arena");
      const arenaWins = count ?? 0;
      const unlocked = new Set<AvatarKey>();
      if (arenaWins >= 10) unlocked.add("avatar-arena");
      return { unlocked, arenaWins };
    },
  });
}
