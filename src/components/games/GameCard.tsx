import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { CatalogGame } from "@/lib/games/catalog";

function badgeClass(badge: CatalogGame["badge"]) {
  switch (badge) {
    case "POPULAR":
      return "bg-purple-600 text-white border border-purple-400";
    case "NUEVO":
      return "bg-emerald-600 text-white border border-emerald-400";
    case "VIP":
      return "bg-amber-500 text-black border border-amber-300";
    case "MESA":
      return "bg-rose-600 text-white border border-rose-400";
    case "PRÓXIMAMENTE":
      return "bg-purple-500/25 text-white border border-purple-400/50";
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
        "group relative overflow-hidden rounded-xl border border-purple-500/15 shadow-sm transition-all",
        "hover:border-purple-400/50 hover:shadow-[0_0_18px_-8px_rgba(168,85,247,0.7)]",
        disabled ? "opacity-70 grayscale-[0.2]" : "",
        isList ? "flex items-center gap-3 bg-[#0c0620]/70 p-2" : "bg-black",
      ].join(" ")}
    >
      <div
        className={[
          "relative overflow-hidden",
          isList ? "h-16 w-16 shrink-0 rounded-lg" : "aspect-square w-full",
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
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
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
        {!isList && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 p-2">
            <div className="w-full truncate text-left text-[12px] font-extrabold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {game.name}
            </div>
            {game.badge && (
              <span
                className={[
                  "inline-block rounded-full px-2 py-[2px] text-[9px] font-bold uppercase tracking-wide shadow-md leading-none",
                  badgeClass(game.badge),
                ].join(" ")}
              >
                {game.badge}
              </span>
            )}
          </div>
        )}
      </div>

      {isList && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-extrabold tracking-wide text-foreground">
            {game.name}
          </div>
          {game.badge && (
            <div className="mt-1">
              <span
                className={[
                  "inline-block rounded-full px-2 py-[2px] text-[9px] font-bold uppercase tracking-wide leading-none",
                  badgeClass(game.badge),
                ].join(" ")}
              >
                {game.badge}
              </span>
            </div>
          )}
        </div>
      )}
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