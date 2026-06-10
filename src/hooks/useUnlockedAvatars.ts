import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { AvatarKey } from "@/lib/avatars";
import { COLLECTIBLE_AVATARS } from "@/lib/avatars";

export type CollectibleItem = {
  /** Stable id: avatar key for legacy items, `mission:<id>` for mission rewards. */
  id: string;
  imageUrl: string;
  label: string;
  unlocked: boolean;
  unlockHint?: string;
  /** Present only for legacy items that can be equipped via AvatarPickerDialog. */
  avatarKey?: AvatarKey;
  /** Only set for mission rewards (used to keep equipped state consistent). */
  missionId?: string;
};

/**
 * Returns the full collectible list shown in /perfil → Colección.
 *
 * Sources combined:
 *  - Legacy hard-coded `COLLECTIBLE_AVATARS` (currently `avatar-arena`,
 *    derived from Arena wins in `transactions`).
 *  - Dynamic mission rewards (`missions.reward_kind = 'avatar'`), unlocked
 *    when the user has a row in `user_avatar_unlocks` for that mission.
 *
 * Subscribes to realtime inserts on `user_avatar_unlocks` so the UI flips
 * from locked → unlocked the moment the trigger awards the reward.
 */
export function useUnlockedAvatars() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["unlocked-avatars", user?.id ?? null] as const;

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`avatar-unlocks-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_avatar_unlocks",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return useQuery({
    queryKey: ["unlocked-avatars", user?.id ?? null],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<{
      items: CollectibleItem[];
      unlocked: Set<AvatarKey>;
      unlockedCount: number;
      totalCount: number;
      arenaWins: number;
    }> => {
      // 1. Legacy: arena wins → avatar-arena
      const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("type", "win")
        .eq("game", "arena");
      const arenaWins = count ?? 0;
      const unlocked = new Set<AvatarKey>();
      if (arenaWins >= 10) unlocked.add("avatar-arena");

      const legacyItems: CollectibleItem[] = COLLECTIBLE_AVATARS.map((o) => ({
        id: o.key,
        imageUrl: o.url,
        label: o.label,
        unlocked: unlocked.has(o.key),
        unlockHint: o.unlockHint,
        avatarKey: o.key,
      }));

      // 2. Mission-driven avatars
      const [missionsRes, unlocksRes] = await Promise.all([
        supabase
          .from("missions")
          .select("id, title, subtitle, reward_image_url, reward_label, is_active")
          .eq("reward_kind", "avatar")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("user_avatar_unlocks")
          .select("mission_id")
          .eq("user_id", user!.id),
      ]);

      const unlockedMissionIds = new Set(
        (unlocksRes.data ?? []).map((r: { mission_id: string }) => r.mission_id),
      );

      const missionItems: CollectibleItem[] = (missionsRes.data ?? [])
        .filter((m) => !!m.reward_image_url)
        .map((m) => ({
          id: `mission:${m.id}`,
          missionId: m.id,
          imageUrl: m.reward_image_url as string,
          label: m.reward_label || m.title,
          unlocked: unlockedMissionIds.has(m.id),
          unlockHint: m.subtitle || `Completa: ${m.title}`,
        }));

      const items = [...legacyItems, ...missionItems];
      const unlockedCount = items.filter((i) => i.unlocked).length;
      return {
        items,
        unlocked,
        unlockedCount,
        totalCount: items.length,
        arenaWins,
      };
    },
  });
}
