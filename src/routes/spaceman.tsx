import { createFileRoute } from "@tanstack/react-router";
import { SpacemanGame } from "@/components/SpacemanGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/spaceman")({
  head: () => ({
    meta: [
      { title: "Spaceman — BETSPACE Casino" },
      { name: "description", content: "Juega Spaceman en vivo en BETSPACE Casino." },
      { property: "og:title", content: "Spaceman — BETSPACE Casino" },
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
        <SpacemanGame />
      </LoadingScreen>
    </RequireAuth>
  );
}