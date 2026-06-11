import { createFileRoute } from "@tanstack/react-router";
import { DiceGame } from "@/components/DiceGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/dados")({
  head: () => ({
    meta: [
      { title: "Dice — BETSPACE Casino" },
      { name: "description", content: "Lanza dados 3D en BETSPACE Casino. Apuesta BAJO o ALTO y multiplica tus ganancias." },
      { property: "og:title", content: "Dice — BETSPACE Casino" },
      { property: "og:description", content: "Lanza dados 3D en BETSPACE Casino. Apuesta BAJO o ALTO y multiplica tus ganancias." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <RequireAuth>
      <LoadingScreen variant="dice">
        <DiceGame />
      </LoadingScreen>
    </RequireAuth>
  );
}