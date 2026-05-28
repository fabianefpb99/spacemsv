import { createFileRoute } from "@tanstack/react-router";
import { MinesGame } from "@/components/MinesGame";
import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/mines")({
  head: () => ({
    meta: [
      { title: "Mines — BetSpaceman" },
      { name: "description", content: "Juega Mines (Buscaminas) en BetSpaceman. RTP 97%." },
      { property: "og:title", content: "Mines — BetSpaceman" },
      { property: "og:description", content: "Juega Mines (Buscaminas) en BetSpaceman. RTP 97%." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LoadingScreen>
      <MinesGame />
    </LoadingScreen>
  );
}