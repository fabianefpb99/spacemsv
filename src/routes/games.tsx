import { createFileRoute } from "@tanstack/react-router";
import { GamesPage } from "./-games-page";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Juegos | BETSPACE Casino Colombia" },
      { name: "description", content: "Explora todos los juegos de BETSPACE: tragamonedas, mesa, crash, casino en vivo y deportes. Busca, filtra y encuentra tu favorito." },
      { property: "og:title", content: "Juegos | BETSPACE Casino Colombia" },
      { property: "og:description", content: "Todos los juegos del casino en un solo lugar: Spaceman, Mafia Royale, Samurai Legend, Ruleta, Blackjack y más." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: GamesPage,
});