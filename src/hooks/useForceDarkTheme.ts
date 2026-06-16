import { useEffect } from "react";

/**
 * Forces dark mode while a game screen is mounted. Games are designed
 * for dark mode only; light mode would break their visuals. Restores
 * the previous theme classes on unmount without touching the persisted
 * user preference in localStorage.
 */
export function useForceDarkTheme() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const hadLight = root.classList.contains("light");
    const hadDark = root.classList.contains("dark");
    root.classList.remove("light");
    root.classList.add("dark");
    return () => {
      if (hadLight) root.classList.add("light");
      else root.classList.remove("light");
      if (hadDark) root.classList.add("dark");
      else root.classList.remove("dark");
    };
  }, []);
}