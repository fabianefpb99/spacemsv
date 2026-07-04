import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_top_winners",
  title: "Get today's top winners",
  description:
    "Returns today's top winners on BetSpace. Choose the 'general' casino leaderboard or the 'arena' leaderboard.",
  inputSchema: {
    board: z
      .enum(["general", "arena"])
      .optional()
      .describe("Which leaderboard to return. Defaults to 'general'."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Maximum number of entries to return (1-10). Defaults to 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ board, limit }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = board === "arena" ? "get_today_top_arena" : "get_today_top_winners";
    const { data, error } = await supabaseAdmin.rpc(rpc, { p_limit: 10 });
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    const rows = Array.isArray(data) ? data : [];
    const n = limit ?? 10;
    const entries = rows.slice(0, n).map((r: any, i: number) => ({
      rank: i + 1,
      username: String(r.username ?? "Jugador"),
      net_amount: Number(r.net_amount ?? 0),
    }));
    const text = entries.length
      ? entries
          .map((e) => `#${e.rank} ${e.username} — $${e.net_amount.toLocaleString("es-CO")} COP`)
          .join("\n")
      : "No entries on this leaderboard yet today.";
    return {
      content: [{ type: "text", text }],
      structuredContent: { board: board ?? "general", entries },
    };
  },
});