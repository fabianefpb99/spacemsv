// Reproductor de audio basado en Web Audio API.
//
// Motivación: iOS Safari ignora `HTMLAudioElement.volume` (siempre suena al
// 100%). Esto hace que SFX y música de fondo se escuchen muy alto en iPhone.
// Web Audio API + GainNode sí respeta el volumen en iOS, Android y desktop.
//
// Este módulo expone una API mínima compatible con los usos que ya tenía la
// app sobre `new Audio()`: reproducir, parar con fade, ajustar volumen y
// recibir callback al terminar. También maneja:
//   - Cache de AudioBuffer decodificado por URL (no re-decodifica SFX).
//   - Resume del AudioContext si está suspendido (autoplay policy iOS).
//   - Fallback transparente a HTMLAudio si Web Audio no está disponible.
//   - Pausa/reanudación al ocultar/mostrar la pestaña.

import { getCtx } from "./gameAudio";

export interface PlaySoundOptions {
  volume?: number;
  loop?: boolean;
  fadeInMs?: number;
  onEnded?: () => void;
  /**
   * Si se pasa, el sonido respetará el `pause()` automático al ocultar la
   * pestaña y se reanudará al volver. Útil para música de fondo. Para SFX
   * cortos déjalo en false.
   */
  pauseOnHidden?: boolean;
}

export interface SoundHandle {
  /** Detiene el sonido. Si `fadeMs > 0` aplica un fade-out suave. */
  stop: (fadeMs?: number) => void;
  /** Ajusta el volumen de forma inmediata o con rampa lineal. */
  setVolume: (volume: number, rampMs?: number) => void;
  /** True si el sonido sigue activo (no detenido manualmente ni terminado). */
  isPlaying: () => boolean;
}

const bufferCache = new Map<string, Promise<AudioBuffer>>();

function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let p = bufferCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`audio fetch ${r.status}`);
        return r.arrayBuffer();
      })
      .then(
        (buf) =>
          new Promise<AudioBuffer>((resolve, reject) => {
            // Safari < 14 sólo soporta la firma con callbacks.
            try {
              const result = ctx.decodeAudioData(buf, resolve, reject);
              if (result && typeof (result as Promise<AudioBuffer>).then === "function") {
                (result as Promise<AudioBuffer>).then(resolve, reject);
              }
            } catch (err) {
              reject(err);
            }
          }),
      );
    p.catch(() => bufferCache.delete(url));
    bufferCache.set(url, p);
  }
  return p;
}

/**
 * Fallback HTMLAudio para entornos sin Web Audio API. iOS ignorará `volume`
 * pero al menos sonará. En la práctica esta rama casi nunca se usa porque
 * todos los navegadores modernos soportan AudioContext.
 */
function htmlAudioFallback(url: string, opts: PlaySoundOptions): SoundHandle {
  const a = new Audio(url);
  a.preload = "auto";
  a.loop = opts.loop ?? false;
  a.volume = opts.volume ?? 1;
  let stopped = false;
  let endedFired = false;
  const onEnded = () => {
    if (endedFired) return;
    endedFired = true;
    opts.onEnded?.();
  };
  a.addEventListener("ended", onEnded);
  a.play().catch(() => {});
  return {
    stop(fadeMs = 0) {
      if (stopped) return;
      stopped = true;
      if (fadeMs > 0) {
        const startV = a.volume;
        const t0 = performance.now();
        const tick = () => {
          const t = Math.min(1, (performance.now() - t0) / fadeMs);
          a.volume = Math.max(0, startV * (1 - t));
          if (t < 1) requestAnimationFrame(tick);
          else {
            try {
              a.pause();
              a.src = "";
            } catch {
              /* ignore */
            }
          }
        };
        requestAnimationFrame(tick);
      } else {
        try {
          a.pause();
          a.src = "";
        } catch {
          /* ignore */
        }
      }
    },
    setVolume(v) {
      try {
        a.volume = Math.max(0, Math.min(1, v));
      } catch {
        /* ignore */
      }
    },
    isPlaying() {
      return !stopped && !a.paused;
    },
  };
}

/**
 * Reproduce un sonido a partir de una URL. Devuelve un handle síncrono que
 * permite detenerlo aunque la decodificación aún esté en curso (la parada
 * queda pendiente y se aplica en cuanto el sonido empieza).
 */
