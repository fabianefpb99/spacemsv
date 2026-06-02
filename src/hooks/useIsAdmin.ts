import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./useAuth";
import { checkIsAdmin } from "@/lib/admin/admin.functions";

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const fn = useServerFn(checkIsAdmin);
  return useQuery({
    queryKey: ["is-admin", user?.id ?? null],
    enabled: !loading && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fn();
      return r.isAdmin;
    },
  });
}