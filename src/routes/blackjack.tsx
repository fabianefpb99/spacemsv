import { createFileRoute } from "@tanstack/react-router";
import { BlackjackGame } from "@/components/BlackjackGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/blackjack")({
  head: () => ({
    meta: [
      { title: "Blackjack Online | Casino BETSPACE Colombia" },
      { name: "description", content: "Juega Blackjack en BETSPACE Casino. Blackjack paga 3 a 2." },
      { property: "og:title", content: "BETSPACE | Blackjack Casino" },
      { property: "og:description", content: "Juega Blackjack en BETSPACE Casino. Blackjack paga 3 a 2." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="blackjack">
        <h1 className="sr-only">Blackjack — BETSPACE Casino</h1>
        <BlackjackGame />
      </LoadingScreen>
    </RequireAuth>
  );
}