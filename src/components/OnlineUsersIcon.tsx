import { UserRound } from "lucide-react";

/** Small user glyph used next to the "N ONLINE" counter across the app. */
export function OnlineUsersIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-3.5 w-3.5 items-center justify-center ${className}`}>
      <span className="absolute inset-0 rounded-full bg-emerald-400/30 blur-[5px] animate-pulse" aria-hidden="true" />
      <UserRound
        className="home-online-icon relative h-3.5 w-3.5 text-emerald-400"
        strokeWidth={2.4}
        aria-hidden="true"
      />
    </span>
  );
}

export default OnlineUsersIcon;
