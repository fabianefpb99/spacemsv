import { useEffect } from "react";

/**
 * Bloquea el alto real de la ventana mientras una pantalla de juego está montada.
 *
 * En Android (Chrome / MIUI / PWA) la barra de navegación y la barra de URL
 * cambian de tamaño dinámicamente: `100dvh` se recalcula con retraso y deja
 * unos píxeles de scroll en el body. Aquí medimos el `visualViewport` real y
 * lo exponemos como `--app-h`, además de bloquear el scroll del documento.
 */
export function useViewportLock() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;

    const apply = () => {
      const h = Math.round(vv?.height ?? window.innerHeight);
      if (h > 0) root.style.setProperty("--app-h", `${h}px`);
    };

    apply();
    root.classList.add("viewport-locked");

    vv?.addEventListener("resize", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      vv?.removeEventListener("resize", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.classList.remove("viewport-locked");
      root.style.removeProperty("--app-h");
    };
  }, []);
}
