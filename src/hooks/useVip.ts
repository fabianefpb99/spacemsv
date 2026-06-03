import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { VipLevelRow } from "@/lib/vip/vip.shared";

export type UserVipRow = {
  user_id: string;
  total_xp: number;
  current_level: number;
  updated_at: string;
};

export type VipData = {
  user_vip: UserVipRow | null;
  levels: VipLevelRow[];
  last_seen_level: number;
};

export function useVip() {
  const { user, loading } = useAuth();
  return useQuery<VipData | null>({
    queryKey: ["vip", user?.id ?? null],
    enabled: !loading && !!user,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user) return null;
      const [{ data: vip }, { data: levels }, { data: prof }] = await Promise.all([
        supabase
          .from("user_vip" as never)
          .select("user_id,total_xp,current_level,updated_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("vip_levels" as never)
          .select("level,rank,sub_division,xp_required,reward_amount")
          .order("level", { ascending: true }),
        supabase
          .from("profiles")
          .select("vip_last_seen_level" as never)
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      return {
        user_vip: (vip as UserVipRow | null) ?? null,
        levels: (levels as unknown as VipLevelRow[]) ?? [],
        last_seen_level: Number(
          (prof as { vip_last_seen_level?: number } | null)?.vip_last_seen_level ?? 0,
        ),
      };
    },
  });
}

export function useMarkVipLevelSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mark_vip_level_seen" as never);
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vip"] });
    },
  });
}
