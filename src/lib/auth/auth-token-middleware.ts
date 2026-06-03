import { createMiddleware } from "@tanstack/react-start";
import { readStoredAccessToken } from "@/lib/auth/session-storage";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async/with-timeout";

export const attachAuthTokenSafely = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token = readStoredAccessToken();

    if (!token) {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 1500, "auth_get_session_timeout");
        token = data.session?.access_token ?? null;
      } catch {
        token = readStoredAccessToken();
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);