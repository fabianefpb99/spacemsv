import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ArenaGame } from "@/components/games/arena/ArenaGame";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/arena")({
  head: () => ({
    meta: [
      { title: "Arena Galáctica — BetSpaceman" },
      {
        name: "description",
        content:
          "Apuesta a tu peleador favorito en la Arena Galáctica de BetSpaceman. Nova, Shadow, Titan o Blaze — solo uno sobrevive.",
      },
      { property: "og:title", content: "Arena Galáctica — BetSpaceman" },
      {
        property: "og:description",
        content: "Apuesta a tu peleador favorito y multiplica tu saldo.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <RequireAuth>
      <LoadingScreen variant="arena">
        <ArenaGame />
      </LoadingScreen>
    </RequireAuth>
  );
}