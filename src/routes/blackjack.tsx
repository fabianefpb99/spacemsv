import { createFileRoute } from "@tanstack/react-router";
import { BlackjackGame } from "@/components/BlackjackGame";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/blackjack")({
  head: () => ({
    meta: [
      { title: "Blackjack — BetSpaceman" },
      { name: "description", content: "Juega Blackjack en BetSpaceman. Blackjack paga 3 a 2." },
      { property: "og:title", content: "Blackjack — BetSpaceman" },
      { property: "og:description", content: "Juega Blackjack en BetSpaceman. Blackjack paga 3 a 2." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LoadingScreen variant="rocket">
      <BlackjackGame />
    </LoadingScreen>
  );
}