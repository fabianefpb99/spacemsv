import { createFileRoute } from "@tanstack/react-router";
import { MinesGame } from "@/components/MinesGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/mines")({
  head: () => ({
    meta: [
      { title: "BETSPACE | Juego de Minas Online" },
      { name: "description", content: "Juega Mines (Buscaminas) en BETSPACE Casino. RTP 97%." },
      { property: "og:title", content: "BETSPACE | Juego de Minas Online" },
      { property: "og:description", content: "Juega Mines (Buscaminas) en BETSPACE Casino. RTP 97%." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="mine">
        <h1 className="sr-only">Mines — BETSPACE Casino</h1>
        <MinesGame />
      </LoadingScreen>
    </RequireAuth>
  );
}