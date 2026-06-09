import { useEffect, useRef } from "react";

/**
 * When `open` is true, pushes a history entry so the browser/system back
 * button (Android hardware back, iOS swipe-back) closes the panel instead
 * of leaving the current route. On close (programmatic), pops the entry
 * back off so we don't leave dummy entries in history.
 */
export function useHistoryBackClose(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  const closingFromPopRef = useRef(false);
  const onCloseRef = useRef(onClose);
  // Keep latest onClose without re-running the effect (avoids the drawer
  // closing itself when the parent re-renders with a new arrow function).
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    try {
      window.history.pushState({ __modal: true }, "");
      pushedRef.current = true;
    } catch {
      // ignore
    }

    const onPop = () => {
      closingFromPopRef.current = true;
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (pushedRef.current && !closingFromPopRef.current) {
        pushedRef.current = false;
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
      closingFromPopRef.current = false;
    };
  }, [open]);
}