import { createFileRoute } from "@tanstack/react-router";
import { SpacemanGame } from "@/components/SpacemanGame";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/")({
  component: Page,
});

function Page() {
  return (
    <LoadingScreen>
      <SpacemanGame />
    </LoadingScreen>
  );
}
