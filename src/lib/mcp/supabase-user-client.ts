import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Supabase client scoped to the OAuth-authenticated MCP caller.
 * RLS runs as that user — never use the service-role client in MCP tools.
 */
export function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const NOT_AUTHENTICATED = {
  content: [{ type: "text" as const, text: "Not authenticated" }],
  isError: true,
};