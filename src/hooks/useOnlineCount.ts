import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHourlyOnlineBase } from "@/lib/online-base";
import { getActiveUsersCount } from "@/lib/presence.functions";

/**
 * Shared "ONLINE" counter used by home + every game screen so the number
 * shown is always consistent: hourly inflated base (120..1600) + real
 * active users. Uses the same query key as home so React Query dedupes
 * the network call.
 */
export function useOnlineCount(): number {
  const [onlineBase, setOnlineBase] = useState<number>(() => getHourlyOnlineBase());
  useEffect(() => {
    const t = setInterval(() => setOnlineBase(getHourlyOnlineBase()), 60_000);
    return () => clearInterval(t);
  }, []);
  const fetchActiveCount = useServerFn(getActiveUsersCount);
  const activeCountQ = useQuery({
    queryKey: ["online-active-count"],
    queryFn: () => fetchActiveCount(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const realActive = activeCountQ.data?.count ?? 0;
  return onlineBase + realActive;
}