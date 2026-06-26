import { useEffect } from "react";

const READY_ATTR = "data-image-ready";
const LOADING_ATTR = "data-image-loading";
const SMOOTH_ATTR = "data-smooth-image";

function shouldSmoothImage(img: HTMLImageElement) {
  if (img.closest("[data-no-smooth-image]")) return false;
  if (img.closest(".skeleton-img-wrap")) return false;
  const src = img.currentSrc || img.getAttribute("src") || "";
  if (!src || src.startsWith("data:")) return false;
  const path = src.split("?")[0]?.toLowerCase() ?? "";
  return !path.endsWith(".svg");
}

function revealAfterDecode(img: HTMLImageElement, finish: () => void) {
  if (typeof img.decode !== "function") {
    finish();
    return;
  }
  img.decode().catch(() => undefined).finally(finish);
}

export function SmoothImageLoader() {
  useEffect(() => {
    const cleanups = new WeakMap<HTMLImageElement, () => void>();

    const markReady = (img: HTMLImageElement) => {
      img.setAttribute(READY_ATTR, "true");
      img.removeAttribute(LOADING_ATTR);
    };

    const register = (img: HTMLImageElement) => {
      cleanups.get(img)?.();

      if (!shouldSmoothImage(img)) {
        img.removeAttribute(SMOOTH_ATTR);
        img.removeAttribute(LOADING_ATTR);
        img.removeAttribute(READY_ATTR);
        return;
      }

      img.setAttribute(SMOOTH_ATTR, "true");
      img.setAttribute("decoding", img.getAttribute("decoding") || "async");

      if (img.complete) {
        if (img.naturalWidth > 0) revealAfterDecode(img, () => markReady(img));
        else markReady(img);
        return;
      }

      img.removeAttribute(READY_ATTR);
      img.setAttribute(LOADING_ATTR, "true");

      const onLoad = () => revealAfterDecode(img, () => markReady(img));
      const onError = () => markReady(img);
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onError, { once: true });
      cleanups.set(img, () => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
      });
    };

    const scan = (root: ParentNode = document) => {
      root.querySelectorAll("img").forEach((img) => register(img as HTMLImageElement));
    };

    scan();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLImageElement) {
          register(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) register(node);
          else if (node instanceof HTMLElement) scan(node);
        });
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "srcset"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

export default SmoothImageLoader;