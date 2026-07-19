import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, SlidersHorizontal, LayoutGrid, List, ChevronDown, Rocket, Dices, Grid2X2, Spade, Trophy } from "lucide-react";
import { CATALOG, GAME_CATEGORIES, type GameCategory } from "@/lib/games/catalog";
import { GameCard } from "@/components/games/GameCard";
import { CategoryPill } from "@/components/games/CategoryPill";
import { FiltersSheet, countActiveFilters, type GamesFilters } from "@/components/games/FiltersSheet";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { AuthControl } from "@/components/auth/AuthControl";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useMe } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import betspaceLogo from "@/assets/betspace-logo.svg";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(n)));
}

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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>("popular");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<GamesFilters>({
    onlyFavorites: false,
    onlyNew: false,
    hideComingSoon: false,
  });
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const me = useMe();
  const { user, loading: authLoading } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const balanceText = me.data ? formatCOP(me.data.balance + me.data.bonus_balance) : "—";

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
    <div className="min-h-screen bg-[#060210]">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6 pt-4 sm:max-w-lg sm:px-4 lg:max-w-3xl lg:px-6">
        {/* Header — idéntico al del home */}
        <header
          className="flex flex-col items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1">
              <div className="lg:hidden">
                <HamburgerDrawer
                  trigger={
                    <button
                      type="button"
                      aria-label="Abrir menú"
                      className="rounded-md p-2 text-white hover:bg-white/10"
                    >
                      <Menu className="h-7 w-7" strokeWidth={3} />
                    </button>
                  }
                />
              </div>
              <Link to="/" className="logo-shine">
                <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7 translate-y-px" />
                <img src={betspaceLogo} alt="" aria-hidden="true" className="logo-shine-overlay h-6 w-auto sm:h-7 translate-y-px" />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
                    <div className="font-display text-[11px] font-bold sm:text-xs text-white">
                      <span className="neon-green mr-0.5">$</span>{balanceText} COP
                    </div>
                  </div>
                  <AuthControl />
                  <NotificationBell />
                </>
              ) : authLoading ? (
                <div className="h-7 w-24 animate-pulse rounded-md bg-white/5" />
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthDialogOpen(true)}
                  className="inline-flex items-center rounded-md border border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-500 to-purple-600 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-[0_0_14px_-4px_rgba(217,70,239,0.85)] transition hover:from-fuchsia-400 hover:to-purple-500 sm:text-[11px]"
                >
                  Login / Registro
                </button>
              )}
            </div>
          </div>
        </header>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

        <main className="pt-4">
        <h1 className="sr-only">Juegos BETSPACE</h1>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-200/60" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar juegos..."
            className="w-full rounded-lg border border-purple-500/20 bg-[#0c0620]/70 py-1.5 pl-8 pr-3 text-[13px] text-white placeholder:text-purple-200/50 outline-none transition-colors focus:border-purple-400/60"
          />
        </div>

        {/* Categories */}
        <div className="mt-2.5 -mx-3 overflow-x-auto px-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1.5">
            {GAME_CATEGORIES.map((c) => (
              <CategoryPill
                key={c.id}
                active={category === c.id}
                onClick={() => {
                  if (c.id === "deportes") {
                    navigate({ to: "/deportes" });
                    return;
                  }
                  setCategory(c.id);
                }}
                icon={CATEGORY_ICONS[c.id] ?? <Trophy className="h-5 w-5" />}
                label={c.label}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-[#0c0620]/70 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:border-purple-400/60"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-500 px-1 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="relative flex-1">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full appearance-none rounded-lg border border-purple-500/20 bg-[#0c0620]/70 px-2.5 py-1.5 pr-7 text-[12px] font-semibold text-white hover:border-purple-400/60 focus:outline-none"
            >
              <option value="popular">Más populares</option>
              <option value="new">Más nuevos</option>
              <option value="az">A – Z</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-200/60" />
          </div>

          <div className="inline-flex overflow-hidden rounded-lg border border-purple-500/20 bg-[#0c0620]/70">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Vista cuadrícula"
              className={`inline-flex h-7 w-7 items-center justify-center transition-colors ${view === "grid" ? "bg-purple-500 text-white" : "text-purple-200/70 hover:text-white"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="Vista lista"
              className={`inline-flex h-7 w-7 items-center justify-center transition-colors ${view === "list" ? "bg-purple-500 text-white" : "text-purple-200/70 hover:text-white"}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Result count */}
        <div className="mt-2.5 text-[11px] text-purple-200/60">
          {filtered.length} {filtered.length === 1 ? "juego" : "juegos"}
        </div>

        {/* Grid / List */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-purple-500/20 py-14 text-center text-sm text-purple-200/60">
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
      </div>
    </div>
  );
}