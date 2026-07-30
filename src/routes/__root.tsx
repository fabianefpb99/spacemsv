import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { MissionCompleteFloater } from "@/components/MissionCompleteFloater";
import { VipLevelUpFloater } from "@/components/VipLevelUpFloater";
import { SmoothImageLoader } from "@/components/SmoothImageLoader";
import { DEFAULT_AVATAR_URL } from "@/lib/avatars";
import { PersonalDataDialog } from "@/components/profile/PersonalDataDialog";
import {
  POST_SIGNUP_PERSONAL_DATA_EVENT,
  POST_SIGNUP_PERSONAL_DATA_USER_KEY,
} from "@/lib/auth/post-signup-personal-data";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#060210" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Spaceman" },
      { title: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      { name: "description", content: "BETSPACE - Apuesta y gana desde tu telefono, tus juegos favoritos en un solo lugar. Casino Online BETSPACE Casino - Apuestas BETSPACE Colombia" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      { property: "og:description", content: "BETSPACE - Apuesta y gana desde tu telefono, tus juegos favoritos en un solo lugar. Casino Online BETSPACE Casino - Apuestas BETSPACE Colombia" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "BETSPACE | Casino Online y Apuestas Deportivas Colombia" },
      { name: "twitter:description", content: "BETSPACE - Apuesta y gana desde tu telefono, tus juegos favoritos en un solo lugar. Casino Online BETSPACE Casino - Apuestas BETSPACE Colombia" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/481ba6b8-57ce-4628-a995-5b90a551bb85" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/481ba6b8-57ce-4628-a995-5b90a551bb85" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico?v=5", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png?v=5" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png?v=5" },
      { rel: "icon", type: "image/webp", sizes: "192x192", href: "/icon-192.webp?v=5" },
      { rel: "icon", type: "image/webp", sizes: "512x512", href: "/icon-512.webp?v=5" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=5" },
      // Abre DNS + TLS hacia el backend antes del primer fetch de sesión.
      // Ahorra ~200-500 ms en móvil/PWA tras días sin abrir la app.
      ...(import.meta.env.VITE_SUPABASE_URL
        ? [
            { rel: "preconnect", href: import.meta.env.VITE_SUPABASE_URL as string, crossOrigin: "anonymous" as const },
            { rel: "dns-prefetch", href: import.meta.env.VITE_SUPABASE_URL as string },
          ]
        : []),
      // Preload the default avatar so new users (no avatar_key yet) see it
      // instantly in header, ranking and floater on first paint.
      ...(DEFAULT_AVATAR_URL
        ? [{ rel: "preload", as: "image", href: DEFAULT_AVATAR_URL }]
        : []),
    ],
    scripts: [
      {
        children: `(function(){try{var t=localStorage.getItem('betspace-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") {
        queryClient.invalidateQueries();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  // Block right-click "Save image" on desktop. Long-press on mobile is
  // already handled via CSS (-webkit-touch-callout + pointer-events).
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.tagName === "IMG") e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SmoothImageLoader />
          <Outlet />
          <PostSignupPersonalDataPrompt />
          <MissionCompleteFloater />
          <VipLevelUpFloater />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function PostSignupPersonalDataPrompt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncStoredPrompt = () => {
      setPendingUserId(window.sessionStorage.getItem(POST_SIGNUP_PERSONAL_DATA_USER_KEY));
    };

    const handlePrompt = (event: Event) => {
      const nextUserId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (nextUserId) setPendingUserId(nextUserId);
    };

    syncStoredPrompt();
    window.addEventListener(POST_SIGNUP_PERSONAL_DATA_EVENT, handlePrompt);
    return () => window.removeEventListener(POST_SIGNUP_PERSONAL_DATA_EVENT, handlePrompt);
  }, []);

  useEffect(() => {
    if (user?.id && pendingUserId === user.id) setOpen(true);
  }, [pendingUserId, user?.id]);

  if (!user || pendingUserId !== user.id) return null;

  const clearPrompt = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(POST_SIGNUP_PERSONAL_DATA_USER_KEY);
    }
    setOpen(false);
    setPendingUserId(null);
  };

  return (
    <PersonalDataDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) clearPrompt();
      }}
      userId={user.id}
      title="Completa tus datos"
      subtitle="Esta información será necesaria para retirar tus ganancias. Puedes completarla ahora."
      submitLabel="Finalizar registro"
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ["me"] });
        queryClient.invalidateQueries({ queryKey: ["perfil-full", user.id] });
        clearPrompt();
      }}
    />
  );
}
