import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { AvatarKey } from "@/lib/avatars";

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
    // Unique per mount: StrictMode double-invokes effects and `supabase.channel()`
    // reuses an existing channel by name, which throws "cannot add postgres_changes
    // callbacks after subscribe()" on the second mount.
    const channelName = `avatar-unlocks-${user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
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
      // Collectibles come exclusively from active missions whose reward is an
      // avatar. Legacy hard-coded items were removed to avoid duplicates with
      // the equivalent missions configured from the admin panel.
      const unlocked = new Set<AvatarKey>();
      const arenaWins = 0;

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

      const items = missionItems;
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
