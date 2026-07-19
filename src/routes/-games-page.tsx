import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, LayoutGrid, List, ChevronDown, Rocket, Dices, Grid2X2, Spade, Trophy } from "lucide-react";
import { CATALOG, GAME_CATEGORIES, type GameCategory } from "@/lib/games/catalog";
import { GameCard } from "@/components/games/GameCard";
import { CategoryPill } from "@/components/games/CategoryPill";
import { FiltersSheet, countActiveFilters, type GamesFilters } from "@/components/games/FiltersSheet";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { AuthControl } from "@/components/auth/AuthControl";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import betspaceLogo from "@/assets/betspace-logo.svg";

function FootballIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6.5 15 9.5 14 14 10 14 9 9.5Z" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all: <Grid2X2 className="h-5 w-5" />,
  crash: <Rocket className="h-5 w-5" />,
  casino: <Dices className="h-5 w-5" />,
  tragamonedas: <LayoutGrid className="h-5 w-5" />,
  mesa: <Spade className="h-5 w-5" />,
  deportes: <FootballIcon className="h-5 w-5" />,
};

type SortOption = "popular" | "new" | "az";

const FAV_STORAGE_KEY = "betspace:games:favorites";

function readFavs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function GamesPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const [sort, setSort] = useState<SortOption>("popular");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<GamesFilters>({
    onlyFavorites: false,
    onlyNew: false,
    hideComingSoon: false,
  });
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const { data: isAdmin } = useIsAdmin();

  useEffect(() => {
    setFavs(readFavs());
  }, []);

  const toggleFav = (slug: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      try { window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = CATALOG.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (q && !g.name.toLowerCase().includes(q) && !g.slug.toLowerCase().includes(q)) return false;
      if (filters.onlyFavorites && !favs.has(g.slug)) return false;
      if (filters.onlyNew && g.badge !== "NUEVO") return false;
      if (filters.hideComingSoon && g.comingSoon) return false;
      return true;
    });
    if (sort === "popular") items = items.slice().sort((a, b) => a.rank - b.rank);
    else if (sort === "az") items = items.slice().sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "new") items = items.slice().sort((a, b) => {
      const an = a.badge === "NUEVO" ? 0 : 1;
      const bn = b.badge === "NUEVO" ? 0 : 1;
      if (an !== bn) return an - bn;
      return a.rank - b.rank;
    });
    return items;
  }, [query, category, sort, filters, favs]);

  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-muted"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src={betspaceLogo} alt="BETSPACE" className="h-6" />
          </Link>
          <div className="flex items-center gap-1.5">
            {isAdmin ? <NotificationBell /> : null}
            <AuthControl />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-24 pt-4">
        <h1 className="sr-only">Juegos BETSPACE</h1>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar juegos..."
            className="w-full rounded-xl border border-white/5 bg-card/60 py-3 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50"
          />
        </div>

        {/* Categories */}
        <div className="mt-4 -mx-3 overflow-x-auto px-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2">
            {GAME_CATEGORIES.map((c) => (
              <CategoryPill
                key={c.id}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
                icon={CATEGORY_ICONS[c.id] ?? <Trophy className="h-5 w-5" />}
                label={c.label}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative inline-flex items-center gap-2 rounded-xl border border-white/10 bg-card/60 px-3 py-2 text-sm font-semibold hover:border-primary/40"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="relative flex-1">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-card/60 px-3 py-2 pr-8 text-sm font-semibold text-foreground hover:border-primary/40 focus:outline-none"
            >
              <option value="popular">Más populares</option>
              <option value="new">Más nuevos</option>
              <option value="az">A – Z</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="inline-flex overflow-hidden rounded-xl border border-white/10 bg-card/60">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Vista cuadrícula"
              className={`inline-flex h-9 w-9 items-center justify-center transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="Vista lista"
              className={`inline-flex h-9 w-9 items-center justify-center transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Result count */}
        <div className="mt-4 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "juego" : "juegos"}
        </div>

        {/* Grid / List */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-muted-foreground">
            No encontramos juegos que coincidan con tu búsqueda.
          </div>
        ) : view === "grid" ? (
          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
            {filtered.map((g) => (
              <GameCard key={g.slug} game={g} isFavorite={favs.has(g.slug)} onToggleFavorite={toggleFav} />
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {filtered.map((g) => (
              <GameCard key={g.slug} game={g} isFavorite={favs.has(g.slug)} onToggleFavorite={toggleFav} variant="list" />
            ))}
          </div>
        )}
      </main>

      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filters} onChange={setFilters} />
      <HamburgerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}