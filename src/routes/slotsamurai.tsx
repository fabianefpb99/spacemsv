import { createFileRoute } from "@tanstack/react-router";
import { SlotSamuraiGame } from "@/components/SlotSamuraiGame";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";
import { useViewportLock } from "@/hooks/useViewportLock";

export const Route = createFileRoute("/slotsamurai")({
  head: () => ({
    meta: [
      { title: "Samurai Legend Tragamonedas | BETSPACE Casino Online" },
      { name: "description", content: "Samurai Legend, tragamonedas 5x3 con temática samurái en BETSPACE Casino." },
      { property: "og:title", content: "BETSPACE | Samurai Legend Slot" },
      { property: "og:description", content: "Tragamonedas 5x3 estilo samurái en BETSPACE Casino." },
    ],
  }),
  component: Page,
});

function Page() {
  useForceDarkTheme();
  useViewportLock();
  return (
    <RequireAuth>
      <LoadingScreen variant="samurai">
        <h1 className="sr-only">Samurai Legend — BETSPACE Casino</h1>
        <SlotSamuraiGame />
      </LoadingScreen>
    </RequireAuth>
  );
}