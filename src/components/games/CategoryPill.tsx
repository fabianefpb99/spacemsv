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
        "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all",
        "min-w-[60px] border",
        active
          ? "category-pill-active border-purple-400/60 bg-purple-500/20 text-white shadow-[0_0_16px_-6px_rgba(168,85,247,0.85)]"
          : "category-pill-inactive border-purple-500/15 bg-[#0c0620]/60 text-purple-200/70 hover:border-purple-400/40 hover:text-white",
      ].join(" ")}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="tracking-wide">{label}</span>
    </button>
  );
}