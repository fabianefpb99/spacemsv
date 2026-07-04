import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_online_count",
  title: "Get online player count",
  description:
    "Returns the current approximate number of players online on BetSpace, matching the count displayed on the site.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const { getHourlyOnlineBase } = await import("@/lib/online-base");
    const count = getHourlyOnlineBase();
    return {
      content: [{ type: "text", text: `${count} players online right now.` }],
      structuredContent: { online: count },
    };
  },
});