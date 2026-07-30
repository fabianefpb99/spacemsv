import { safeRpcError } from "@/lib/server-safe-error";
import {
  DESKTOP_GATE_DEFAULTS,
  desktopGateSchema,
  type DesktopGate,
} from "@/lib/admin/desktop-gate.shared";

const KEY = "desktop_gate";

async function getSupabaseAdmin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function assertAdmin(userId: string) {
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("not_admin");
}

export async function readGate(): Promise<DesktopGate> {
  const admin = await getSupabaseAdmin();
  const { data } = await admin.from("site_settings").select("value").eq("key", KEY).maybeSingle();
  const parsed = desktopGateSchema.safeParse(data?.value);
  return parsed.success ? parsed.data : DESKTOP_GATE_DEFAULTS;
}

export async function writeGate(value: DesktopGate) {
  const admin = await getSupabaseAdmin();
  const { error } = await admin
    .from("site_settings")
    .upsert(
      { key: KEY, value: value as unknown as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw safeRpcError(error);
}
