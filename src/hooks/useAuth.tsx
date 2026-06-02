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

    const bootstrap = async () => {
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

      // Only treat the session as gone on an explicit SIGNED_OUT. On mobile
      // (and after token refresh) the SDK can transiently emit null sessions
      // for INITIAL_SESSION / TOKEN_REFRESHED / USER_UPDATED while it
      // rehydrates from localStorage — clobbering state with that null kicks
      // the user out of protected routes and looks like a phantom logout.
      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        queryClient.invalidateQueries({ queryKey: ["me"] });
        return;
      }

      if (newSession) {
        setSession(newSession);
        setLoading(false);
        queryClient.invalidateQueries({ queryKey: ["me"] });
      } else if (bootstrappedRef.current) {
        // Bootstrap done and got a null event that isn't SIGNED_OUT → ignore.
        setLoading(false);
      }
    });

    void bootstrap();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
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