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
    masterGain.gain.value = muted ? 0 : 0.9;
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
    masterGain.gain.linearRampToValueAtTime(m ? 0 : 0.9, t + 0.2);
  }
}

export function isMuted() {
  return muted;
}

// ---- Crash thud (soft descending boom) ----

export function playCrashSound() {
  const c = getCtx();
  if (!c || muted || !masterGain) return;

  const now = c.currentTime;

  // Main thud: sine sweep down + slight overdrive via triangle
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.38);

  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(0.18, now + 0.03);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  // Soft filtered noise for texture
  const noiseBuf = makeNoiseBuffer(c);
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = noiseBuf;

  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(600, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 0.35);
  noiseFilter.Q.value = 0.5;

  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.40);

  osc.connect(oscGain).connect(masterGain);
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.45);
  noiseSrc.start(now);
  noiseSrc.stop(now + 0.42);
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