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
        "glass-pill relative flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold min-w-[60px]",
        active ? "glass-pill--active" : "glass-pill--inactive",
      ].join(" ")}
    >
      <span className="glass-pill-content inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="glass-pill-content tracking-wide">{label}</span>
    </button>
  );
}