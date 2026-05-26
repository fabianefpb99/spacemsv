import { createFileRoute } from "@tanstack/react-router";
import { SpacemanGame } from "@/components/SpacemanGame";

export const Route = createFileRoute("/")({
  component: SpacemanGame,
});
