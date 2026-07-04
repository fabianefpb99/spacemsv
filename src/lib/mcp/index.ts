import { defineMcp } from "@lovable.dev/mcp-js";
import getOnlineCount from "./tools/get-online-count";
import getRecentWins from "./tools/get-recent-wins";
import getTopWinners from "./tools/get-top-winners";

export default defineMcp({
  name: "betspace-mcp",
  title: "BetSpace MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for BetSpace: query the current online player count, recent public wins across casino games, and today's top winners.",
  tools: [getOnlineCount, getRecentWins, getTopWinners],
});