import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Auto-shrinking text container.
 *
 * Renders `children` on a single line and scales them down (via `transform: scale`)
 * whenever the natural width would overflow the parent. This keeps bet HUDs from
 * pushing siblings or forcing the page to scroll when the figure grows large
 * (e.g. "1.000.000.000 COP").
 *
 * - Never scales above 1 (so small numbers render at their authored font-size).
 * - `min` is the lower scale bound to avoid unreadable text on absurd values.
 * - Uses ResizeObserver so the container width is tracked through layout changes.
 */
export function FitText({
  children,
  className,
  style,
  min = 0.55,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  min?: number;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const ow = outer.clientWidth;
      const iw = inner.scrollWidth;
      if (ow <= 0 || iw <= 0) return;
      const next = Math.min(1, Math.max(min, ow / iw));
      setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [children, min]);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        ...style,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 0,
      }}
    >
      <span
        ref={innerRef}
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        {children}
      </span>
    </div>
  );
}