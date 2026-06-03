import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async/with-timeout";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const bootstrappedRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const refreshPromiseRef = useRef<Promise<Session | null> | null>(null);

  sessionRef.current = session;

  const applySession = (nextSession: Session | null) => {
    bootstrappedRef.current = true;
    setSession(nextSession);
    setLoading(false);
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  const refreshSession = async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      const hadSession = !!sessionRef.current;
      const delays = [0, 150, 400, 900];

      if (!hadSession) {
        setLoading(true);
      }

      for (const delay of delays) {
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }

        let nextSession: Session | null = null;

        try {
          const sessionRes = await withTimeout(supabase.auth.getSession(), 4000, "auth_get_session_timeout");
          nextSession = sessionRes.data.session;
        } catch (error) {
          console.warn("[auth] getSession recovery failed", error);
        }

        if (nextSession) {
          applySession(nextSession);
          return nextSession;
        }

        try {
          const { data: userData, error: userError } = await withTimeout(
            supabase.auth.getUser(),
            4000,
            "auth_get_user_timeout",
          );
          if (!userError && userData.user) {
            continue;
          }
        } catch (error) {
          console.warn("[auth] getUser recovery failed", error);
        }
      }

      bootstrappedRef.current = true;
      if (!hadSession) {
        setSession(null);
      } else {
        setSession(sessionRef.current);
      }
      setLoading(false);
      return hadSession ? sessionRef.current : null;
    })().finally(() => {
      refreshPromiseRef.current = null;
    });

    refreshPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const nextSession = await refreshSession();
      if (!mounted) return;
      if (nextSession) {
        setSession(nextSession);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      // Only treat the session as gone on an explicit SIGNED_OUT. On mobile
      // (and after token refresh) the SDK can transiently emit null sessions
      // for INITIAL_SESSION / TOKEN_REFRESHED / USER_UPDATED while it
      // rehydrates from localStorage — clobbering state with that null kicks
      // the user out of protected routes and looks like a phantom logout.
      if (event === "SIGNED_OUT") {
        applySession(null);
        return;
      }

      if (newSession) {
        applySession(newSession);
      } else if (bootstrappedRef.current) {
        void refreshSession();
      }
    });

    const recoverOnForeground = () => {
      if (document.visibilityState === "hidden") return;
      if (!sessionRef.current) {
        void refreshSession();
      }
    };

    void bootstrap();

    window.addEventListener("focus", recoverOnForeground);
    window.addEventListener("pageshow", recoverOnForeground);
    document.addEventListener("visibilitychange", recoverOnForeground);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", recoverOnForeground);
      window.removeEventListener("pageshow", recoverOnForeground);
      document.removeEventListener("visibilitychange", recoverOnForeground);
    };
  }, [queryClient]);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}