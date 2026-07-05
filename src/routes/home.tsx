import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "./-home-page";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      { name: "description", content: "Tu home en BETSPACE Casino: juegos destacados, jackpot y más." },
      { property: "og:title", content: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      { property: "og:description", content: "Tu home en BETSPACE Casino: juegos destacados, jackpot y más." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:url", content: "https://betspace.app/" },
    ],
    links: [{ rel: "canonical", href: "https://betspace.app/" }],
  }),
  component: HomePage,
});