import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Page,
});

function Page() {
  return <Navigate to="/home" />;
}
