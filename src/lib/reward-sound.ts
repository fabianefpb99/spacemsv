/**
 * Plays a short "coin reward" jingle using Web Audio (no asset required).
 * Safe to call from a user gesture (button click).
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function ping(ac: AudioContext, freq: number, start: number, dur = 0.18, gain = 0.18) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playRewardSound() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  // Coin-like ascending arpeggio
  ping(ac, 880, t + 0.00, 0.12, 0.16);
  ping(ac, 1175, t + 0.08, 0.14, 0.18);
  ping(ac, 1568, t + 0.18, 0.22, 0.20);
  ping(ac, 2093, t + 0.30, 0.28, 0.18);
}