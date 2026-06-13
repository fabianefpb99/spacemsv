import { cn } from "@/lib/utils";
import { RANK_META, type VipRank, type VipSub } from "@/lib/vip/vip.shared";
import { RANK_ART } from "@/lib/vip/vip-art";

type Props = {
  rank: VipRank;
  sub: VipSub;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showLabel?: boolean;
  /** Render the illustrated SVG insignia instead of the lucide glyph. */
  art?: boolean;
};

const SIZES: Record<NonNullable<Props["size"]>, { box: string; icon: string; label: string; sub: string }> = {
  sm: { box: "h-7 w-7", icon: "h-3.5 w-3.5", label: "text-[8px]", sub: "text-[8px]" },
  md: { box: "h-12 w-12", icon: "h-6 w-6", label: "text-[10px]", sub: "text-[9px]" },
  lg: { box: "h-20 w-20", icon: "h-10 w-10", label: "text-xs", sub: "text-[11px]" },
  xl: { box: "h-28 w-28", icon: "h-14 w-14", label: "text-sm", sub: "text-xs" },
};

export function VipBadge({ rank, sub, size = "md", className, showLabel = false, art = false }: Props) {
  const meta = RANK_META[rank];
  const Icon = meta.icon;
  const s = SIZES[size];
  if (art) {
    return (
      <div className={cn("inline-flex flex-col items-center gap-1", className)}>
        <div className={cn("relative", s.box)}>
          <img
            src={RANK_ART[rank]}
            alt={`Insignia ${meta.label}`}
            className="h-full w-full object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
            style={{ filter: `drop-shadow(0 0 1.5px ${meta.glow})` }}
            loading="lazy"
            draggable={false}
          />
          <span
            className={cn(
              "absolute -bottom-1 right-0 rounded-md border border-white/20 bg-black/70 px-1 font-display font-black tracking-widest text-white",
              s.sub,
            )}
          >
            {sub}
          </span>
        </div>
        {showLabel && (
          <span className={cn("font-display font-bold uppercase tracking-widest", meta.text, s.label)}>
            {meta.label}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full bg-gradient-to-br",
          meta.gradient,
          s.box,
          "ring-2 ring-white/10",
        )}
        style={{ boxShadow: `0 0 18px ${meta.glow}` }}
      >
        <Icon className={cn(s.icon, "text-black/70 drop-shadow")} strokeWidth={2.5} />
        <span
          className={cn(
            "absolute -bottom-1 right-0 rounded-md border border-white/20 bg-black/70 px-1 font-display font-black tracking-widest text-white",
            s.sub,
          )}
        >
          {sub}
        </span>
      </div>
      {showLabel && (
        <span className={cn("font-display font-bold uppercase tracking-widest", meta.text, s.label)}>
          {meta.label}
        </span>
      )}
    </div>
  );
}
