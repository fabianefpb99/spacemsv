import { createFileRoute } from "@tanstack/react-router";
import { RouletteGame } from "@/components/RouletteGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/ruleta")({
  head: () => ({
    meta: [
      { title: "Ruleta Online en Vivo | Casino BETSPACE Colombia" },
      { name: "description", content: "Juega Ruleta en BETSPACE Casino. Apuesta a rojo, negro o verde y multiplica tu saldo." },
      { property: "og:title", content: "BETSPACE | Ruleta Juego En linea" },
      { property: "og:description", content: "Juega Ruleta en BETSPACE Casino. Apuesta a rojo, negro o verde y multiplica tu saldo." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="roulette">
        <h1 className="sr-only">Ruleta — BETSPACE Casino</h1>
        <RouletteGame />
      </LoadingScreen>
    </RequireAuth>
  );
}