import { createFileRoute } from "@tanstack/react-router";
import { SlotGame } from "@/components/SlotGame";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/slot")({
  head: () => ({
    meta: [
      { title: "Mafia Slots — BetSpaceman" },
      { name: "description", content: "Tragamonedas estilo gánsters de los años 20 en BetSpaceman." },
      { property: "og:title", content: "Mafia Slots — BetSpaceman" },
      { property: "og:description", content: "Tragamonedas estilo gánsters de los años 20 en BetSpaceman." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LoadingScreen>
      <SlotGame />
    </LoadingScreen>
  );
}