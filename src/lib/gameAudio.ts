// Lightweight Web Audio engine for SpacemanGame.
// - Ambient electro/casino loop (bass + arpeggio + soft pad)
// - Flight whoosh: filtered pink-noise that breathes while flying
// No external assets required.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let visibilityHooked = false;

// Ambient loop nodes
let ambientGain: GainNode | null = null;
let ambientTimer: number | null = null;
let ambientStep = 0;

// Blackjack lounge ambient
let bjGain: GainNode | null = null;
let bjTimer: number | null = null;
let bjStep = 0;

// ---- HTML5 background track manager ----
// Single active background track at a time. When a new game mounts and calls
// setBackgroundTrack(), the previous track is fully disposed (paused, src
// cleared, references dropped) so it cannot be resurrected by visibility/
// focus listeners. A single global visibility listener pauses/resumes only
// the currently-registered track.
type ActiveTrack = { audio: HTMLAudioElement; wasPlaying: boolean };
let activeTrack: ActiveTrack | null = null;
let trackVisHooked = false;

function hookTrackVisibility() {
  if (trackVisHooked || typeof document === "undefined") return;
  trackVisHooked = true;
  const pauseTrack = () => {
    if (!activeTrack) return;
    activeTrack.wasPlaying = !activeTrack.audio.paused;
    try { activeTrack.audio.pause(); } catch {}
  };
  const resumeTrack = () => {
    if (!activeTrack || muted || !activeTrack.wasPlaying) return;
    activeTrack.audio.play().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseTrack(); else resumeTrack();
  });
  window.addEventListener("pagehide", pauseTrack);
  window.addEventListener("blur", pauseTrack);
  window.addEventListener("focus", () => { if (!document.hidden) resumeTrack(); });
}

export function setBackgroundTrack(
  url: string,
  opts: { volume?: number; loop?: boolean } = {},
): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  hookTrackVisibility();
  clearBackgroundTrack();
  const audio = new Audio(url);
  audio.loop = opts.loop ?? true;
  audio.volume = opts.volume ?? 0.1;
  audio.muted = muted;
  activeTrack = { audio, wasPlaying: true };
  return audio;
}

export function clearBackgroundTrack() {
  if (!activeTrack) return;
  const { audio } = activeTrack;
  try { audio.pause(); } catch {}
  try { audio.src = ""; audio.load(); } catch {}
  activeTrack = null;
}

export function getBackgroundTrack(): HTMLAudioElement | null {
  return activeTrack?.audio ?? null;
}

// Broadcast a stop signal that module-level SFX pools (e.g. Mines coin pool)
// can listen to so they pause and reset themselves when the user leaves a
// game.
export const AUDIO_STOP_ALL_EVENT = "betspace:audio:stop-all";

/**
 * Hard reset of every audio source in the app. Called by each game on mount
 * to guarantee that no stray track or SFX from a previous game survives.
 */
export function stopAllGameAudio() {
  clearBackgroundTrack();
  try { stopFlight(); } catch {}
  try { stopBlackjackAmbient(); } catch {}
  try { stopAmbient(); } catch {}
  try { stopChickenBgMusic(); } catch {}
  if (typeof window !== "undefined") {
    try { window.dispatchEvent(new Event(AUDIO_STOP_ALL_EVENT)); } catch {}
  }
}

// Flight nodes
let flightSource: AudioBufferSourceNode | null = null;
let flightGain: GainNode | null = null;
let flightFilter: BiquadFilterNode | null = null;
let flightLfo: OscillatorNode | null = null;
let flightLfoGain: GainNode | null = null;

