import { memo } from "react";

type ChipPalette = {
  base: string;      // main rim color
  baseDark: string;  // shadow/edge
  baseLight: string; // highlight on rim
  inner: string;     // inner face
  innerEdge: string; // ring around face
  text: string;
  textShadow: string;
};

const PALETTES: Record<string, ChipPalette> = {
  blue: {
    base: "#2563eb",
    baseDark: "#0b1d52",
    baseLight: "#7aa8ff",
    inner: "#1e3a8a",
    innerEdge: "#0b1d52",
    text: "#ffffff",
    textShadow: "#0b1d52",
  },
  red: {
    base: "#dc2626",
    baseDark: "#5a0a0a",
    baseLight: "#ff8a8a",
    inner: "#991b1b",
    innerEdge: "#5a0a0a",
    text: "#ffffff",
    textShadow: "#5a0a0a",
  },
  green: {
    base: "#16a34a",
    baseDark: "#0a3d1a",
    baseLight: "#7be0a1",
    inner: "#15803d",
    innerEdge: "#0a3d1a",
    text: "#ffffff",
    textShadow: "#0a3d1a",
  },
  gold: {
    base: "#1a1a1a",
    baseDark: "#000000",
    baseLight: "#4a4a4a",
    inner: "#0f0f0f",
    innerEdge: "#000000",
    text: "#fcd34d",
    textShadow: "#000000",
  },
};

export const CasinoChip = memo(function CasinoChip({
  label,
  variant,
  size = 28,
  className,
}: {
  label: string;
  variant: keyof typeof PALETTES;
  size?: number;
  className?: string;
}) {
  const p = PALETTES[variant];
  const id = `chip-${variant}-${label}`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-rim`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={p.baseLight} />
          <stop offset="55%" stopColor={p.base} />
          <stop offset="100%" stopColor={p.baseDark} />
        </radialGradient>
        <radialGradient id={`${id}-face`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor={p.baseLight} stopOpacity="0.55" />
          <stop offset="40%" stopColor={p.inner} />
          <stop offset="100%" stopColor={p.innerEdge} />
        </radialGradient>
        <linearGradient id={`${id}-gloss`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-textShadow`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#000000" floodOpacity="0.65" />
        </filter>
      </defs>

      {/* drop shadow */}
      <ellipse cx="32" cy="58" rx="22" ry="3" fill="#000" opacity="0.45" />

      {/* outer rim */}
      <circle cx="32" cy="32" r="28" fill={`url(#${id}-rim)`} stroke={p.baseDark} strokeWidth="1" />

      {/* subtle edge dashes instead of heavy white rectangles */}
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        stroke={p.baseLight}
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="3 6"
        strokeLinecap="round"
      />

      {/* inner ring */}
      <circle cx="32" cy="32" r="21" fill="none" stroke={p.baseDark} strokeOpacity="0.55" strokeWidth="1" />

      {/* inner face */}
      <circle cx="32" cy="32" r="20" fill={`url(#${id}-face)`} />

      {/* concentric line */}
      <circle cx="32" cy="32" r="17" fill="none" stroke={p.baseLight} strokeOpacity="0.25" strokeWidth="0.6" />

      {/* top gloss */}
      <ellipse cx="32" cy="22" rx="16" ry="7" fill={`url(#${id}-gloss)`} opacity="0.8" />

      {/* label */}
      <text
        x="32"
        y="39"
        textAnchor="middle"
        fontFamily="'Inter', 'Arial Black', sans-serif"
        fontWeight="900"
        fontSize={label.length >= 4 ? 18 : label.length >= 3 ? 21 : 24}
        fill={p.text}
        stroke={p.textShadow}
        strokeWidth="0.9"
        paintOrder="stroke"
        filter={`url(#${id}-textShadow)`}
      >
        {label}
      </text>
    </svg>
  );
});

export const CHIP_VARIANTS: Record<number, keyof typeof PALETTES> = {
  1000: "blue",
  2000: "red",
  5000: "green",
  10000: "gold",
};

export function chipLabelFor(amount: number) {
  return amount >= 1000 ? `${amount / 1000}K` : String(amount);
}