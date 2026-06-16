import { createFileRoute } from "@tanstack/react-router";
import { MinesGame } from "@/components/MinesGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/mines")({
  head: () => ({
    meta: [
      { title: "Mines — BETSPACE Casino" },
      { name: "description", content: "Juega Mines (Buscaminas) en BETSPACE Casino. RTP 97%." },
      { property: "og:title", content: "Mines — BETSPACE Casino" },
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
        <MinesGame />
      </LoadingScreen>
    </RequireAuth>
  );
}