/**
 * Shared, pure (client-safe) filler logic for ranking + last wins.
 * No server-only imports here so both server functions and the
 * browser bundle can use it.
 */

export const FILLER_USERNAMES: string[] = [
  "luna_84", "kr1tyk", "andrxs07", "mariana.r", "betkingco",
  "daniela.m", "santi.cruz", "valeria_88", "jhonatan.q", "camilo.bet",
  "nayeli.x", "alejo_777", "carolina_v", "diegoz", "manu_galindo",
  "isa.b", "tato_99", "laura.fdz", "kevin.ace", "sofia_pro",
  "monica.r", "rafa_85", "yulianamx", "elkin.bet", "natalia_c",
  "jorge.win", "vivi.rivera", "fabio_jr", "salomon.k", "milena_07",
];

export const FILLER_AVATAR_KEYS = [
  "avatar-1", "avatar-2", "avatar-3", "avatar-4",
  "avatar-5", "avatar-6", "avatar-7", "avatar-8",
];

export const FILLER_GAMES = ["Spaceman", "Mines", "Dice", "Blackjack", "Ruleta", "Slot"];

export type FillerEntry = {
  user_id: string;
  username: string;
  avatar_key: string | null;
  net_amount: number;
};

export function getColombiaParts(nowMs: number = Date.now()): {
  dateKey: string;
  hour: number;
  minutesOfDay: number;
} {
  // Colombia is UTC-5, no DST.
  const now = new Date(nowMs - 5 * 60 * 60 * 1000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return {
    dateKey: `${y}-${m}-${d}`,
    hour: now.getUTCHours(),
    minutesOfDay: now.getUTCHours() * 60 + now.getUTCMinutes(),
  };
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleTake<T>(arr: readonly T[], n: number, rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

/**
 * Smooth progress factor over the Colombia day:
 *  - before 06:00 → 0.25 (overnight low activity carry-over)
 *  - 06:00 → 0.25, 23:00 → 1.0 (linear ramp)
 */
export function progressFactor(hour: number): number {
  if (hour < 6) return 0.25;
  if (hour >= 23) return 1.0;
  return 0.25 + ((hour - 6) / (23 - 6)) * 0.75;
}

export function generateFillers(
  kind: "general" | "arena",
  count: number,
  dateKey: string,
  hour: number,
): FillerEntry[] {
  const rnd = mulberry32(hashString(`${dateKey}:${kind}`));
  const names = shuffleTake(FILLER_USERNAMES, count, rnd);
  const avatars = shuffleTake(FILLER_AVATAR_KEYS, count, rnd);

  const range =
    kind === "general"
      ? { min: 80_000, max: 650_000 }
      : { min: 30_000, max: 220_000 };

  const factor = progressFactor(hour);

  const out: FillerEntry[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1);
    const jitter = 0.94 + rnd() * 0.12;
    const baseMax = range.max - (range.max - range.min) * t;
    const max = baseMax * jitter;
    const current = Math.max(1_000, Math.round((max * factor) / 100) * 100);
    out.push({
      user_id: `filler:${kind}:${i}:${dateKey}`,
      username: names[i] ?? `player_${i + 1}`,
      avatar_key: avatars[i % avatars.length] ?? null,
      net_amount: current,
    });
  }
  return out;
}

/* ───────── Recent filler wins (for "Últimas ganancias" panel) ──────── */

export type FillerWin = {
  id: string;
  username: string;
  avatar_key: string;
  avatar_url?: string | null;
  game: string;
  amount: number;
  mult: number;
  ageSec: number; // seconds ago, deterministic per bucket
};

/**
 * Deterministic-but-rotating recent wins. Bucketed every 25 seconds so
 * the panel refreshes naturally while still being shareable across
 * tabs. Amounts are sized so the per-event payouts are consistent with
 * each filler's cumulative `net_amount` for the day.
 */
export function generateRecentFillerWins(
  count: number,
  nowMs: number = Date.now(),
): FillerWin[] {
  const { dateKey, hour, minutesOfDay } = getColombiaParts(nowMs);
  const bucket = Math.floor(nowMs / 25_000); // rotate every 25s
  const seed = hashString(`${dateKey}:wins:${bucket}`);
  const rnd = mulberry32(seed);

  // Use the same daily roster so names line up with ranking.
  const generalFillers = generateFillers("general", 5, dateKey, hour);
  const arenaFillers = generateFillers("arena", 10, dateKey, hour);
  const roster: FillerEntry[] = [...generalFillers, ...arenaFillers];

  // Average per-event win = a slice of their current daily net amount.
  // Earlier in the day → fewer events so per-event size stays plausible.
  const eventsPerHour = 4;
  const totalEventsToday = Math.max(8, Math.round((minutesOfDay / 60) * eventsPerHour));

  const wins: FillerWin[] = [];

  // Shuffle the full roster so EVERY filler gets events (no weighting —
  // that caused the same 3-4 top earners to dominate the panel).
  // If count > roster.length we wrap around with a second shuffled pass.
  const order: number[] = [];
  while (order.length < count) {
    const idxs = Array.from({ length: roster.length }, (_, i) => i);
    // Fisher-Yates with our seeded rng
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    order.push(...idxs);
  }

  for (let i = 0; i < count; i++) {
    const idx = order[i];
    const f = roster[idx];
    const game = FILLER_GAMES[Math.floor(rnd() * FILLER_GAMES.length)];

    // Per-game distribution. Multipliers are skewed LOW (low values much
    // more common than high) using a power curve, and amounts have a
    // realistic cap per game so we don't show absurd payouts in Slot.
    const isSlot = game === "Slot";
    const isMines = game === "Mines";
    const isBlackjack = game === "Blackjack";
    const isRuleta = game === "Ruleta";

    // Bias-to-low multiplier: rnd^2.6 → ~70% of events under ~1.6x.
    let lowBias = Math.pow(rnd(), 2.6);
    let multMin = 1.05;
    let multMax = 4.5;
    if (isSlot) { multMin = 1.10; multMax = 6.0; }
    else if (isMines) { multMin = 1.10; multMax = 3.2; lowBias = Math.pow(rnd(), 3.2); }
    else if (isBlackjack) { multMin = 1.50; multMax = 2.5; }
    else if (isRuleta) { multMin = 2.00; multMax = 14.0; }
    const mult = multMin + lowBias * (multMax - multMin);

    // Per-event payout: scaled down for Slot to stay believable.
    const base = f.net_amount / totalEventsToday;
    const jitter = 0.4 + rnd() * 1.2; // 0.4× to 1.6×
    let amount = Math.max(500, Math.round((base * jitter) / 100) * 100);
    // Hard caps per game so we never show, e.g., 750k on a slot spin.
    const cap = isSlot ? 180_000 : isMines ? 120_000 : isBlackjack ? 220_000 : isRuleta ? 600_000 : 450_000;
    if (amount > cap) amount = Math.round((cap * (0.55 + rnd() * 0.45)) / 100) * 100;
    const ageSec = Math.floor(rnd() * 240); // 0–4 min ago

    wins.push({
      id: `${bucket}:${i}:${idx}`,
      username: f.username,
      avatar_key: f.avatar_key ?? FILLER_AVATAR_KEYS[i % FILLER_AVATAR_KEYS.length],
      game,
      amount,
      mult: Math.round(mult * 100) / 100,
      ageSec,
    });
  }

  // Sort newest first.
  wins.sort((a, b) => a.ageSec - b.ageSec);
  return wins;
}