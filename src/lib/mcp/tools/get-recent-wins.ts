import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase-user-client";

export default defineTool({
  name: "get_recent_wins",
  title: "Get recent public wins",
  description:
    "Returns the most recent public wins across BetSpace casino games (game, amount in COP, multiplier, timestamp).",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Maximum number of wins to return (1-20). Defaults to 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const { data, error } = await (supabaseForUser(ctx) as any).rpc("get_recent_public_wins", {
      p_limit: 20,
    });
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    const rows = Array.isArray(data) ? data : [];
    const n = limit ?? 10;
    const wins = rows.slice(0, n).map((r: any) => ({
      username: String(r.username ?? "Jugador"),
      game: String(r.game ?? "casino"),
      amount: Number(r.amount ?? 0),
      multiplier: Number(r.multiplier ?? 1),
      created_at: String(r.created_at),
    }));
    const text = wins.length
      ? wins
          .map(
            (w) =>
              `${w.username} won $${w.amount.toLocaleString("es-CO")} COP on ${w.game} (x${w.multiplier})`,
          )
          .join("\n")
      : "No recent wins available.";
    return { content: [{ type: "text", text }], structuredContent: { wins } };
  },
});