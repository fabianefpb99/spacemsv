import { createFileRoute } from "@tanstack/react-router";
import { SlotGame } from "@/components/SlotGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/slot")({
  head: () => ({
    meta: [
      { title: "Mafia Slots — BETSPACE Casino" },
      { name: "description", content: "Tragamonedas estilo gánsters de los años 20 en BETSPACE Casino." },
      { property: "og:title", content: "Mafia Slots — BETSPACE Casino" },
      { property: "og:description", content: "Tragamonedas estilo gánsters de los años 20 en BETSPACE Casino." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="slot">
        <h1 className="sr-only">Mafia Slots — BETSPACE Casino</h1>
        <SlotGame />
      </LoadingScreen>
    </RequireAuth>
  );
}