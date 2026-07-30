import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeRpcError } from "@/lib/server-safe-error";

const KEY = "desktop_gate";

export const desktopGateSchema = z.object({
  enabled: z.boolean().default(false),
  min_width: z.number().int().min(700).max(2200).default(1024),
  title: z.string().trim().min(2).max(60).default("Versión de escritorio en construcción"),
  message: z
    .string()
    .trim()
    .min(2)
    .max(240)
    .default(
      "Estamos puliendo la experiencia BETSPACE para pantallas grandes. Por ahora, ingresa desde tu móvil para disfrutar de todos los juegos.",
    ),
});

export type DesktopGate = z.infer<typeof desktopGateSchema>;

export const DESKTOP_GATE_DEFAULTS: DesktopGate = desktopGateSchema.parse({});

async function getSupabaseAdmin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function assertAdmin(userId: string) {
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("not_admin");
}

async function readGate(): Promise<DesktopGate> {
  const admin = await getSupabaseAdmin();
  const { data } = await admin.from("site_settings").select("value").eq("key", KEY).maybeSingle();
  const parsed = desktopGateSchema.safeParse(data?.value);
  return parsed.success ? parsed.data : DESKTOP_GATE_DEFAULTS;
}

/* -------- PUBLIC -------- */
export const getPublicDesktopGate = createServerFn({ method: "GET" }).handler(async () => {
  return await readGate();
});

/* -------- ADMIN -------- */
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
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from("site_settings")
      .upsert(
        { key: KEY, value: data, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw safeRpcError(error);
    return { ok: true as const };
  });
