// Lightweight Web Audio engine for SpacemanGame.
// - Ambient electro/casino loop (bass + arpeggio + soft pad)
// - Flight whoosh: filtered pink-noise that breathes while flying
// No external assets required.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

// Ambient loop nodes
let ambientGain: GainNode | null = null;
let ambientTimer: number | null = null;
let ambientStep = 0;

// Flight nodes
let flightSource: AudioBufferSourceNode | null = null;
let flightGain: GainNode | null = null;
let flightFilter: BiquadFilterNode | null = null;
let flightLfo: OscillatorNode | null = null;
let flightLfoGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1.4;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// ---- Ambient loop (electro / casino vibe) ----

// Minor pentatonic-ish arp in A
const ARP_NOTES = [220.0, 261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 261.63];
const BASS_NOTE = 55.0; // A1
const STEP_MS = 260;

function playArpNote(c: AudioContext, freq: number, time: number) {
  if (!ambientGain) return;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.08, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 2200;
  o.connect(f).connect(g).connect(ambientGain);
  o.start(time);
  o.stop(time + 0.25);
}

function playBassNote(c: AudioContext, time: number) {
  if (!ambientGain) return;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = BASS_NOTE;
  const g = c.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.12, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 380;
  o.connect(f).connect(g).connect(ambientGain);
  o.start(time);
  o.stop(time + 0.4);
}

function startPad(c: AudioContext) {
  if (!ambientGain) return;
  // Two slightly detuned saws through a slow lowpass for a soft pad
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  o1.type = "sawtooth";
  o2.type = "sawtooth";
  o1.frequency.value = 110;
  o2.frequency.value = 110 * 1.005;
  const pg = c.createGain();
  pg.gain.value = 0.025;
  const pf = c.createBiquadFilter();
  pf.type = "lowpass";
  pf.frequency.value = 700;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoG = c.createGain();
  lfoG.gain.value = 250;
  lfo.connect(lfoG).connect(pf.frequency);
  o1.connect(pf);
  o2.connect(pf);
  pf.connect(pg).connect(ambientGain);
  o1.start();
  o2.start();
  lfo.start();
}

export function startAmbient() {
  const c = getCtx();
  if (!c || ambientGain) return;
  ambientGain = c.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(masterGain!);
  ambientGain.gain.linearRampToValueAtTime(0.5, c.currentTime + 1.2);

  startPad(c);
  ambientStep = 0;
  const tick = () => {
    if (!ctx || !ambientGain) return;
    const now = ctx.currentTime;
    const note = ARP_NOTES[ambientStep % ARP_NOTES.length];
    playArpNote(ctx, note, now);
    if (ambientStep % 4 === 0) playBassNote(ctx, now);
    ambientStep++;
  };
  tick();
  ambientTimer = window.setInterval(tick, STEP_MS);
}

// ---- Flight whoosh ----

function makeNoiseBuffer(c: AudioContext): AudioBuffer {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // Pinkish noise via simple low-passed white noise
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

export function startFlight() {
  const c = getCtx();
  if (!c || flightSource) return;
  flightSource = c.createBufferSource();
  flightSource.buffer = makeNoiseBuffer(c);
  flightSource.loop = true;

  flightFilter = c.createBiquadFilter();
  flightFilter.type = "lowpass";
  flightFilter.frequency.value = 420;
  flightFilter.Q.value = 0.4;

  flightGain = c.createGain();
  flightGain.gain.value = 0;
  // Very soft "woooop" — slow fade-in
  flightGain.gain.linearRampToValueAtTime(0.045, c.currentTime + 1.2);

  // LFO to gently sweep the filter -> "breathing" whoosh
  flightLfo = c.createOscillator();
  flightLfo.frequency.value = 0.18;
  flightLfoGain = c.createGain();
  flightLfoGain.gain.value = 180;
  flightLfo.connect(flightLfoGain).connect(flightFilter.frequency);

  flightSource.connect(flightFilter).connect(flightGain).connect(masterGain!);
  flightSource.start();
  flightLfo.start();
}

export function stopFlight() {
  const c = ctx;
  if (!c || !flightSource || !flightGain) return;
  const t = c.currentTime;
  flightGain.gain.cancelScheduledValues(t);
  flightGain.gain.setValueAtTime(flightGain.gain.value, t);
  flightGain.gain.linearRampToValueAtTime(0, t + 0.25);
  const src = flightSource;
  const lfo = flightLfo;
  setTimeout(() => {
    try { src.stop(); } catch {}
    try { lfo?.stop(); } catch {}
  }, 300);
  flightSource = null;
  flightLfo = null;
  flightGain = null;
  flightFilter = null;
  flightLfoGain = null;
}

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain && ctx) {
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.linearRampToValueAtTime(m ? 0 : 1.4, t + 0.2);
  }
}

