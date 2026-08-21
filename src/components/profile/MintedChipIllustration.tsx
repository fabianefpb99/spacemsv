import { memo } from "react";

/**
 * Ficha de casino "acuñada" en perspectiva 3/4.
 * Construida con gradientes, biseles y máscaras (sin trazos planos):
 * canto exterior con insertos, cara interior grabada con busto en relieve,
 * especulares de vidrio y ficha secundaria desenfocada para dar profundidad.
 */
export const MintedChipIllustration = memo(function MintedChipIllustration({
  size = 96,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const u = "mci";
  const inserts = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        {/* canto / rim */}
        <radialGradient id={`${u}-rim`} cx="38%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#d9b6ff" />
          <stop offset="34%" stopColor="#a855f7" />
          <stop offset="72%" stopColor="#6b21a8" />
          <stop offset="100%" stopColor="#2e0b52" />
        </radialGradient>
        {/* canto lateral (grosor) */}
        <linearGradient id={`${u}-side`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4c1187" />
          <stop offset="55%" stopColor="#2a0a4d" />
          <stop offset="100%" stopColor="#160528" />
        </linearGradient>
        {/* cara interior */}
        <radialGradient id={`${u}-face`} cx="36%" cy="24%" r="88%">
          <stop offset="0%" stopColor="#c495ff" />
          <stop offset="42%" stopColor="#8b3ce0" />
          <stop offset="100%" stopColor="#3d0f70" />
        </radialGradient>
        {/* insertos lavanda */}
        <linearGradient id={`${u}-insert`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3e5ff" />
          <stop offset="60%" stopColor="#d8b4fe" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        {/* busto acuñado (hundido) */}
        <linearGradient id={`${u}-bust`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#f6ecff" />
          <stop offset="52%" stopColor="#d9bcff" />
          <stop offset="100%" stopColor="#9a6ae0" />
        </linearGradient>
        {/* especular de vidrio */}
        <linearGradient id={`${u}-glass`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="46%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="47%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${u}-arc`} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#f5d9ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${u}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#a855f7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}-shadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#150425" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#150425" stopOpacity="0" />
        </radialGradient>

        <clipPath id={`${u}-clip-face`}>
          <circle cx="58" cy="56" r="26" />
        </clipPath>
        <clipPath id={`${u}-clip-chip`}>
          <circle cx="58" cy="56" r="39" />
        </clipPath>
        <filter id={`${u}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* halo ambiental */}
      <circle cx="58" cy="56" r="56" fill={`url(#${u}-halo)`} />

      {/* sombra proyectada */}
      <ellipse cx="60" cy="102" rx="34" ry="7.5" fill={`url(#${u}-shadow)`} />

      {/* ficha secundaria (pila, desenfocada) */}
      <g opacity="0.5" filter={`url(#${u}-soft)`}>
        <circle cx="84" cy="72" r="30" fill="#4a1288" />
        <circle cx="84" cy="69" r="30" fill={`url(#${u}-rim)`} opacity="0.85" />
        <circle cx="84" cy="69" r="19" fill="#5b1ba3" opacity="0.9" />
      </g>

      {/* grosor del canto */}
      <circle cx="58" cy="62" r="39" fill={`url(#${u}-side)`} />

      {/* cuerpo principal */}
      <circle cx="58" cy="56" r="39" fill={`url(#${u}-rim)`} />

      {/* insertos radiales del canto */}
      <g clipPath={`url(#${u}-clip-chip)`}>
        {inserts.map((a) => (
          <g key={a} transform={`rotate(${a} 58 56)`}>
            <rect
              x="51.5"
              y="16"
              width="13"
              height="13.5"
              rx="3"
              fill={`url(#${u}-insert)`}
              opacity="0.92"
            />
            <rect
              x="51.5"
              y="16"
              width="13"
              height="3"
              rx="1.5"
              fill="#ffffff"
              opacity="0.35"
            />
          </g>
        ))}
      </g>

      {/* filete grabado alrededor de la cara */}
      <circle cx="58" cy="56" r="29.5" fill="#33096b" opacity="0.75" />
      <circle cx="58" cy="56" r="28" fill="#150430" opacity="0.5" />

      {/* cara interior */}
      <circle cx="58" cy="56" r="26" fill={`url(#${u}-face)`} />

      {/* micro-anillo de sombra interna (relieve) */}
      <circle
        cx="58"
        cy="56"
        r="25.2"
        fill="none"
        stroke="#1e0640"
        strokeOpacity="0.45"
        strokeWidth="1.6"
      />

      {/* busto acuñado */}
      <g clipPath={`url(#${u}-clip-face)`}>
        {/* sombra hundida del acuñado */}
        <g transform="translate(0.9,1.2)" opacity="0.55">
          <circle cx="57" cy="47.5" r="8.6" fill="#22084a" />
          <path
            d="M40.5 82c0-9.9 7.4-17.6 16.5-17.6S73.5 72.1 73.5 82z"
            fill="#22084a"
          />
        </g>
        {/* relieve claro */}
        <circle cx="56.2" cy="46.6" r="8.6" fill={`url(#${u}-bust)`} />
        <path
          d="M39.7 82c0-9.9 7.4-17.6 16.5-17.6S72.7 72.1 72.7 82z"
          fill={`url(#${u}-bust)`}
        />
        {/* luz de canto superior del relieve */}
        <path
          d="M49.3 41.2a8.6 8.6 0 0 1 12.4-.6"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* especular de vidrio sobre la cara */}
        <circle cx="58" cy="56" r="26" fill={`url(#${u}-glass)`} />
      </g>

      {/* arco especular en el borde superior */}
      <path
        d="M25.5 40.5A38 38 0 0 1 84 33.5"
        fill="none"
        stroke={`url(#${u}-arc)`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* reflejo inferior tenue */}
      <path
        d="M33 82.5A37 37 0 0 0 79 84"
        fill="none"
        stroke="#e9d5ff"
        strokeOpacity="0.22"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* destellos */}
      <path
        d="M96 22c.9 6.2 1.4 6.7 7.6 7.6-6.2.9-6.7 1.4-7.6 7.6-.9-6.2-1.4-6.7-7.6-7.6 6.2-.9 6.7-1.4 7.6-7.6z"
        fill="#f5e9ff"
        opacity="0.95"
      />
      <path
        d="M20 18c.6 4 .9 4.3 4.9 4.9-4 .6-4.3.9-4.9 4.9-.6-4-.9-4.3-4.9-4.9 4-.6 4.3-.9 4.9-4.9z"
        fill="#e9d5ff"
        opacity="0.7"
      />
      <circle cx="106" cy="52" r="2" fill="#f0abfc" opacity="0.8" />
      <circle cx="14" cy="70" r="1.5" fill="#d8b4fe" opacity="0.6" />
    </svg>
  );
});
