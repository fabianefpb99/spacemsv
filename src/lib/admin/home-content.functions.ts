import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const BUCKET = "home-content";
const SIGN_TTL = 60 * 60 * 24 * 7; // 7 days

function isStoragePath(url: string) {
  return !!url && !url.startsWith("http") && !url.startsWith("/__l5e/") && !url.startsWith("data:");
}

async function resolveUrl(url: string) {
  if (!isStoragePath(url)) return url;
  const admin = await getSupabaseAdmin();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(url, SIGN_TTL);
  return data?.signedUrl ?? url;
}

/* ---------------- SLIDES ---------------- */

export const adminListHomeSlides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("home_slides")
      .select("*")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = await Promise.all(
      (data ?? []).map(async (r) => ({ ...r, image_resolved: await resolveUrl(r.image_url) })),
    );
    return rows;
  });

const slideInput = z.object({
  id: z.string().uuid().optional(),
  position: z.number().int().min(0).max(999).default(0),
  image_url: z.string().min(1).max(1024),
  eyebrow: z.string().max(120).default(""),
  title: z.string().min(1).max(120),
  description: z.string().max(400).default(""),
  cta_label: z.string().min(1).max(60).default("Ver más"),
  cta_link: z.string().min(1).max(200).default("/home"),
  active: z.boolean().default(true),
});

export const adminUpsertHomeSlide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => slideInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const payload = { ...data };
    if (payload.id) {
      const { error } = await admin.from("home_slides").update(payload).eq("id", payload.id);
      if (error) throw new Error(error.message);
    } else {
      // remove id key when undefined
      const { id: _drop, ...insertData } = payload;
      void _drop;
      const { error } = await admin.from("home_slides").insert(insertData);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteHomeSlide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from("home_slides").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- FEATURED ---------------- */

export const adminListFeaturedGames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("home_featured_games")
      .select("*")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = await Promise.all(
      (data ?? []).map(async (r) => ({ ...r, image_resolved: await resolveUrl(r.image_url) })),
    );
    return rows;
  });

const featuredInput = z.object({
  id: z.string().uuid().optional(),
  position: z.number().int().min(0).max(999).default(0),
  image_url: z.string().min(1).max(1024),
  name: z.string().min(1).max(60),
  tag: z.string().max(30).default("POPULAR"),
  tag_color: z.enum(["purple", "emerald", "rose", "amber", "fuchsia"]).default("purple"),
  link: z.string().min(1).max(200).default("/home"),
  active: z.boolean().default(true),
});

export const adminUpsertFeaturedGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => featuredInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const payload = { ...data };
    if (payload.id) {
      const { error } = await admin.from("home_featured_games").update(payload).eq("id", payload.id);
      if (error) throw new Error(error.message);
    } else {
      const { id: _drop, ...insertData } = payload;
      void _drop;
      const { error } = await admin.from("home_featured_games").insert(insertData);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteFeaturedGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from("home_featured_games").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- UPLOAD (admin) ---------------- */

const uploadInput = z.object({
  filename: z.string().min(1).max(200),
  content_type: z.string().min(1).max(100),
  data_base64: z.string().min(10),
});

export const adminUploadHomeImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => uploadInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    const buffer = Buffer.from(data.data_base64, "base64");
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: data.content_type, upsert: false });
    if (error) throw new Error(error.message);
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
    return { path, signedUrl: signed?.signedUrl ?? "" };
  });

/* ---------------- BULK COMPRESS (admin) ---------------- */

export const adminListHomeStorageObjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin.storage.from(BUCKET).list("", {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message);
    const items = await Promise.all(
      (data ?? [])
        .filter((o) => o.name && !o.name.endsWith("/"))
        .map(async (o) => {
          const { data: signed } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(o.name, 60 * 10);
          return {
            path: o.name,
            size: (o.metadata?.size as number | undefined) ?? 0,
            mime: (o.metadata?.mimetype as string | undefined) ?? "",
            signedUrl: signed?.signedUrl ?? "",
          };
        }),
    );
    return items;
  });

const replaceInput = z.object({
  path: z.string().min(1).max(1024),
  content_type: z.string().min(1).max(100),
  data_base64: z.string().min(10),
});

export const adminReplaceHomeImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => replaceInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = await getSupabaseAdmin();
    const buffer = Buffer.from(data.data_base64, "base64");
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(data.path, buffer, {
        contentType: data.content_type,
        upsert: true,
      });
    if (error) throw new Error(error.message);
    return { ok: true, size: buffer.byteLength };
  });

/* ---------------- PUBLIC READS (home page) ---------------- */

export const getPublicHomeSlides = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from("home_slides")
    .select("id,position,image_url,eyebrow,title,description,cta_label,cta_link")
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) return [];
  return await Promise.all(
    (data ?? []).map(async (r) => ({ ...r, image_url: await resolveUrl(r.image_url) })),
  );
});

export const getPublicFeaturedGames = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from("home_featured_games")
    .select("id,position,image_url,name,tag,tag_color,link")
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) return [];
  return await Promise.all(
    (data ?? []).map(async (r) => ({ ...r, image_url: await resolveUrl(r.image_url) })),
  );
});