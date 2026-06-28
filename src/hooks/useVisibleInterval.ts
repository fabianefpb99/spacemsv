import { useEffect, useRef } from "react";

/**
 * setInterval que se pausa cuando la pestaña está oculta y se reanuda al
 * volver. Mantiene la misma firma que useEffect-+setInterval, pero ahorra
 * CPU / batería en background sin afectar la UI visible.
 *
 * - `delay`: ms entre ticks. Pasar `null` o `<= 0` desactiva el intervalo.
 * - `runOnVisible`: si true (por defecto), ejecuta el callback al volver
 *   visible para que la UI se ponga al día sin esperar al próximo tick.
 */
export function useVisibleInterval(
  callback: () => void,
  delay: number | null,
  options: { runOnVisible?: boolean } = {},
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const runOnVisible = options.runOnVisible ?? true;

  useEffect(() => {
    if (delay == null || delay <= 0) return;
    if (typeof window === "undefined") return;

    let id: number | null = null;
    const start = () => {
      if (id != null) return;
      id = window.setInterval(() => cbRef.current(), delay);
    };
    const stop = () => {
      if (id != null) {
        window.clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        if (runOnVisible) {
          try { cbRef.current(); } catch { /* noop */ }
        }
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [delay, runOnVisible]);
}