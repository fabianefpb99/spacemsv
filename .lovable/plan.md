# Plan: Sistema de audio Web Audio API (fix volumen iOS)

## Objetivo
Migrar todos los `new Audio()` + `.volume = X` (que iOS ignora) a un reproductor unificado basado en **Web Audio API + GainNode**, conservando exactamente el mismo comportamiento (volúmenes, fades, loops, intros, fade-outs anticipados).

## Estrategia: wrapper centralizado + migración por fases

Crear un único módulo `src/lib/webAudioPlayer.ts` que expone una API simple y compatible con el uso actual. Luego sustituir uso por uso, sin tocar otros sistemas.

### Fase 1 — Wrapper (sin romper nada)
Crear `src/lib/webAudioPlayer.ts`:
- Reutiliza el `AudioContext` ya existente en `gameAudio.ts` (función `getCtx()`).
- API:
  - `playSound(url, { volume, loop?, fadeInMs?, onEnded? }) → handle`
  - `handle.stop(fadeMs?)` — fade-out suave o stop inmediato
  - `handle.setVolume(v, rampMs?)` — para fades arbitrarios
- Cachea `AudioBuffer` decodificado por URL (Map) para que las SFX repetidas no re-decodifiquen.
- Maneja autoplay iOS: si el contexto está `suspended`, intenta `resume()` (ya hay gestos del usuario en todos los puntos donde se reproduce).
- Fades vía `gain.linearRampToValueAtTime()` — más suave que `setInterval`/RAF.
- Fallback: si Web Audio falla por cualquier razón, cae a `new Audio()` clásico para no romper Android viejo.

### Fase 2 — Migrar `/home`
- `src/routes/home.tsx`: reemplazar el bloque del `casino-intro.mp3` (líneas ~160–285) por una llamada al wrapper con `fadeInMs: 1500`, y programar `handle.stop(5000)` al timeout que ya existe.
- Validar: probar en iOS y Android antes de seguir.

### Fase 3 — Migrar Arena
- `ArenaLobby.tsx`: música de lobby con fade-in al entrar, fade-out anticipado antes de terminar.
- `ArenaFight.tsx`: música de pelea + SFX (`fight-start`, golpes, `hit-final`).
- `ArenaResult.tsx`: SFX de resultado.
- `gameAudio.ts` línea 58 (`createAudio`) y línea 512 (`dice-roll.mp3`): migrar al wrapper.

### Fase 4 — Validación
- Probar manualmente en preview que cada sonido suena y sus fades funcionan.
- Confirmar que el volumen en iOS ahora respeta los valores configurados.

## Detalles técnicos

```ts
// src/lib/webAudioPlayer.ts (esqueleto)
import { getCtx } from "./gameAudio";

const bufferCache = new Map<string, Promise<AudioBuffer>>();

async function loadBuffer(ctx: AudioContext, url: string) {
  if (!bufferCache.has(url)) {
    bufferCache.set(url, fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)));
  }
  return bufferCache.get(url)!;
}

export async function playSound(url, { volume = 1, loop = false, fadeInMs = 0 }) {
  const ctx = getCtx();
  if (!ctx) return fallbackHtmlAudio(url, volume, loop); // fallback
  if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
  const buf = await loadBuffer(ctx, url);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = loop;
  const gain = ctx.createGain();
  gain.gain.value = fadeInMs > 0 ? 0 : volume;
  src.connect(gain).connect(ctx.destination);
  src.start();
  if (fadeInMs > 0) {
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeInMs / 1000);
  }
  return {
    stop(fadeMs = 0) {
      if (fadeMs > 0) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeMs / 1000);
        setTimeout(() => { try { src.stop(); } catch {} }, fadeMs + 50);
      } else { try { src.stop(); } catch {} }
    },
    setVolume(v, rampMs = 0) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(v, ctx.currentTime + rampMs / 1000);
    }
  };
}
```

## Riesgos y mitigaciones
- **Romper fades**: usar `linearRampToValueAtTime` que es nativo y más preciso. Mismos tiempos (1500ms in, 5000ms out, etc.).
- **Autoplay bloqueado iOS**: el `AudioContext` ya se crea/resume tras gesto en el flujo actual; el wrapper lo respeta.
- **Latencia primer play**: primer `fetch + decode` puede tardar ~100ms. Aceptable para intros, y para SFX repetidos queda en cache.
- **Android sin cambios**: misma ruta de Web Audio API que ya funciona allá → no se afecta.
- **Fallback**: si por algo `getCtx()` retorna null, caemos a `new Audio()` clásico para no romper nada.

## Entregables
- `src/lib/webAudioPlayer.ts` (nuevo)
- `src/routes/home.tsx` (migrado)
- `src/components/games/arena/ArenaLobby.tsx` (migrado)
- `src/components/games/arena/ArenaFight.tsx` (migrado)
- `src/components/games/arena/ArenaResult.tsx` (migrado)
- `src/lib/gameAudio.ts` (dos puntos migrados)

## Fuera de alcance
- No se tocan los archivos MP3.
- No se cambian volúmenes objetivo (siguen 0.15 home, 0.026 lobby, 0.022 fight, etc.).
- No se toca la síntesis (osciladores) de `gameAudio.ts` — esa parte ya usa Web Audio API correctamente.