export function playSound(url: string, opts: PlaySoundOptions = {}): SoundHandle {
  const ctx = getCtx();
  if (!ctx) return htmlAudioFallback(url, opts);

  const targetVolume = opts.volume ?? 1;
  const loop = opts.loop ?? false;
  const fadeInMs = opts.fadeInMs ?? 0;

  let stopped = false;
  let stopRequested: { fadeMs: number } | null = null;
  let pendingVolume: { v: number; rampMs: number } | null = null;
  let src: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let visListener: (() => void) | null = null;

  const cleanupVis = () => {
    if (visListener && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", visListener);
      visListener = null;
    }
  };

  const stopNow = (fadeMs: number) => {
    if (!src || !gain) return;
    const now = ctx.currentTime;
    try {
      if (fadeMs > 0) {
        const currentV = gain.gain.value;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(currentV, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
        const s = src;
        setTimeout(() => {
          try {
            s.stop();
          } catch {
            /* ignore */
          }
        }, fadeMs + 60);
      } else {
        src.stop();
      }
    } catch {
      /* ignore */
    }
    cleanupVis();
  };

  // Carga + arranque asíncrono.
  (async () => {
    try {
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* ignore */
        }
      }
      const buf = await loadBuffer(ctx, url);
      if (stopped) return;
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loop;
      gain = ctx.createGain();
      const now = ctx.currentTime;
      if (fadeInMs > 0) {
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(
          targetVolume,
          now + fadeInMs / 1000,
        );
      } else {
        gain.gain.setValueAtTime(targetVolume, now);
      }
      src.connect(gain).connect(ctx.destination);
      src.onended = () => {
        if (stopped) return;
        stopped = true;
        cleanupVis();
        opts.onEnded?.();
      };
      src.start();

      if (pendingVolume) {
        const { v, rampMs } = pendingVolume;
        pendingVolume = null;
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        if (rampMs > 0) gain.gain.linearRampToValueAtTime(v, t + rampMs / 1000);
        else gain.gain.setValueAtTime(v, t);
      }
      if (stopRequested) {
        const { fadeMs } = stopRequested;
        stopRequested = null;
        stopNow(fadeMs);
        return;
      }

      if (opts.pauseOnHidden && typeof document !== "undefined") {
        let savedVolume = targetVolume;
        visListener = () => {
          if (!gain || !ctx) return;
          const t = ctx.currentTime;
          if (document.hidden) {
            savedVolume = gain.gain.value;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(0, t);
          } else {
            gain.gain.cancelScheduledValues(t);
            gain.gain.linearRampToValueAtTime(savedVolume, t + 0.2);
          }
        };
        document.addEventListener("visibilitychange", visListener);
      }
    } catch {
      // Si la decodificación falla, no rompemos nada — el sonido simplemente
      // no suena. Mejor que crashear el componente.
      stopped = true;
    }
  })();

  return {
    stop(fadeMs = 0) {
      if (stopped) return;
      stopped = true;
      if (!src) {
        // Aún no arrancó: marcamos para que la corutina lo aborte.
        stopRequested = { fadeMs };
        return;
      }
      stopNow(fadeMs);
    },
    setVolume(v, rampMs = 0) {
      if (stopped) return;
      if (!gain || !ctx) {
        pendingVolume = { v, rampMs };
        return;
      }
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      if (rampMs > 0) gain.gain.linearRampToValueAtTime(v, t + rampMs / 1000);
      else gain.gain.setValueAtTime(v, t);
    },
    isPlaying() {
      return !stopped;
    },
  };
}

/**
 * Precarga (fetch + decode) un sonido para que el primer `playSound` no tenga
 * latencia. Seguro de llamar varias veces — usa el mismo cache.
 */
export function preloadSound(url: string): void {
  const ctx = getCtx();
  if (!ctx) return;
  loadBuffer(ctx, url).catch(() => {});
}

/**
 * Pool de SFX que se repiten muy rápido (golpes en Arena). Pre-carga el buffer
 * y al disparar crea un BufferSource nuevo cada vez (los BufferSource son
 * desechables — gratis crear, automáticamente liberados al terminar).
 */
export function createSfx(url: string, volume = 1) {
  preloadSound(url);
  return {
    play() {
      playSound(url, { volume });
    },
  };
}