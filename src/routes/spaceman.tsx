import { createFileRoute } from "@tanstack/react-router";
import { SpacemanGame } from "@/components/SpacemanGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/spaceman")({
  head: () => ({
    meta: [
      { title: "BETSPACE | Spaceman Crash Casino Online" },
      { name: "description", content: "Juega Spaceman en vivo en BETSPACE Casino." },
      { property: "og:title", content: "BETSPACE | Spaceman Crash Casino Online" },
      { property: "og:description", content: "Juega Spaceman en vivo en BETSPACE Casino." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen>
        <h1 className="sr-only">Spaceman — BETSPACE Casino</h1>
        <SpacemanGame />
      </LoadingScreen>
    </RequireAuth>
  );
}