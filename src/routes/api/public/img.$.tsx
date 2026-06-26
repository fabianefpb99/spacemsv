import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_BUCKETS = new Set(["home-content", "vip-rewards", "mission-rewards"]);

export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const slash = splat.indexOf("/");
        if (slash < 0) return new Response("Bad request", { status: 400 });
        const bucket = splat.slice(0, slash);
        const path = splat.slice(slash + 1);
        if (!ALLOWED_BUCKETS.has(bucket) || !path) {
          return new Response("Forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const buf = await data.arrayBuffer();
        return new Response(buf, {
          headers: {
            "content-type": data.type || "application/octet-stream",
            // Stable URL + long cache so the browser and any CDN keep the
            // bytes between page refreshes. Bucket files are content-addressed
            // by upload timestamp, so re-uploads change the path.
            "cache-control": "public, max-age=2592000, immutable",
          },
        });
      },
    },
  },
});