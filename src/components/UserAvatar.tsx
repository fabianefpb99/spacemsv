import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarUrl, rememberMissionAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * Global, deduped fetch of all active mission avatars. Populates the
 * shared `missionAvatarUrlCache` so `getAvatarUrl("mission:<id>")` resolves
 * everywhere in the app (header, ranking, perfil, collection).
 */
export function useMissionAvatarMap() {
  return useQuery({
    queryKey: ["mission-avatars-global"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("missions")
        .select("id, reward_image_url")
        .eq("reward_kind", "avatar")
        .not("reward_image_url", "is", null);
      const map = new Map<string, string>();
      for (const m of data ?? []) {
        if (m.reward_image_url) {
          map.set(m.id, m.reward_image_url as string);
          rememberMissionAvatar(m.id, m.reward_image_url as string);
        }
      }
      return map;
    },
  });
}

type Size = "sm" | "md" | "lg";

function spinnerSizeClass(size: Size) {
  if (size === "sm") return "h-3 w-3 border-[1.5px]";
  if (size === "lg") return "h-6 w-6 border-2";
  return "h-5 w-5 border-2";
}

/**
 * Avatar renderer with professional loading spinner. Replaces the legacy
 * astronaut placeholder. Resolves `mission:<id>` keys via the global
 * mission avatar cache (auto-populated by useMissionAvatarMap).
 */
export function UserAvatar({
  avatarKey,
  avatarUrl,
  alt = "",
  className,
  spinnerSize = "md",
}: {
  avatarKey: string | null | undefined;
  /**
   * Optional fully-resolved URL. When provided, takes precedence over
   * `avatarKey` lookup. Used by ranking/recent-wins where the server already
   * resolves mission:/vip: keys, so the UI doesn't have to wait for the
   * per-user mission/vip avatar cache to populate.
   */
  avatarUrl?: string | null;
  alt?: string;
  className?: string;
  spinnerSize?: Size;
}) {
  // Ensure mission avatars are loaded into the cache app-wide.
  useMissionAvatarMap();

  const url = avatarUrl || getAvatarUrl(avatarKey);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    const done = () => {
      if (cancelled) return;
      const finish = () => !cancelled && setLoaded(true);
      if (img.decode) img.decode().then(finish).catch(finish);
      else finish();
    };
    if (img.complete && img.naturalWidth > 0) done();
    else {
      img.onload = done;
      img.onerror = () => !cancelled && setLoaded(true);
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  const showSpinner = !url || !loaded;

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-purple-950/40">
          <span
            className={cn(
              spinnerSizeClass(spinnerSize),
              "animate-spin rounded-full border-purple-300/30 border-t-purple-200",
            )}
          />
        </div>
      )}
      {url && (
        <img
          src={url}
          alt={alt}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
          loading="eager"
          decoding="async"
        />
      )}
    </div>
  );
}