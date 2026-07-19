import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { CatalogGame } from "@/lib/games/catalog";

function badgeClass(badge: CatalogGame["badge"]) {
  switch (badge) {
    case "POPULAR":
      return "bg-primary/90 text-primary-foreground";
    case "NUEVO":
      return "bg-emerald-500/90 text-white";
    case "VIP":
      return "bg-amber-400/90 text-black";
    case "MESA":
      return "bg-muted text-foreground";
    case "PRÓXIMAMENTE":
      return "bg-primary/25 text-primary-foreground border border-primary/40";
    default:
      return "";
  }
}

export function GameCard({
  game,
  isFavorite,
  onToggleFavorite,
  variant = "grid",
}: {
  game: CatalogGame;
  isFavorite: boolean;
  onToggleFavorite: (slug: string) => void;
  variant?: "grid" | "list";
}) {
  const isList = variant === "list";
  const disabled = game.comingSoon;

  const content = (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border border-white/5 bg-card/60 shadow-sm transition-all",
        "hover:border-primary/40 hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.6)]",
        disabled ? "opacity-70 grayscale-[0.2]" : "",
        isList ? "flex items-center gap-3 p-2" : "",
      ].join(" ")}
    >
      <div
        className={[
          "relative overflow-hidden",
          isList ? "h-16 w-16 shrink-0 rounded-xl" : "aspect-[3/4] w-full",
        ].join(" ")}
      >
        <img
          src={game.image}
          alt={game.name}
          loading="lazy"
          className={[
            "h-full w-full object-cover transition-transform duration-500",
            disabled ? "" : "group-hover:scale-105",
          ].join(" ")}
        />
        {!isList && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        )}
        <button
          type="button"
          aria-label={isFavorite ? "Quitar favorito" : "Marcar favorito"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(game.slug);
          }}
          className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 backdrop-blur transition-colors hover:bg-black/70"
        >
          <Star
            className={[
              "h-4 w-4 transition-colors",
              isFavorite ? "fill-amber-300 text-amber-300" : "text-white/80",
            ].join(" ")}
            strokeWidth={2}
          />
        </button>
      </div>

      <div className={isList ? "min-w-0 flex-1" : "p-2.5"}>
        <div
          className={[
            "truncate text-[13px] font-extrabold tracking-wide",
            isList ? "text-foreground" : "text-white light-text-dark",
          ].join(" ")}
        >
          {game.name}
        </div>
        {game.badge && (
          <div className="mt-1.5">
            <span
              className={[
                "inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide",
                badgeClass(game.badge),
              ].join(" ")}
            >
              {game.badge}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (disabled || !game.to) {
    return <div className="cursor-not-allowed" aria-disabled>{content}</div>;
  }

  return (
    <Link to={game.to} className="block">
      {content}
    </Link>
  );
}