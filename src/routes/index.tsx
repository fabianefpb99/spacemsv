import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "./-home-page";
import heroArenaAsset from "@/assets/home-hero-arena.png.asset.json";
import comboStarterImg from "@/assets/combo-starter.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      {
        name: "description",
        content:
          "BETSPACE — Casino Online y Apuestas Deportivas en Colombia. Juega tragamonedas, ruleta, blackjack, dados, minas y apuesta al fútbol desde tu teléfono.",
      },
      { property: "og:title", content: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      {
        property: "og:description",
        content:
          "BETSPACE — Casino Online y Apuestas Deportivas en Colombia. Juega tragamonedas, ruleta, blackjack, dados, minas y apuesta al fútbol desde tu teléfono.",
      },
      { property: "og:url", content: "https://betspace.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://betspace.app/" },
      {
        rel: "preload",
        as: "image",
        href: heroArenaAsset.url,
        fetchpriority: "high",
      },
      {
        rel: "preload",
        as: "image",
        href: comboStarterImg,
        fetchpriority: "high",
      },
    ],
  }),
  component: HomePage,
});
