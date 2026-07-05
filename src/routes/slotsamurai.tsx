import { createFileRoute } from "@tanstack/react-router";
import { SlotSamuraiGame } from "@/components/SlotSamuraiGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/slotsamurai")({
  head: () => ({
    meta: [
      { title: "BETSPACE | Samurai Legend — Tragamonedas 5x3 Online Casino" },
      { name: "description", content: "Samurai Legend, tragamonedas 5x3 con temática samurái en BETSPACE Casino." },
      { property: "og:title", content: "BETSPACE | Samurai Legend Slot" },
      { property: "og:description", content: "Tragamonedas 5x3 estilo samurái en BETSPACE Casino." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  return (
    <RequireAuth>
      <LoadingScreen variant="slot">
        <h1 className="sr-only">Samurai Legend — BETSPACE Casino</h1>
        <SlotSamuraiGame />
      </LoadingScreen>
    </RequireAuth>
  );
}