import { safeRpcError } from "@/lib/server-safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEY = "hamburger_drawer";
const BUCKET = "home-content";
const SIGN_TTL = 60 * 60 * 24 * 7;

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

function isStoragePath(url: string) {
  return !!url && !url.startsWith("http") && !url.startsWith("/__l5e/") && !url.startsWith("data:");
}

async function resolveUrl(url: string) {
  if (!url || !isStoragePath(url)) return url ?? "";
  const admin = await getSupabaseAdmin();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(url, SIGN_TTL);
  return data?.signedUrl ?? url;
}

export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "twitter",
  "youtube",
  "tiktok",
  "telegram",
  "whatsapp",
  "discord",
] as const;

const socialItem = z.object({
  id: z.string().min(1).max(60),
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.string().trim().min(1).max(500),
  active: z.boolean().default(true),
  position: z.number().int().min(0).max(99).default(0),
});

const promo = z.object({
  active: z.boolean().default(true),
  eyebrow: z.string().max(40).default("Juego destacado"),
  title: z.string().max(40).default("ARENA"),
  subtitle: z.string().max(120).default("Combates épicos y premios reales"),
  cta_label: z.string().max(40).default("¡Pelear ahora!"),
  cta_link: z.string().max(200).default("/arena"),
  image_url: z.string().max(1024).default(""),
});

const drawerSettings = z.object({
  promo: promo,
  socials: z.array(socialItem).max(20).default([]),
});

export type DrawerSettings = z.infer<typeof drawerSettings>;

const DEFAULTS: DrawerSettings = {
  promo: {
    active: true,
    eyebrow: "Juego destacado",
    title: "ARENA",
    subtitle: "Combates épicos y premios reales",
    cta_label: "¡Pelear ahora!",
    cta_link: "/arena",
    image_url: "",
  },
  socials: [],
};

function mergeWithDefaults(value: unknown): DrawerSettings {
  const parsed = drawerSettings.safeParse(value);
  if (parsed.success) return parsed.data;
  return DEFAULTS;
}

async function readSettings(): Promise<DrawerSettings> {
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  return mergeWithDefaults(data?.value);
}

/* -------- PUBLIC -------- */

export const getPublicDrawerSettings = createServerFn({ method: "GET" }).handler(async () => {
  const s = await readSettings();
  const resolvedImage = await resolveUrl(s.promo.image_url);
  return {
    promo: { ...s.promo, image_url: resolvedImage },
    socials: (s.socials ?? [])
      .filter((x) => x.active && x.url)
      .sort((a, b) => a.position - b.position),
  };
});

/* -------- ADMIN -------- */

export const adminGetDrawerSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const s = await readSettings();
    const image_preview = await resolveUrl(s.promo.image_url);
    return { settings: s, image_preview };
  });

export const adminUpdateDrawerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => drawerSettings.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from("site_settings")
      .upsert({ key: KEY, value: data, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw safeRpcError(error);
    return { ok: true };
  });