export function isMuted() {
  return muted;
}

// ---- Crash sound (cinematic emotional explosion) ----

export function playCrashSound() {
  const c = getCtx();
  if (!c || muted || !masterGain) return;

  const now = c.currentTime;

  // Layer 1 — Deep sub-bass impact (sine, fast punch then slow decay)
  const subOsc = c.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(55, now);
  subOsc.frequency.exponentialRampToValueAtTime(18, now + 0.55);
  const subGain = c.createGain();
  subGain.gain.setValueAtTime(0, now);
  subGain.gain.linearRampToValueAtTime(0.35, now + 0.015);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  subOsc.connect(subGain).connect(masterGain);
  subOsc.start(now);
  subOsc.stop(now + 0.95);

  // Layer 2 — Descending emotional drone (triangle + filter sweep)
  const droneOsc = c.createOscillator();
  droneOsc.type = "triangle";
  droneOsc.frequency.setValueAtTime(220, now);
  droneOsc.frequency.exponentialRampToValueAtTime(35, now + 0.65);
  const droneFilter = c.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.setValueAtTime(2500, now);
  droneFilter.frequency.exponentialRampToValueAtTime(120, now + 0.7);
  droneFilter.Q.value = 1.2;
  const droneGain = c.createGain();
  droneGain.gain.setValueAtTime(0, now);
  droneGain.gain.linearRampToValueAtTime(0.16, now + 0.04);
  droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
  droneOsc.connect(droneFilter).connect(droneGain).connect(masterGain);
  droneOsc.start(now);
  droneOsc.stop(now + 0.8);

  // Layer 3 — Soft noise texture (crumbling debris)
  const noiseBuf = makeNoiseBuffer(c);
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(900, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(60, now + 0.5);
  noiseFilter.Q.value = 0.6;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.07, now + 0.025);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(masterGain);
  noiseSrc.start(now);
  noiseSrc.stop(now + 0.6);

  // Layer 4 — Emotional shimmer / high metallic tail
  const shimmerOsc = c.createOscillator();
  shimmerOsc.type = "sine";
  shimmerOsc.frequency.setValueAtTime(1200, now);
  shimmerOsc.frequency.exponentialRampToValueAtTime(300, now + 0.45);
  const shimmerFilter = c.createBiquadFilter();
  shimmerFilter.type = "bandpass";
  shimmerFilter.frequency.setValueAtTime(2000, now);
  shimmerFilter.frequency.exponentialRampToValueAtTime(400, now + 0.5);
  shimmerFilter.Q.value = 2.0;
  const shimmerGain = c.createGain();
  shimmerGain.gain.setValueAtTime(0, now + 0.06);
  shimmerGain.gain.linearRampToValueAtTime(0.04, now + 0.1);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  shimmerOsc.connect(shimmerFilter).connect(shimmerGain).connect(masterGain);
  shimmerOsc.start(now + 0.06);
  shimmerOsc.stop(now + 0.55);

  // Layer 5 — Tiny reverb-like echo delay (simple feedback delay)
  const delay = c.createDelay(0.4);
  delay.delayTime.value = 0.18;
  const delayGain = c.createGain();
  delayGain.gain.value = 0.18;
  const delayFeedback = c.createGain();
  delayFeedback.gain.value = 0.25;
  const echoOsc = c.createOscillator();
  echoOsc.type = "sine";
  echoOsc.frequency.setValueAtTime(90, now + 0.15);
  echoOsc.frequency.exponentialRampToValueAtTime(28, now + 0.6);
  const echoGain = c.createGain();
  echoGain.gain.setValueAtTime(0, now + 0.15);
  echoGain.gain.linearRampToValueAtTime(0.08, now + 0.18);
  echoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

  echoOsc.connect(echoGain).connect(delay).connect(masterGain);
  echoGain.connect(delayGain).connect(delay).connect(masterGain);
  delay.connect(delayFeedback).connect(delay);

  echoOsc.start(now + 0.15);
  echoOsc.stop(now + 0.7);
}

