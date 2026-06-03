import type { VipRank } from "./vip.shared";
import bronceAsset from "@/assets/vip/BRONCE.svg.asset.json";
import plataAsset from "@/assets/vip/PLATA.svg.asset.json";
import oroAsset from "@/assets/vip/ORO.svg.asset.json";
import platinoAsset from "@/assets/vip/PLATINO.svg.asset.json";
import diamanteAsset from "@/assets/vip/DIAMANTE.svg.asset.json";
import maestroAsset from "@/assets/vip/MAESTRO.svg.asset.json";
import leyendaAsset from "@/assets/vip/LEYENDA.svg.asset.json";

/** Big illustrated insignia (Adobe Illustrator art) per rank. */
export const RANK_ART: Record<VipRank, string> = {
  bronce: bronceAsset.url,
  plata: plataAsset.url,
  oro: oroAsset.url,
  platino: platinoAsset.url,
  diamante: diamanteAsset.url,
  maestro: maestroAsset.url,
  leyenda: leyendaAsset.url,
};

/**
 * Per-rank premium card theme. Every card mixes the casino's purple base
 * with the rank's signature accent, plus a glow + decorative ring color.
 * Tailwind class fragments are kept centralized so cards stay consistent
 * across Perfil, VipCard and the VIP page.
 */
export type VipCardTheme = {
  /** Background gradient classes for the main identity/header card. */
  cardBg: string;
  /** Decorative top border tint (very subtle hairline). */
  borderClass: string;
  /** Outer glow color (used in style boxShadow). */
  glow: string;
  /** Inner soft ring around the SVG insignia. */
  insigniaRing: string;
  /** Accent text for rank label / highlights. */
  accentText: string;
  /** Small chip background for the rank name pill. */
  chipBg: string;
  /** XP progress bar fill gradient. */
  barGradient: string;
  /** Subtle radial highlight color used behind the insignia. */
  haloColor: string;
};

export const VIP_CARD_THEME: Record<VipRank, VipCardTheme> = {
  bronce: {
    cardBg: "from-[#2a0f3d] via-[#1a0a2e] to-[#3a1d10]",
    borderClass: "border-amber-600/50",
    glow: "rgba(180, 83, 9, 0.45)",
    insigniaRing: "ring-amber-600/40",
    accentText: "text-amber-300",
    chipBg: "bg-amber-600/15 border-amber-500/40 text-amber-200",
    barGradient: "from-purple-600 via-amber-500 to-amber-300",
    haloColor: "rgba(217, 119, 6, 0.35)",
  },
  plata: {
    cardBg: "from-[#2a0f3d] via-[#1a0a2e] to-[#2b3340]",
    borderClass: "border-slate-300/50",
    glow: "rgba(203, 213, 225, 0.45)",
    insigniaRing: "ring-slate-200/40",
    accentText: "text-slate-100",
    chipBg: "bg-slate-300/15 border-slate-300/40 text-slate-100",
    barGradient: "from-purple-600 via-slate-300 to-white",
    haloColor: "rgba(203, 213, 225, 0.35)",
  },
  oro: {
    cardBg: "from-[#2a0f3d] via-[#1a0a2e] to-[#3d2f0a]",
    borderClass: "border-yellow-400/60",
    glow: "rgba(250, 204, 21, 0.5)",
    insigniaRing: "ring-yellow-300/40",
    accentText: "text-yellow-300",
    chipBg: "bg-yellow-500/15 border-yellow-400/50 text-yellow-200",
    barGradient: "from-purple-600 via-yellow-400 to-yellow-200",
    haloColor: "rgba(250, 204, 21, 0.4)",
  },
  platino: {
    cardBg: "from-[#2a0f3d] via-[#1a0a2e] to-[#0a3340]",
    borderClass: "border-cyan-300/60",
    glow: "rgba(103, 232, 249, 0.5)",
    insigniaRing: "ring-cyan-200/40",
    accentText: "text-cyan-200",
    chipBg: "bg-cyan-400/15 border-cyan-300/50 text-cyan-100",
    barGradient: "from-purple-600 via-cyan-300 to-white",
    haloColor: "rgba(103, 232, 249, 0.4)",
  },
  diamante: {
    cardBg: "from-[#2a0f3d] via-[#1a0a2e] to-[#0a2540]",
    borderClass: "border-sky-300/70",
    glow: "rgba(125, 211, 252, 0.55)",
    insigniaRing: "ring-sky-200/40",
    accentText: "text-sky-200",
    chipBg: "bg-sky-400/15 border-sky-300/50 text-sky-100",
    barGradient: "from-purple-600 via-sky-300 to-fuchsia-200",
    haloColor: "rgba(125, 211, 252, 0.45)",
  },
  maestro: {
    cardBg: "from-[#2a0f3d] via-[#1a0a2e] to-[#3a0a4d]",
    borderClass: "border-fuchsia-400/70",
    glow: "rgba(232, 121, 249, 0.55)",
    insigniaRing: "ring-fuchsia-300/40",
    accentText: "text-fuchsia-200",
    chipBg: "bg-fuchsia-500/15 border-fuchsia-400/50 text-fuchsia-100",
    barGradient: "from-purple-600 via-fuchsia-400 to-pink-200",
    haloColor: "rgba(232, 121, 249, 0.45)",
  },
  leyenda: {
    cardBg: "from-[#2a0f3d] via-[#1a0a2e] to-[#3d2400]",
    borderClass: "border-amber-300/80",
    glow: "rgba(251, 191, 36, 0.6)",
    insigniaRing: "ring-amber-200/50",
    accentText: "text-amber-200",
    chipBg: "bg-amber-400/15 border-amber-300/60 text-amber-100",
    barGradient: "from-purple-600 via-amber-400 to-yellow-200",
    haloColor: "rgba(251, 191, 36, 0.5)",
  },
};