import {
  Award,
  Crown,
  Gem,
  Shield,
  Sparkles,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type VipRank =
  | "bronce"
  | "plata"
  | "oro"
  | "platino"
  | "diamante"
  | "maestro"
  | "leyenda";

export type VipSub = "V" | "IV" | "III" | "II" | "I";

export type VipLevelRow = {
  level: number;
  rank: VipRank;
  sub_division: VipSub;
  xp_required: number;
  reward_amount: number;
};

export const RANK_ORDER: VipRank[] = [
  "bronce",
  "plata",
  "oro",
  "platino",
  "diamante",
  "maestro",
  "leyenda",
];

export const RANK_RANGES: Record<VipRank, { from: number; to: number }> = {
  bronce: { from: 1, to: 15 },
  plata: { from: 16, to: 30 },
  oro: { from: 31, to: 45 },
  platino: { from: 46, to: 60 },
  diamante: { from: 61, to: 75 },
  maestro: { from: 76, to: 90 },
  leyenda: { from: 91, to: 100 },
};

export const RANK_META: Record<
  VipRank,
  {
    label: string;
    short: string;
    icon: LucideIcon;
    // Tailwind color fragments — kept centralized here
    text: string;
    border: string;
    ringSoft: string;
    bgSoft: string;
    gradient: string; // for badge background
    glow: string;     // box-shadow color
  }
> = {
  bronce: {
    label: "Bronce",
    short: "BRZ",
    icon: Shield,
    text: "text-amber-300",
    border: "border-amber-500/50",
    ringSoft: "ring-amber-500/30",
    bgSoft: "bg-amber-500/10",
    gradient: "from-amber-700 via-amber-500 to-amber-300",
    glow: "rgba(217, 119, 6, 0.45)",
  },
  plata: {
    label: "Plata",
    short: "PLA",
    icon: Award,
    text: "text-slate-200",
    border: "border-slate-300/50",
    ringSoft: "ring-slate-300/30",
    bgSoft: "bg-slate-300/10",
    gradient: "from-slate-500 via-slate-300 to-white",
    glow: "rgba(203, 213, 225, 0.5)",
  },
  oro: {
    label: "Oro",
    short: "ORO",
    icon: Star,
    text: "text-yellow-300",
    border: "border-yellow-400/60",
    ringSoft: "ring-yellow-400/30",
    bgSoft: "bg-yellow-500/10",
    gradient: "from-yellow-600 via-yellow-400 to-yellow-200",
    glow: "rgba(250, 204, 21, 0.55)",
  },
  platino: {
    label: "Platino",
    short: "PLT",
    icon: Sparkles,
    text: "text-cyan-200",
    border: "border-cyan-300/60",
    ringSoft: "ring-cyan-300/30",
    bgSoft: "bg-cyan-400/10",
    gradient: "from-cyan-500 via-cyan-200 to-white",
    glow: "rgba(103, 232, 249, 0.55)",
  },
  diamante: {
    label: "Diamante",
    short: "DMD",
    icon: Gem,
    text: "text-sky-200",
    border: "border-sky-300/70",
    ringSoft: "ring-sky-300/30",
    bgSoft: "bg-sky-400/10",
    gradient: "from-sky-500 via-sky-300 to-fuchsia-200",
    glow: "rgba(125, 211, 252, 0.6)",
  },
  maestro: {
    label: "Maestro",
    short: "MST",
    icon: Trophy,
    text: "text-fuchsia-200",
    border: "border-fuchsia-400/70",
    ringSoft: "ring-fuchsia-400/30",
    bgSoft: "bg-fuchsia-500/10",
    gradient: "from-fuchsia-700 via-fuchsia-400 to-pink-200",
    glow: "rgba(232, 121, 249, 0.6)",
  },
  leyenda: {
    label: "Leyenda",
    short: "LGD",
    icon: Crown,
    text: "text-rose-200",
    border: "border-rose-400/80",
    ringSoft: "ring-rose-400/40",
    bgSoft: "bg-rose-500/10",
    gradient: "from-rose-700 via-orange-400 to-yellow-200",
    glow: "rgba(251, 113, 133, 0.7)",
  },
};

export const SUB_ORDER: VipSub[] = ["V", "IV", "III", "II", "I"];

export function rankForLevel(level: number): VipRank {
  for (const r of RANK_ORDER) {
    const range = RANK_RANGES[r];
    if (level >= range.from && level <= range.to) return r;
  }
  return "bronce";
}

/** Compute subdivision for a given level (mirrors the SQL seed math). */
export function subForLevel(level: number): VipSub {
  const r = rankForLevel(level);
  const range = RANK_RANGES[r];
  const size = range.to - range.from + 1;
  const rel = level - range.from; // 0-based
  const idx = Math.min(4, Math.floor((rel * 5) / size));
  return SUB_ORDER[idx];
}

export type VipProgress = {
  currentLevel: number;       // 0..cap
  displayLevel: number;       // max(1, currentLevel) for label
  rank: VipRank;
  sub: VipSub;
  totalXp: number;
  currentLevelXp: number;     // xp acumulado de inicio del nivel actual
  nextLevelXp: number;        // xp acumulado para llegar al siguiente
  xpIntoLevel: number;
  xpForNextLevel: number;
  pct: number;                // 0..100
  isMax: boolean;
};

export function computeProgress(
  totalXp: number,
  levels: VipLevelRow[],
  cap = 100,
): VipProgress {
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  const capLvl = Math.min(cap, sorted.length);
  let current = 0;
  for (const row of sorted) {
    if (row.level > capLvl) break;
    if (totalXp >= row.xp_required) current = row.level;
    else break;
  }
  const isMax = current >= capLvl;
  const displayLevel = Math.max(1, current);
  const rank = rankForLevel(displayLevel);
  const sub = subForLevel(displayLevel);

  if (isMax) {
    const cur = sorted.find((r) => r.level === capLvl)!;
    return {
      currentLevel: capLvl,
      displayLevel: capLvl,
      rank,
      sub,
      totalXp,
      currentLevelXp: cur.xp_required,
      nextLevelXp: cur.xp_required,
      xpIntoLevel: 0,
      xpForNextLevel: 0,
      pct: 100,
      isMax: true,
    };
  }

  const currentXp = current === 0 ? 0 : sorted.find((r) => r.level === current)!.xp_required;
  const next = sorted.find((r) => r.level === current + 1)!;
  const xpInto = Math.max(0, totalXp - currentXp);
  const xpFor = Math.max(1, next.xp_required - currentXp);
  const pct = Math.max(0, Math.min(100, (xpInto / xpFor) * 100));

  return {
    currentLevel: current,
    displayLevel,
    rank,
    sub,
    totalXp,
    currentLevelXp: currentXp,
    nextLevelXp: next.xp_required,
    xpIntoLevel: xpInto,
    xpForNextLevel: xpFor,
    pct,
    isMax: false,
  };
}

export function formatXp(n: number): string {
  return new Intl.NumberFormat("es-CO").format(Math.floor(n));
}

export function rankLabel(rank: VipRank, sub: VipSub): string {
  return `${RANK_META[rank].label} ${sub}`;
}
