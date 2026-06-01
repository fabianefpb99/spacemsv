import { useState, type ImgHTMLAttributes, type CSSProperties } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  /** Tailwind / className applied to the wrapper (controls size & shape) */
  wrapperClassName?: string;
  /** Inline style on the wrapper (e.g. aspect ratio) */
  wrapperStyle?: CSSProperties;
  /** Border radius, applied to wrapper. Defaults to inherit. */
  rounded?: string;
};

/**
 * Renders a shimmering gray skeleton until the underlying image loads,
 * then fades the image in. Pure CSS — no JS animation.
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
  return (
    <span
      className={`skeleton skeleton-img-wrap block ${loaded ? "loaded" : ""} ${wrapperClassName}`}
      style={{ borderRadius: rounded, ...wrapperStyle }}
    >
      <img
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