import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      bootstrappedRef.current = true;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      setSession(newSession);

      // On slower mobile browsers the auth library can transiently surface a
      // null session before storage/cookies finish recovering after OAuth.
      // Do not mark auth as ready from that null until the initial bootstrap
      // getSession() has completed; otherwise user-scoped queries can run too
      // early, RLS returns no row, and the UI caches a fake $0 balance.
      if (newSession || bootstrappedRef.current || event === "SIGNED_OUT") {
        setLoading(false);
      }

      if (newSession?.user || event === "SIGNED_OUT") {
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    });

    void syncSession();

    const refreshFromVisibility = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void syncSession();
      }
    };

    window.addEventListener("focus", refreshFromVisibility);
    window.addEventListener("pageshow", refreshFromVisibility);
    document.addEventListener("visibilitychange", refreshFromVisibility);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", refreshFromVisibility);
      window.removeEventListener("pageshow", refreshFromVisibility);
      document.removeEventListener("visibilitychange", refreshFromVisibility);
    };
  }, [queryClient]);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}