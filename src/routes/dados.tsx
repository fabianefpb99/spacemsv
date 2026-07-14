import { createFileRoute } from "@tanstack/react-router";
import { DiceGame } from "@/components/DiceGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/dados")({
  head: () => ({
    meta: [
      { title: "Dados Dice | Juego Casino Online BETSPACE Colombia" },
      { name: "description", content: "Lanza dados 3D en BETSPACE Casino. Apuesta BAJO o ALTO y multiplica tus ganancias." },
      { property: "og:title", content: "BETSPACE | Juego de Dados Online" },
      { property: "og:description", content: "Lanza dados 3D en BETSPACE Casino. Apuesta BAJO o ALTO y multiplica tus ganancias." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="dice">
        <h1 className="sr-only">Dice — BETSPACE Casino</h1>
        <DiceGame />
      </LoadingScreen>
    </RequireAuth>
  );
}