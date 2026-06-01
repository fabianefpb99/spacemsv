import { useEffect, useRef, useState, type ImgHTMLAttributes, type CSSProperties } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  rounded?: string;
};

/**
 * Renders a shimmering placeholder until the underlying image loads,
 * then fades it in. Handles cached images (where `onLoad` may not fire).
 */
export function SkeletonImage({
  wrapperClassName = "",
  wrapperStyle,
  rounded,
  className = "",
  onLoad,
  onError,
  ...imgProps
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <span
      className={`skeleton-img-wrap block ${loaded ? "loaded" : "skeleton"} ${wrapperClassName}`}
      style={{ borderRadius: rounded, ...wrapperStyle }}
    >
      <img
        ref={imgRef}
        {...imgProps}
        className={className}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setLoaded(true);
          onError?.(e);
        }}
      />
    </span>
  );
}

export default SkeletonImage;