export function getMasterGain(): GainNode | null {
  getCtx();
  return masterGain;
}
export function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1.4;
    masterGain.connect(ctx.destination);
  }
  // Auto pause/resume audio when the tab/app is minimized or hidden.
  if (!visibilityHooked && typeof document !== "undefined") {
    visibilityHooked = true;
    const onVis = () => {
      if (!ctx) return;
      if (document.hidden) {
        ctx.suspend().catch(() => {});
      } else if (!muted) {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", () => ctx?.suspend().catch(() => {}));
    window.addEventListener("blur", () => ctx?.suspend().catch(() => {}));
    window.addEventListener("focus", () => {
      if (!muted && !document.hidden) ctx?.resume().catch(() => {});
    });
  }
  if (ctx.state === "suspended" && !document.hidden) ctx.resume().catch(() => {});
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

export function stopAmbient() {
  if (ambientTimer !== null) { clearInterval(ambientTimer); ambientTimer = null; }
  const c = ctx;
  if (!c || !ambientGain) return;
  const t = c.currentTime;
  try {
    ambientGain.gain.cancelScheduledValues(t);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, t);
    ambientGain.gain.linearRampToValueAtTime(0, t + 0.4);
  } catch {}
  const g = ambientGain;
  ambientGain = null;
  setTimeout(() => { try { g.disconnect(); } catch {} }, 600);
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
  if (activeTrack) {
    activeTrack.audio.muted = m;
    if (m) {
      try { activeTrack.audio.pause(); } catch {}
    } else if (!document.hidden) {
      activeTrack.audio.play().catch(() => {});
    }
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
export function playDiceRollSound(_durationMs = 2000) {
  if (muted) return;
  if (typeof window === "undefined") return;
  // Animation lasts ~2100ms but trimmed audio is ~1840ms.
  // Delay so the dice "impact" lands near the end of the animation.
  window.setTimeout(() => {
    // Lazy import para evitar ciclo de dependencias (webAudioPlayer importa
    // getCtx desde este mismo archivo).
    import("./webAudioPlayer").then(({ playSound }) => {
      playSound("/sounds/dice-roll.mp3", { volume: 0.9 });
    }).catch(() => { /* ignore */ });
  }, 260);
}

export function resetRevealStreak() {
  revealStreak = 0;
}

// ---- Chicken jump "blop" (tiny pop click) ----
// Sonido mínimo, profesional, tipo "pop / blop" para el salto de Chicken Road.
// Generado vía osciladores para no depender de un mp3 y mantener volumen
// idéntico en iOS y Android (Web Audio respeta gain).
export function playChickenJumpSound() {
  const c = getCtx();
  if (!c || muted || !masterGain) return;
  const now = c.currentTime;

  // Capa 1: pop con sweep ascendente rápido (sine 200 → 720 Hz).
  const pop = c.createOscillator();
  pop.type = "sine";
  pop.frequency.setValueAtTime(200, now);
  pop.frequency.exponentialRampToValueAtTime(720, now + 0.08);
  const pg = c.createGain();
  pg.gain.setValueAtTime(0, now);
  pg.gain.linearRampToValueAtTime(0.18, now + 0.008);
  pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  pop.connect(pg).connect(masterGain);
  pop.start(now);
  pop.stop(now + 0.15);

  // Capa 2: micro click brillante para el ataque.
  const tick = c.createOscillator();
  tick.type = "triangle";
  tick.frequency.value = 1800;
  const tg = c.createGain();
  tg.gain.setValueAtTime(0, now);
  tg.gain.linearRampToValueAtTime(0.05, now + 0.003);
  tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  tick.connect(tg).connect(masterGain);
  tick.start(now);
  tick.stop(now + 0.05);
}

// ---- Chicken loss sample (mp3 via Web Audio para respetar volumen en iOS) ----
export function playChickenLossSound() {
  if (muted) return;
  if (typeof window === "undefined") return;
  import("./webAudioPlayer").then(({ playSound }) => {
    playSound("/__l5e/assets-v1/02731642-5b1e-497b-8542-16bcdeb9413c/chicken-loss.mp3", {
      volume: 0.35,
    });
  }).catch(() => { /* ignore */ });
}

// ---- Chicken safe landing on platform ----
export function playChickenLandSound() {
  if (muted) return;
  if (typeof window === "undefined") return;
  import("./webAudioPlayer").then(({ playSound }) => {
    playSound("/__l5e/assets-v1/d28e0002-e233-41dc-a106-69e1b224d532/chicken-land.mp3", {
      volume: 0.32,
    });
  }).catch(() => { /* ignore */ });
}

// ---- Chicken "cluck" safe vocal — alterna entre 2 muestras ----
const CHICKEN_SAFE_URLS = [
  "/__l5e/assets-v1/e7db2d0d-ac42-4ccb-8707-c5e87cdd91df/chicken-safe-1.mp3",
  "/__l5e/assets-v1/208d2caf-e90d-4ffd-8fbf-e6807dbe5075/chicken-safe-2.mp3",
];
let chickenSafeIdx = 0;
export function playChickenSafeSound() {
  if (muted) return;
  if (typeof window === "undefined") return;
  const url = CHICKEN_SAFE_URLS[chickenSafeIdx % CHICKEN_SAFE_URLS.length];
  chickenSafeIdx = (chickenSafeIdx + 1) % CHICKEN_SAFE_URLS.length;
  import("./webAudioPlayer").then(({ playSound }) => {
    playSound(url, { volume: 0.28 });
  }).catch(() => { /* ignore */ });
}

// ---- Coin cascade sound (used while win counter animates up) ----
// Slot payout should feel like many coins hitting a metal tray: dry, fast,
// slightly chaotic, with little bursts of 2-3 impacts. Avoid pitched sweeps
// and bell-like resonances so it reads as "money dropping" instead of music.
function playCoinImpact(c: AudioContext, t: number, intensity = 1, pan = 0) {
  if (!masterGain) return;

  const len = Math.floor(c.sampleRate * 0.055);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const decay = 1 - i / len;
    d[i] = (Math.random() * 2 - 1) * decay;
  }

  const src = c.createBufferSource();
  src.buffer = buf;

  const panner = typeof c.createStereoPanner === "function" ? c.createStereoPanner() : null;
  if (panner) panner.pan.value = pan;

  const peak = 0.18 * intensity;

  // Main metal clink: bright but not tonal.
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800 + Math.random() * 700;

  const bpA = c.createBiquadFilter();
  bpA.type = "bandpass";
  bpA.frequency.value = 2600 + Math.random() * 900;
  bpA.Q.value = 10 + Math.random() * 4;

  const bpB = c.createBiquadFilter();
  bpB.type = "bandpass";
  bpB.frequency.value = 4700 + Math.random() * 1400;
  bpB.Q.value = 8 + Math.random() * 5;

  const gA = c.createGain();
  gA.gain.setValueAtTime(0.0001, t);
  gA.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  gA.gain.exponentialRampToValueAtTime(0.0001, t + 0.042);

  const gB = c.createGain();
  gB.gain.setValueAtTime(0.0001, t);
  gB.gain.exponentialRampToValueAtTime(peak * 0.58, t + 0.0015);
  gB.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

  // Tray/body: short lower clack so it feels like coins landing in metal.
  const trayLp = c.createBiquadFilter();
  trayLp.type = "lowpass";
  trayLp.frequency.value = 950 + Math.random() * 350;

  const trayHp = c.createBiquadFilter();
  trayHp.type = "highpass";
  trayHp.frequency.value = 180;

  const trayGain = c.createGain();
  trayGain.gain.setValueAtTime(0.0001, t);
  trayGain.gain.exponentialRampToValueAtTime(peak * 0.42, t + 0.003);
  trayGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

  const outputA = panner ?? masterGain;
  const outputB = panner ?? masterGain;
  const outputTray = panner ?? masterGain;

  src.connect(hp);
  hp.connect(bpA).connect(gA).connect(outputA);
  hp.connect(bpB).connect(gB).connect(outputB);
  src.connect(trayLp).connect(trayHp).connect(trayGain).connect(outputTray);

  if (panner) panner.connect(masterGain);

  src.start(t);
  src.stop(t + 0.06);
}

export function playCoinsSound(durationMs = 900) {
  const c = getCtx();
  if (!c || muted || !masterGain) return;

  const start = c.currentTime;
  const durationSec = durationMs / 1000;
  const end = start + durationSec;

  let t = start;
  while (t < end) {
    const progress = (t - start) / Math.max(durationSec, 0.001);
    const interval = 0.024 + progress * 0.038 + Math.random() * 0.012;
    const intensity = 0.9 - progress * 0.2 + Math.random() * 0.12;
    const pan = (Math.random() * 2 - 1) * 0.55;

    playCoinImpact(c, t, intensity, pan);

    // Small burst pairs make it feel like a real coin payout, not a metronome.
    if (Math.random() < 0.6) {
      playCoinImpact(
        c,
        t + 0.008 + Math.random() * 0.012,
        intensity * (0.7 + Math.random() * 0.18),
        Math.max(-0.8, Math.min(0.8, pan + (Math.random() * 2 - 1) * 0.22)),
      );
    }

    if (Math.random() < 0.24) {
      playCoinImpact(
        c,
        t + 0.017 + Math.random() * 0.012,
        intensity * 0.55,
        (Math.random() * 2 - 1) * 0.8,
      );
    }

    t += interval;
  }
}

// ---- Card deal sound (whoosh + tap on felt) ----
export function playCardDealSound() {
  const c = getCtx();
  if (!c || muted || !masterGain) return;
  const now = c.currentTime;

  // Whoosh: short filtered noise burst that sweeps down
  const noiseBuf = makeNoiseBuffer(c);
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  const nf = c.createBiquadFilter();
  nf.type = "bandpass";
  nf.Q.value = 0.9;
  nf.frequency.setValueAtTime(3200, now);
  nf.frequency.exponentialRampToValueAtTime(900, now + 0.12);
  const ng = c.createGain();
  ng.gain.setValueAtTime(0, now);
  ng.gain.linearRampToValueAtTime(0.18, now + 0.012);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  noise.connect(nf).connect(ng).connect(masterGain);
  noise.start(now);
  noise.stop(now + 0.16);

  // Tap: short low click for the card landing on the felt
  const tap = c.createOscillator();
  tap.type = "sine";
  tap.frequency.setValueAtTime(180, now + 0.1);
  tap.frequency.exponentialRampToValueAtTime(70, now + 0.18);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0, now + 0.1);
  tg.gain.linearRampToValueAtTime(0.22, now + 0.108);
  tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  tap.connect(tg).connect(masterGain);
  tap.start(now + 0.1);
  tap.stop(now + 0.24);

  // Tiny high tick for snap
  const tick = c.createOscillator();
  tick.type = "square";
  tick.frequency.value = 2400;
  const tkg = c.createGain();
  tkg.gain.setValueAtTime(0, now + 0.105);
  tkg.gain.linearRampToValueAtTime(0.03, now + 0.11);
  tkg.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  tick.connect(tkg).connect(masterGain);
  tick.start(now + 0.105);
  tick.stop(now + 0.16);
}

// ---- Blackjack lounge ambient (soft cocktail jazz vibe) ----
// Smooth Rhodes-like electric piano chords, walking upright bass,
// gentle brush hi-hat. Low volume by design — meant to sit under SFX.

const BJ_PROG: Array<[number, number[]]> = [
  [146.83, [293.66, 349.23, 440.0, 523.25]], // Dm7
  [196.0,  [293.66, 349.23, 440.0, 493.88]], // G7
  [130.81, [261.63, 329.63, 392.0, 493.88]], // Cmaj7
  [174.61, [261.63, 329.63, 349.23, 440.0]], // Fmaj7
  [123.47, [246.94, 293.66, 349.23, 440.0]], // Bm7b5
  [164.81, [329.63, 415.30, 493.88, 587.33]], // E7
  [110.0,  [261.63, 329.63, 392.0, 440.0]],  // Am7
  [110.0,  [277.18, 329.63, 392.0, 440.0]],  // A7
];
const BJ_BAR_MS = 2400;

function bjRhodesChord(c: AudioContext, time: number, freqs: number[]) {
  if (!bjGain) return;
  freqs.forEach((f, i) => {
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = "triangle";
    o2.type = "sine";
    o1.frequency.value = f;
    o2.frequency.value = f * 2.005;
    const g = c.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.045 - i * 0.005, time + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 1.9);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(bjGain!);
    o1.start(time); o1.stop(time + 2.0);
    o2.start(time); o2.stop(time + 2.0);
  });
}

