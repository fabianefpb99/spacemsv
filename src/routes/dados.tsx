import { createFileRoute } from "@tanstack/react-router";
import { DiceGame } from "@/components/DiceGame";

export const Route = createFileRoute("/dados")({
  head: () => ({
    meta: [
      { title: "Dice — BetSpaceman" },
      { name: "description", content: "Lanza dados 3D en BetSpaceman. Apuesta BAJO o ALTO y multiplica tus ganancias." },
      { property: "og:title", content: "Dice — BetSpaceman" },
      { property: "og:description", content: "Lanza dados 3D en BetSpaceman. Apuesta BAJO o ALTO y multiplica tus ganancias." },
    ],
  }),
  component: Page,
});

function Page() {
  return <DiceGame />;
}