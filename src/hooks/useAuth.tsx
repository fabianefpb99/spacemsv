import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    let mounted = true;

    const applyVerifiedSession = async (nextSession: Session | null) => {
      if (!mounted) return;

      if (!nextSession) {
        setSession(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error || !data.user) {
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(nextSession);
      setLoading(false);
    };

    // Single subscription. Don't await async work inside the callback to
    // avoid deadlocks; invalidate caches synchronously and let React Query refetch.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setLoading(true);
      void applyVerifiedSession(newSession);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    });

    supabase.auth.getSession().then(({ data }) => {
      void applyVerifiedSession(data.session);
    });

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