function bjBass(c: AudioContext, time: number, root: number) {
  if (!bjGain) return;
  const notes = [
    { f: root, t: 0 },
    { f: root * 1.5, t: BJ_BAR_MS / 2000 },
  ];
  notes.forEach(({ f, t }) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, time + t);
    const g = c.createGain();
    g.gain.setValueAtTime(0, time + t);
    g.gain.linearRampToValueAtTime(0.11, time + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + t + 0.9);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    o.connect(lp).connect(g).connect(bjGain!);
    o.start(time + t);
    o.stop(time + t + 1.0);
  });
}

function bjBrushHat(c: AudioContext, time: number) {
  if (!bjGain) return;
  const beats = 4;
  const beatDur = BJ_BAR_MS / 1000 / beats;
  const buf = makeNoiseBuffer(c);
  for (let i = 0; i < beats; i++) {
    const t = time + i * beatDur;
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5500;
    const g = c.createGain();
    const isOff = i % 2 === 1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(isOff ? 0.022 : 0.012, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (isOff ? 0.22 : 0.09));
    src.connect(hp).connect(g).connect(bjGain);
    src.start(t);
    src.stop(t + 0.3);
  }
}

export function startBlackjackAmbient() {
  const c = getCtx();
  if (!c || bjGain) return;
  bjGain = c.createGain();
  bjGain.gain.value = 0;
  bjGain.connect(masterGain!);
  bjGain.gain.linearRampToValueAtTime(0.22, c.currentTime + 2.0);

  bjStep = 0;
  const tick = () => {
    if (!ctx || !bjGain) return;
    const now = ctx.currentTime + 0.02;
    const [root, chord] = BJ_PROG[bjStep % BJ_PROG.length];
    bjRhodesChord(ctx, now, chord);
    bjBass(ctx, now, root);
    bjBrushHat(ctx, now);
    bjStep++;
  };
  tick();
  bjTimer = window.setInterval(tick, BJ_BAR_MS);
}

export function stopBlackjackAmbient() {
  const c = ctx;
  if (bjTimer !== null) { clearInterval(bjTimer); bjTimer = null; }
  if (!c || !bjGain) return;
  const t = c.currentTime;
  bjGain.gain.cancelScheduledValues(t);
  bjGain.gain.setValueAtTime(bjGain.gain.value, t);
  bjGain.gain.linearRampToValueAtTime(0, t + 0.6);
  const g = bjGain;
  bjGain = null;
  setTimeout(() => { try { g.disconnect(); } catch {} }, 800);
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