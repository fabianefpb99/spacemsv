import gameSpacemanAsset from "@/assets/game-spaceman.png.asset.json";
import gameSlotMafiaAsset from "@/assets/game-slot-mafia.png.asset.json";
import gameSlotSamuraiAsset from "@/assets/game-slot-samurai.webp.asset.json";
import gameMinesAsset from "@/assets/game-mines.png.asset.json";
import gameDiceAsset from "@/assets/game-dice.png.asset.json";
import gameBlackjackAsset from "@/assets/game-blackjack.png.asset.json";
import gameBlackjackVipAsset from "@/assets/game-blackjack-vip.png.asset.json";
import gameArenaAsset from "@/assets/game-arena.png.asset.json";
import gameRuletaAsset from "@/assets/game-ruleta.png.asset.json";
import gameChickenAsset from "@/assets/game-chicken.webp.asset.json";

export type GameCategory = "crash" | "casino" | "tragamonedas" | "mesa" | "deportes";
export type GameBadge = "POPULAR" | "NUEVO" | "VIP" | "MESA" | "PRÓXIMAMENTE" | null;

export type CatalogGame = {
  slug: string;
  name: string;
  category: GameCategory;
  badge: GameBadge;
  to: string | null; // null = coming soon
  image: string;
  comingSoon?: boolean;
  /** popularity rank, lower = more popular (for ordering) */
  rank: number;
};

export type GameFilterId = GameCategory | "all" | "popular";

export const GAME_CATEGORIES: { id: GameFilterId; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "crash", label: "Crash" },
  { id: "popular", label: "Popular" },
  { id: "tragamonedas", label: "Tragamonedas" },
  { id: "mesa", label: "Mesa" },
  { id: "deportes", label: "Deportes" },
];

export const CATALOG: CatalogGame[] = [
  { slug: "spaceman", name: "SPACEMAN", category: "crash", badge: "POPULAR", to: "/spaceman", image: gameSpacemanAsset.url, rank: 1 },
  { slug: "slot_mafia", name: "MAFIA ROYALE", category: "tragamonedas", badge: "POPULAR", to: "/slot", image: gameSlotMafiaAsset.url, rank: 2 },
  { slug: "slot_samurai", name: "SAMURAI LEGEND", category: "tragamonedas", badge: "NUEVO", to: "/slotsamurai", image: gameSlotSamuraiAsset.url, rank: 3 },
  { slug: "ruleta", name: "RULETA", category: "mesa", badge: "POPULAR", to: "/ruleta", image: gameRuletaAsset.url, rank: 4 },
  { slug: "blackjack", name: "BLACKJACK", category: "mesa", badge: "POPULAR", to: "/blackjack", image: gameBlackjackAsset.url, rank: 5 },
  { slug: "blackjack_vip", name: "BLACKJACK VIP", category: "mesa", badge: "VIP", to: "/blackjackvip", image: gameBlackjackVipAsset.url, rank: 6 },
  { slug: "mines", name: "MINAS", category: "casino", badge: "POPULAR", to: "/mines", image: gameMinesAsset.url, rank: 7 },
  { slug: "chicken", name: "CHICKEN ROAD", category: "crash", badge: "NUEVO", to: "/chicken", image: gameChickenAsset.url, rank: 8 },
  { slug: "dados", name: "DADOS", category: "mesa", badge: "MESA", to: "/dados", image: gameDiceAsset.url, rank: 9 },
  { slug: "arena", name: "ARENA", category: "casino", badge: "NUEVO", to: "/arena", image: gameArenaAsset.url, rank: 10 },
  // Próximamente (fillers)
  { slug: "aviator", name: "AVIATOR", category: "crash", badge: "PRÓXIMAMENTE", to: null, image: gameSpacemanAsset.url, comingSoon: true, rank: 90 },
  { slug: "sweet_bonanza", name: "SWEET BONANZA", category: "tragamonedas", badge: "PRÓXIMAMENTE", to: null, image: gameSlotMafiaAsset.url, comingSoon: true, rank: 91 },
  { slug: "fire_portals", name: "FIRE PORTALS", category: "tragamonedas", badge: "PRÓXIMAMENTE", to: null, image: gameSlotSamuraiAsset.url, comingSoon: true, rank: 92 },
];