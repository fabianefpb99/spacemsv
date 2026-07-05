import { createFileRoute } from "@tanstack/react-router";
import { BlackjackGame } from "@/components/BlackjackGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/blackjackvip")({
  head: () => ({
    meta: [
      { title: "BETSPACE | Blackjack VIP Casino" },
      { name: "description", content: "Blackjack VIP de alto rodaje en BETSPACE Casino. Apuestas premium, mismo motor justo." },
      { property: "og:title", content: "BETSPACE | Blackjack VIP Casino" },
      { property: "og:description", content: "Blackjack VIP de alto rodaje en BETSPACE Casino. Apuestas premium, mismo motor justo." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="blackjack_vip">
        <h1 className="sr-only">Blackjack VIP — BETSPACE Casino</h1>
        <BlackjackGame variant="blackjack_vip" theme="vip" />
      </LoadingScreen>
    </RequireAuth>
  );
}