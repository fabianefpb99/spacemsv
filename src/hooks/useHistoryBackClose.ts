import { useEffect, useRef } from "react";

// Module-level flag: when the cleanup of one mount calls history.back(),
// the resulting popstate must NOT close the next mount (StrictMode double
// invoke in dev / Lovable editor). The cleanup sets this; the listener
// consumes it once.
let ignoreNextPop = false;

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
      if (ignoreNextPop) {
        ignoreNextPop = false;
        // Re-push so the back button still closes the modal next time.
        try {
          window.history.pushState({ __modal: true }, "");
          pushedRef.current = true;
        } catch {
          // ignore
        }
        return;
      }
      closingFromPopRef.current = true;
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (pushedRef.current && !closingFromPopRef.current) {
        pushedRef.current = false;
        ignoreNextPop = true;
        try {
          window.history.back();
        } catch {
          ignoreNextPop = false;
          // ignore
        }
      }
      closingFromPopRef.current = false;
    };
  }, [open]);
}