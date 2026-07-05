import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ArenaGame } from "@/components/games/arena/ArenaGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/arena")({
  head: () => ({
    meta: [
      { title: "BETSPACE | Arena PvP Casino y Apuesta de Pelea" },
      {
        name: "description",
        content:
          "Apuesta a tu peleador favorito en la Arena Galáctica de BETSPACE Casino. Nova, Shadow, Titan o Blaze — solo uno sobrevive.",
      },
      { property: "og:title", content: "BETSPACE | Arena PvP Casino y Apuesta de Pelea" },
      {
        property: "og:description",
        content: "Apuesta a tu peleador favorito y multiplica tu saldo.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="arena">
        <h1 className="sr-only">Arena Galáctica — BETSPACE Casino</h1>
        <ArenaGame />
      </LoadingScreen>
    </RequireAuth>
  );
}