import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ChickenGame } from "@/components/ChickenGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/chicken")({
  head: () => ({
    meta: [
      { title: "Chicken Road — BETSPACE Casino" },
      {
        name: "description",
        content:
          "Salta de asteroide en asteroide en Chicken Road de BETSPACE Casino. Multiplica tu apuesta o cobra antes de caer al vacío.",
      },
      { property: "og:title", content: "Chicken Road — BETSPACE Casino" },
      {
        property: "og:description",
        content: "Salta, multiplica y cobra antes de que el asteroide se rompa.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="chicken">
        <ChickenGame />
      </LoadingScreen>
    </RequireAuth>
  );
}