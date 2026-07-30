import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { desktopGateSchema } from "@/lib/admin/desktop-gate.shared";
import { assertAdmin, readGate, writeGate } from "@/lib/admin/desktop-gate.server";

export const getPublicDesktopGate = createServerFn({ method: "GET" }).handler(async () => {
  return await readGate();
});

export const adminGetDesktopGate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return await readGate();
  });

export const adminSetDesktopGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => desktopGateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await writeGate(data);
    return { ok: true as const };
  });
