import type { ReactNode } from "react";

export function CategoryPill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all",
        "min-w-[72px] border",
        active
          ? "border-primary/60 bg-primary/20 text-foreground shadow-[0_0_16px_-6px_hsl(var(--primary)/0.8)]"
          : "border-white/5 bg-card/50 text-muted-foreground hover:border-white/10 hover:text-foreground",
      ].join(" ")}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center">{icon}</span>
      <span className="tracking-wide">{label}</span>
    </button>
  );
}