import { createFileRoute } from "@tanstack/react-router";
import { SpacemanGame } from "@/components/SpacemanGame";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/spaceman")({
  head: () => ({
    meta: [
      { title: "Spaceman — BetSpaceman" },
      { name: "description", content: "Juega Spaceman en vivo en BetSpaceman." },
      { property: "og:title", content: "Spaceman — BetSpaceman" },
      { property: "og:description", content: "Juega Spaceman en vivo en BetSpaceman." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LoadingScreen>
      <SpacemanGame />
    </LoadingScreen>
  );
}