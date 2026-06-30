import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeRpcError } from "@/lib/server-safe-error";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("not_admin");
}

const startInput = z.object({
  target_user_id: z.string().uuid(),
  rtp: z.number().min(90).max(99.9),
});

export const adminStartBoostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => startInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: res, error } = await context.supabase.rpc("admin_start_boost", {
      p_target_user_id: data.target_user_id,
      p_rtp: data.rtp,
    });
    if (error) throw safeRpcError(error);
    return res;
  });

const stopInput = z.object({ dry_run: z.boolean().default(false) });

export const adminStopBoostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => stopInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: res, error } = await context.supabase.rpc("admin_stop_boost", {
      p_dry_run: data.dry_run,
    });
    if (error) throw safeRpcError(error);
    return res;
  });