// ---- Cash-out chime (soft gain sensation) ----

export function playCashoutSound() {
  const c = getCtx();
  if (!c || muted) return;
  const mg = masterGain;
  if (!mg) return;

  const now = c.currentTime;

  // Pleasant two-tone chime: A5 -> C#6 (major third up)
  const freqs = [880, 1100];
  const delays = [0, 0.08];
  const durations = [0.55, 0.45];
  const noteGains = [0.055, 0.045];

  freqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    // Subtle vibrato for shimmer
    const vib = c.createOscillator();
    vib.frequency.value = 5.5;
    const vibGain = c.createGain();
    vibGain.gain.value = 2.5;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const g = c.createGain();
    g.gain.setValueAtTime(0, now + delays[i]);
    g.gain.linearRampToValueAtTime(noteGains[i], now + delays[i] + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + delays[i] + durations[i]);

    // Tiny high-shelf sparkle
    const shelf = c.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 3000;
    shelf.gain.value = 6;

    osc.connect(shelf).connect(g).connect(mg);

    osc.start(now + delays[i]);
    osc.stop(now + delays[i] + durations[i] + 0.05);
    vib.start(now + delays[i]);
    vib.stop(now + delays[i] + durations[i]);
  });

  // Very soft filtered noise "sparkle" tail
  const noiseBuf = makeNoiseBuffer(c);
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = noiseBuf;

  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 5000;
  noiseFilter.Q.value = 1.2;

  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.015, now + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(mg);
  noiseSrc.start(now);
  noiseSrc.stop(now + 0.35);
}

// ---- Reveal sound (satisfying gem chime for Mines) ----
// Bright ascending bell-like ping with a soft sparkle tail. Pitch rises
// slightly with each pick to reward the player and push them to continue.
let revealStreak = 0;

// ---- Dice roll sound (shake + table bounce) ----
// Simulates two plastic dice rattling in a closed hand, then a few harder
// bounces as they hit the table and settle. Built from short noise bursts:
//   - Shake phase: dense, rapid bright clicks (plastic-on-plastic).
//   - Bounce phase: a few stronger clicks with low-end body (hitting surface).
//   - Settle: a final quiet tick.
export function playDiceRollSound(durationMs = 2000) {
export function playDiceRollSound(_durationMs = 2000) {
  if (muted) return;
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio("/sounds/dice-roll.mp3");
    audio.volume = 0.9;
    void audio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function resetRevealStreak() {
  revealStreak = 0;
}
export function playRevealSound() {
  const c = getCtx();
  if (!c || muted || !masterGain) return;
  const now = c.currentTime;
  const step = Math.min(revealStreak, 12);
  revealStreak++;
  const base = 660 * Math.pow(2, step / 12); // semitone up per pick

  // Bell tone
  const o1 = c.createOscillator();
  o1.type = "sine";
  o1.frequency.setValueAtTime(base, now);
  const g1 = c.createGain();
  g1.gain.setValueAtTime(0, now);
  g1.gain.linearRampToValueAtTime(0.22, now + 0.008);
  g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  o1.connect(g1).connect(masterGain);
  o1.start(now); o1.stop(now + 0.5);

  // Harmonic shimmer
  const o2 = c.createOscillator();
  o2.type = "triangle";
  o2.frequency.setValueAtTime(base * 2, now);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.09, now + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  o2.connect(g2).connect(masterGain);
  o2.start(now); o2.stop(now + 0.4);

  // Sparkle high
  const o3 = c.createOscillator();
  o3.type = "sine";
  o3.frequency.setValueAtTime(base * 3, now + 0.02);
  const g3 = c.createGain();
  g3.gain.setValueAtTime(0, now + 0.02);
  g3.gain.linearRampToValueAtTime(0.05, now + 0.04);
  g3.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  o3.connect(g3).connect(masterGain);
  o3.start(now + 0.02); o3.stop(now + 0.3);

  // Tiny click for tactility
  const click = c.createOscillator();
  click.type = "square";
  click.frequency.setValueAtTime(1800, now);
  const cg = c.createGain();
  cg.gain.setValueAtTime(0, now);
  cg.gain.linearRampToValueAtTime(0.05, now + 0.003);
  cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  click.connect(cg).connect(masterGain);
  click.start(now); click.stop(now + 0.06);
}