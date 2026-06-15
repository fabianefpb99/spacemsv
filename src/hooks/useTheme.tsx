import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "betspace-theme";

type Ctx = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", t === "light");
  root.classList.toggle("dark", t === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useStoredTheme();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<Ctx>(
    () => ({
      theme,
      toggle: () => setThemeState(theme === "dark" ? "light" : "dark"),
      setTheme: (t) => setThemeState(t),
    }),
    [theme, setThemeState],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

function useStoredTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "light" || v === "dark") return v;
    } catch { /* ignore */ }
    return "dark";
  });
  const set = (t: Theme) => {
    setTheme(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  };
  return [theme, set];
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx);
  if (!ctx) {
    // Safe fallback so components don't crash if rendered outside provider.
    return {
      theme: "dark",
      toggle: () => {},
      setTheme: () => {},
    };
  }
  return ctx;
}