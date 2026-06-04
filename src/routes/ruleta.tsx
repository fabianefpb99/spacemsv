import { createFileRoute } from "@tanstack/react-router";
import { RouletteGame } from "@/components/RouletteGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/ruleta")({
  head: () => ({
    meta: [
      { title: "Ruleta — BetSpaceman" },
      { name: "description", content: "Juega Ruleta en BetSpaceman. Apuesta a rojo, negro o verde y multiplica tu saldo." },
      { property: "og:title", content: "Ruleta — BetSpaceman" },
      { property: "og:description", content: "Juega Ruleta en BetSpaceman. Apuesta a rojo, negro o verde y multiplica tu saldo." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <RequireAuth>
      <LoadingScreen variant="roulette">
        <RouletteGame />
      </LoadingScreen>
    </RequireAuth>
  );
}