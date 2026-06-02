import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type MeData = {
  profile: {
    id: string;
    email: string | null;
    username: string | null;
    verification_status: string;
  } | null;
  balance: number;
  bonus_balance: number;
};

/**
 * Profile + official balance for the signed-in user.
 * Source of truth: Supabase. RLS scopes both reads to the current user.
 */
export function useMe() {
  const { user } = useAuth();
  return useQuery<MeData | null>({
    queryKey: ["me", user?.id ?? null],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return null;
      const [{ data: profile, error: profileError }, { data: bal, error: balanceError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, username, verification_status")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_balances")
          .select("balance, bonus_balance")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileError) throw profileError;
      if (balanceError) throw balanceError;

      return {
        profile: profile ?? null,
        balance: bal?.balance ? Number(bal.balance) : 0,
        bonus_balance: bal?.bonus_balance ? Number(bal.bonus_balance) : 0,
      };
    },
  });
}