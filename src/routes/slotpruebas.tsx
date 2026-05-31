import { createFileRoute } from "@tanstack/react-router";
import { SlotGameTest } from "@/components/SlotGameTest";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/slotpruebas")({
  head: () => ({
    meta: [
      { title: "Slot Pruebas — BetSpaceman" },
      { name: "description", content: "Modo de pruebas del slot con premios grandes y medianos frecuentes." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LoadingScreen variant="slot">
      <SlotGameTest />
    </LoadingScreen>
  );
}