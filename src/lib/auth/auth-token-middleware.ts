import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async/with-timeout";
import { readStoredAccessToken } from "@/lib/auth/session-storage";

export const attachAuthTokenSafely = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | null = readStoredAccessToken();

    try {
      const { data } = await withTimeout(supabase.auth.getSession(), 2500, "auth_get_session_timeout");
      token = data.session?.access_token ?? token;
    } catch {
      token = token ?? null;
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);