import { AuthControl } from "@/components/auth/AuthControl";
import { BetAmount } from "@/components/games/BetAmount";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Minus, Plus, Volume2, VolumeX } from "lucide-react";
import betspaceLogo from "@/assets/betspace-logo.svg";
import {
  setMuted as setAudioMuted,
  isMuted,
  playCashoutSound,
  playChickenJumpSound,
  playChickenLossSound,
  playChickenLandSound,
  playChickenSafeSound,
  stopAllGameAudio,
  startChickenBgMusic,
  stopChickenBgMusic,
  preloadChickenSounds,
} from "@/lib/gameAudio";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, type MeData } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { toFriendlyError } from "@/lib/friendly-error";
import { withTimeout } from "@/lib/async/with-timeout";
import {
  chickenDeal,
  chickenJump,
  chickenCashout,
  chickenResume,
  type ChickenSessionView,
} from "@/lib/games/chicken.functions";
import { clampBetToStep } from "@/lib/games/bet-helpers";
import {
  CHICKEN_BET_STEP,
  CHICKEN_MAX_BET,
  CHICKEN_MIN_BET,
  chickenMultiplier,
} from "@/lib/games/chicken.shared";
import bgAsset from "@/assets/chicken/background-space.webp.asset.json";
import chickenIdleAsset from "@/assets/chicken/chicken-idle.png.asset.json";
import chickenPrepareAsset from "@/assets/chicken/chicken-prepare.png.asset.json";
import chickenJumpAsset from "@/assets/chicken/chicken-jump.png.asset.json";
import chickenFailAsset from "@/assets/chicken/chicken-fail.png.asset.json";
import asteroidAsset from "@/assets/chicken/asteroid.webp.asset.json";
import asteroidBrokenAsset from "@/assets/chicken/asteroid-broken.webp.asset.json";

const BG = bgAsset.url;
const IMG_IDLE = chickenIdleAsset.url;
const IMG_PREPARE = chickenPrepareAsset.url;
const IMG_JUMP = chickenJumpAsset.url;
const IMG_FAIL = chickenFailAsset.url;
const IMG_ASTEROID = asteroidAsset.url;
const IMG_ASTEROID_BROKEN = asteroidBrokenAsset.url;

const QUICK_ADDS = [1000, 2000, 5000, 10000];

function uuid(): string {
  const g = (typeof globalThis !== "undefined" ? (globalThis as unknown as { crypto?: Crypto }).crypto : undefined);
  if (g && typeof g.randomUUID === "function") return g.randomUUID();
  const bytes = new Uint8Array(16);
  if (g && typeof g.getRandomValues === "function") g.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

/** Phases:
 *  idle    — no session, banner visible, button = JUGAR
 *  playing — session open, chicken on left asteroid, right asteroid visible w/ next mult
 *  jumping — animation in flight (button disabled)
 *  lost    — broken outcome banner
 *  cashed  — won banner
 */
type Phase = "idle" | "playing" | "jumping" | "lost" | "cashed";

/** Substate for the right asteroid (the target of the next jump). */
type RightFx = "none" | "shake-break" | "broken";
/** Substate for the chicken sprite during animation. */
type ChickenFx = "idle" | "prepare" | "jump-left-to-right" | "land-bounce" | "slide-to-left" | "fall" | "fail-still";

/** Mínimo que dura la fase de "carga" (sprite prepare + glow azul).
 *  Si el servidor responde antes, esperamos hasta este mínimo para que el
 *  jugador vea el impulso. Si responde después, el glow simplemente sigue
 *  pulsando hasta que llega la respuesta. */
const PREPARE_MIN_MS = 240;
const JUMP_MS = 240;
const LAND_BOUNCE_MS = 140;
const SLIDE_MS = 240;
const BROKEN_SHAKE_MS = 320;
const FALL_MS = 600;

export function ChickenGame() {
  const { user, refreshSession } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();
  const realBalance = me.data?.balance ?? 0;
  const bonusBalance = me.data?.bonus_balance ?? 0;
  const balance = realBalance + bonusBalance;

  const dealFn = useServerFn(chickenDeal);
  const jumpFn = useServerFn(chickenJump);
  const cashoutFn = useServerFn(chickenCashout);
  const resumeFn = useServerFn(chickenResume);

  const [bet, setBet] = useState(2000);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);                     // safe jumps confirmed
  // Step "visible" para el banner motivacional. Se actualiza solo cuando la
  // gallina ya aterrizó en el nuevo asteroide, para evitar que el banner
  // se remonte (duplicado) durante el salto.
  const [displayedStep, setDisplayedStep] = useState(0);
  const [nextMult, setNextMult] = useState<number>(chickenMultiplier(1));
  const [currentMult, setCurrentMult] = useState<number>(1);
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [chickenFx, setChickenFx] = useState<ChickenFx>("idle");
  const [rightFx, setRightFx] = useState<RightFx>("none");
  const [rightVisible, setRightVisible] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDealing, setIsDealing] = useState(false);
  const [online] = useState(217);

  const sessionRef = useRef<{ id: string; nonce: number } | null>(null);
  const dealInFlightRef = useRef(false);
  const actionInFlightRef = useRef(false);

  const applyBalance = useCallback(
    (newBalance: number) => {
      if (!user) return;
      queryClient.setQueryData<MeData | null>(["me", user.id], (prev) =>
        prev ? { ...prev, balance: newBalance } : prev,
      );
    },
    [queryClient, user],
  );

  const resetToIdle = useCallback(() => {
    setPhase("idle");
    setStep(0);
    setDisplayedStep(0);
    setNextMult(chickenMultiplier(1));
    setCurrentMult(1);
    setChickenFx("idle");
    setRightFx("none");
    setRightVisible(false);
    setIsDealing(false);
    sessionRef.current = null;
  }, []);

  // Apply a server-returned snapshot into local state (used by resume).
  const applyServerView = useCallback((view: ChickenSessionView) => {
    sessionRef.current = { id: view.session_id, nonce: view.nonce };
    const pub = view.public_state;
    applyBalance(view.new_balance);
    setStep(pub.step);
    setDisplayedStep(pub.step);
    setCurrentMult(pub.multiplier);
    setNextMult(pub.nextMultiplier || 0);
    if (pub.phase === "playing") {
      setPhase("playing");
      setChickenFx("idle");
      setRightFx("none");
      setRightVisible(true);
    }
  }, [applyBalance]);

  // Resume any open session on mount.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const view = await withTimeout(resumeFn(), 5000, "chicken_resume_timeout");
        if (cancelled || !view) return;
        setBet(view.public_state.bet);
        applyServerView(view);
      } catch (e) {
        console.warn("[chicken] initial resume failed", e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { setAudioMuted(muted); }, [muted]);
  useEffect(() => {
    stopAllGameAudio();
    // Pre-decode los SFX para que el sonido de pérdida/aterrizaje suene
    // sincronizado con la animación desde la primera ronda (sin lag móvil).
    preloadChickenSounds();
    // Inicia la música de fondo (puede requerir gesto del usuario; reintenta abajo)
    startChickenBgMusic();
    return () => { stopChickenBgMusic(); };
  }, []);
  // Sync muted toggle with global audio state.
  useEffect(() => { setMuted(isMuted()); }, []);

  // Pre-cache the broken asteroid so el swap mid-aire es instantáneo
  // (sin un parpadeo mientras decode el WebP).
  useEffect(() => {
    const img = new Image();
    img.src = IMG_ASTEROID_BROKEN;
  }, []);

  const recoverAfterActionError = useCallback(async (err: unknown) => {
    const raw = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const looksAuthError =
      raw.includes("unauthorized") ||
      raw.includes("not authenticated") ||
      raw.includes("auth_get_session_timeout") ||
      raw.includes("auth_get_user_timeout");
    if (looksAuthError) {
      await refreshSession().catch(() => null);
    }
    return false;
  }, [refreshSession]);

  const startGame = useCallback(async () => {
    if (phase !== "idle" || dealInFlightRef.current) return;
    if (bet < CHICKEN_MIN_BET || bet > balance) return;
    dealInFlightRef.current = true;
    setIsDealing(true);
    setError(null);
    const prevBalance = balance;
    applyBalance(Math.max(0, balance - bet));
    try {
      const view = await withTimeout(
        dealFn({ data: { bet, client_action_id: uuid() } }),
        7000,
        "chicken_deal_timeout",
      );
      sessionRef.current = { id: view.session_id, nonce: view.nonce };
      applyBalance(view.new_balance);
      setStep(view.public_state.step);
      setDisplayedStep(view.public_state.step);
      setCurrentMult(view.public_state.multiplier);
      setNextMult(view.public_state.nextMultiplier);
      setRightVisible(true);
      setRightFx("none");
      setChickenFx("idle");
      setPhase("playing");
    } catch (e) {
      await recoverAfterActionError(e);
      applyBalance(prevBalance);
      setError(toFriendlyError(e, "No se pudo iniciar la partida."));
    } finally {
      dealInFlightRef.current = false;
      setIsDealing(false);
    }
  }, [phase, bet, balance, dealFn, applyBalance, recoverAfterActionError]);

  const cashout = useCallback(async () => {
    if (phase !== "playing" || step <= 0 || actionInFlightRef.current) return;
    const sess = sessionRef.current;
    if (!sess) return;
    actionInFlightRef.current = true;
    setError(null);
    try {
      const view = await withTimeout(
        cashoutFn({ data: { session_id: sess.id, nonce: sess.nonce, client_action_id: uuid() } }),
        7000,
        "chicken_cashout_timeout",
      );
      applyBalance(view.new_balance);
      setLastPayout(view.public_state.payout ?? 0);
      setCurrentMult(view.public_state.multiplier);
      playCashoutSound();
      setPhase("cashed");
      sessionRef.current = null;
      setTimeout(() => resetToIdle(), 2200);
    } catch (e) {
      await recoverAfterActionError(e);
      setError(toFriendlyError(e, "No se pudo cobrar."));
    } finally {
      actionInFlightRef.current = false;
    }
  }, [phase, step, cashoutFn, applyBalance, recoverAfterActionError, resetToIdle]);

  const jump = useCallback(async () => {
    if (phase !== "playing" || actionInFlightRef.current) return;
    const sess = sessionRef.current;
    if (!sess) return;
    actionInFlightRef.current = true;
    setError(null);
    setPhase("jumping");
    // 1. PREPARE sprite + glow azul. Disparamos YA el request al servidor,
    //    así su latencia se "esconde" en esta fase de carga visual.
    setChickenFx("prepare");
    playChickenJumpSound();
    // A mitad del "cargando impulso" suena un cluck (alterna entre 2 muestras)
    //  — refuerza la sensación de que la gallina está tomando aire.
    const safeSoundTimer = window.setTimeout(() => {
      playChickenSafeSound();
    }, Math.floor(PREPARE_MIN_MS / 2));
    const reqP = withTimeout(
      jumpFn({ data: { session_id: sess.id, nonce: sess.nonce, client_action_id: uuid() } }),
      7000,
      "chicken_jump_timeout",
    );
    let view: ChickenSessionView;
    try {
      // Esperamos a que: (a) el servidor responda, y (b) se cumpla el mínimo
      // visual de carga. Lo que tarde más manda.
      const [res] = await Promise.all([reqP, delay(PREPARE_MIN_MS)]);
      view = res;
    } catch (e) {
      window.clearTimeout(safeSoundTimer);
      await recoverAfterActionError(e);
      setError(toFriendlyError(e, "No se pudo saltar."));
      // Snap chicken back to idle on the central asteroid.
      setChickenFx("idle");
      setPhase("playing");
      actionInFlightRef.current = false;
      return;
    }
    window.clearTimeout(safeSoundTimer);

    const pubEarly = view.public_state;
    sessionRef.current = { id: view.session_id, nonce: view.nonce };
    applyBalance(view.new_balance);
    // ⚡ HUD sincronizado: actualizamos saltos/cobro/siguiente AHORA, en
    // cuanto el servidor respondió (justo al terminar la fase de carga),
    // sin esperar a que termine la animación de salto.
    if (!(pubEarly.phase === "result" && pubEarly.outcome === "lost")) {
      setStep(pubEarly.step);
      setCurrentMult(pubEarly.multiplier);
      setNextMult(pubEarly.nextMultiplier ?? 0);
    }

    // 2. JUMP sprite + salto vertical rápido. Ya tenemos el resultado en mano,
    //    así que la animación nunca se queda "congelada" esperando al servidor.
    setChickenFx("jump-left-to-right");
    // Pequeño respiro para que el render del sprite "jump" arranque limpio
    // antes de hacer el resto del cálculo.
    await delay(JUMP_MS);

    const pub = view.public_state;

    if (pub.phase === "result" && pub.outcome === "lost") {
      // LOSS: con la gallina aún en el aire, el asteroide ya se rompe
      // (cambia a textura "broken"). Luego la gallina cae a través del hueco
      // y el asteroide roto se desvanece.
      setRightFx("broken");
      playChickenLossSound();
      // Pequeña pausa para que el jugador vea el cambio "íntegro → roto"
      // mientras la gallina sigue su arco.
      await delay(140);
      setChickenFx("fall");
      await delay(FALL_MS);
      setChickenFx("fail-still");
      setPhase("lost");
      setLastPayout(0);
      actionInFlightRef.current = false;
      return;
    }

    if (pub.phase === "result" && pub.outcome === "won") {
      // Auto-cashout at max step.
      setChickenFx("land-bounce");
      playCashoutSound();
      await delay(LAND_BOUNCE_MS);
      setLastPayout(pub.payout ?? 0);
      setPhase("cashed");
      sessionRef.current = null;
      setTimeout(() => resetToIdle(), 2200);
      actionInFlightRef.current = false;
      return;
    }

    // SAFE jump, round continues.
    setChickenFx("land-bounce");
    playChickenLandSound();
    await delay(LAND_BOUNCE_MS);
    // Slide both asteroids + chicken left so the "right" position becomes the new "left".
    setChickenFx("slide-to-left");
    await delay(SLIDE_MS);
    // El banner motivacional previo ya completó su salida hacia la izquierda
    // junto con el asteroide. Ahora sí promovemos el step "visible" para que
    // el siguiente banner entre limpio (sin duplicado durante el salto).
    setDisplayedStep(pub.step);
    // (step/currentMult/nextMult ya se commitearon arriba; aquí solo
    //  reseteamos posiciones manteniendo un único asteroide derecho estable.)
    setRightFx("none");
    setChickenFx("idle");
    setPhase("playing");
    actionInFlightRef.current = false;
  }, [phase, jumpFn, applyBalance, recoverAfterActionError, resetToIdle]);

  const canStart = phase === "idle" && bet >= CHICKEN_MIN_BET && bet <= balance;

  return (
    <div
      className="relative h-[100dvh] overflow-hidden text-white"
      style={{
        backgroundColor: "#060210",
        backgroundImage: `url(${BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Partículas suaves en diagonal (↘→↙). CSS puro, sin canvas/JS. */}
      <div className="chicken-particles" aria-hidden="true">
        <span className="chicken-particles-layer chicken-particles-layer-1" />
        <span className="chicken-particles-layer chicken-particles-layer-2" />
      </div>
      <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.4rem)] pt-2 sm:max-w-lg sm:px-4">
        {/* Header — idéntico al resto de juegos */}
        <header
          className="flex shrink-0 items-center justify-between bg-[#060210]/80 backdrop-blur-sm border-b border-purple-500/20 pb-2 px-3 -mx-3 -mt-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <div className="flex items-center gap-1">
            <Link to="/home" className="rounded-md p-2 text-white hover:bg-white/10">
              <Menu className="h-7 w-7" strokeWidth={3} />
            </Link>
            <Link to="/home">
              <img
                src={betspaceLogo}
                alt="BETSPACE"
                className="h-6 w-auto sm:h-7 translate-y-px"
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="font-display text-[11px] font-bold sm:text-xs text-white">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <AuthControl />
          </div>
        </header>

        {/* Online + mute */}
        <div className="mt-1.5 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-semibold text-white/90">{online} ONLINE</span>
          </div>
          <button
            onClick={() => setMuted((m) => !m)}
            className="rounded-md p-1 text-purple-200/80 hover:bg-white/5"
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* HUD: paso actual + siguiente pago + cobrar */}
        <section className="mt-1.5 shrink-0 grid grid-cols-3 gap-2 rounded-2xl border border-purple-500/30 glass-panel p-2">
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-widest text-purple-200/70">Saltos</div>
            <div className="mt-1 rounded-lg border border-purple-500/40 bg-[#160830]/60 py-1.5">
              <span className="font-display text-base font-bold text-white">{step}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-widest text-purple-200/70">Siguiente X</div>
            <div className="mt-1 rounded-lg border border-emerald-500/30 bg-emerald-950/30 py-1.5">
              <span className="font-display text-base font-bold neon-green">
                {nextMult > 0 ? `${nextMult.toFixed(2)}x` : "—"}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-widest text-purple-200/70">Cobro</div>
            <div className="mt-1 rounded-lg border border-purple-500/40 bg-purple-950/30 py-1.5">
              <span className="font-display text-base font-bold text-purple-200">
                {step > 0 ? `${currentMult.toFixed(2)}x` : "—"}
              </span>
            </div>
          </div>
        </section>

        {/* Escena (cámara fija; la gallina permanece centrada, los asteroides se mueven hacia ella).
            Sin marco/borde — se mezcla directamente con el fondo espacial de la página. */}
        <section
          className="chicken-stage relative mt-1.5 min-h-0 flex-1"
          data-anim={chickenFx}
        >
          {/* asteroide CENTRAL (sobre el que está parada la gallina) */}
          <div className="chicken-slot chicken-slot-center">
            <img src={IMG_ASTEROID} alt="" className="chicken-asteroid-img" draggable={false} />
          </div>

          {/* asteroide DERECHO — el próximo objetivo. Entra por la derecha. */}
          {rightVisible && (phase === "playing" || phase === "jumping" || phase === "lost") && (
            <div
              className={`chicken-slot chicken-slot-right ${rightFx === "shake-break" ? "chicken-asteroid-shake" : ""} ${rightFx === "broken" && (chickenFx === "fall" || chickenFx === "fail-still") ? "chicken-asteroid-falling" : ""}`}
              data-fade={phase === "playing" && chickenFx === "idle" ? "in" : "stay"}
            >
              <img
                src={rightFx === "broken" ? IMG_ASTEROID_BROKEN : IMG_ASTEROID}
                alt=""
                className="chicken-asteroid-img"
                draggable={false}
              />
              {nextMult > 0 && phase === "playing" && chickenFx === "idle" && (
                <div className="chicken-mult-chip">{nextMult.toFixed(2)}x</div>
              )}
            </div>
          )}

          {/* gallina (encima del asteroide actual) */}
          <div
            className={`chicken-sprite chicken-fx-${chickenFx}`}
            data-no-smooth-image="true"
          >
            <img
              src={chickenSpriteFor(chickenFx)}
              alt=""
              className="chicken-sprite-img"
              draggable={false}
            />
            <span className="chicken-foot-shadow" aria-hidden="true" />
          </div>

          {/* Indicador de "cargando impulso" durante la espera del servidor */}
          {chickenFx === "prepare" && (
            <div className="chicken-charge-hint pointer-events-none">
              <span className="chicken-charge-hint-text">CARGANDO IMPULSO</span>
              <span className="chicken-charge-hint-dots">
                <i /><i /><i />
              </span>
            </div>
          )}

          {/* Banner inicial CLUCK — arriba de la gallina */}
          {phase === "idle" && !isDealing && (
            <div className="chicken-motivation-banner">
              <div className="chicken-motivation-enter text-center">
                <div
                  className="chicken-cluck-title font-display text-6xl font-black uppercase tracking-tight text-white sm:text-7xl"
                  data-text="¡CLUCK!"
                >
                  ¡CLUCK!
                </div>
                <div className="chicken-cluck-subtitle mt-2 font-display text-xs font-bold uppercase tracking-widest text-purple-100/90">
                  <span key="a" className="chicken-cluck-sub chicken-cluck-sub-a">¿Hasta dónde llegarás?</span>
                  <span key="b" className="chicken-cluck-sub chicken-cluck-sub-b">Apuesta ahora</span>
                </div>
              </div>
            </div>
          )}

          {/* READY verde — aparece inmediatamente tras pulsar JUGAR */}
          {phase === "idle" && isDealing && (
            <div className="chicken-motivation-banner">
              <div className="chicken-motivation-enter text-center">
                <div className="chicken-ready-title font-display text-6xl font-black uppercase tracking-tight text-emerald-400 sm:text-7xl">
                  READY
                </div>
              </div>
            </div>
          )}

          {/* Micro-banner motivacional tras cada salto exitoso */}
          {displayedStep >= 1 &&
            (phase === "playing" ||
              (phase === "jumping" &&
                (chickenFx === "prepare" ||
                  chickenFx === "jump-left-to-right" ||
                  chickenFx === "land-bounce" ||
                  chickenFx === "slide-to-left"))) && (
            <div
              key={displayedStep}
              className="chicken-motivation-banner px-6"
            >
              <div
                className={`chicken-motivation-text max-w-[18rem] text-center ${chickenFx === "slide-to-left" ? "is-exiting" : ""}`}
              >
                <div
                  className="font-display text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl"
                  style={{ textShadow: "0 3px 10px rgba(0,0,0,0.85)" }}
                >
                  {chickenEncouragement(displayedStep)}
                </div>
              </div>
            </div>
          )}

          {phase === "lost" && (
            <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
              <div className="result-pop-lose rounded-xl border border-rose-500/60 bg-[#0c0620]/85 px-5 py-3 text-center">
                <div className="font-display text-2xl font-black neon-red">¡SE ROMPIÓ!</div>
                <div className="text-xs font-bold text-rose-300">Perdiste tu apuesta</div>
              </div>
            </div>
          )}

          {phase === "cashed" && (
            <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
              <div className="result-pop-win rounded-xl border border-emerald-500/60 bg-[#0c0620]/90 px-5 py-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-emerald-200/80">¡Cobraste!</div>
                <div className="font-display text-2xl font-black neon-green">+{formatCOP(lastPayout)} COP</div>
                <div className="text-xs font-bold text-emerald-300">{currentMult.toFixed(2)}x</div>
              </div>
            </div>
          )}
        </section>

        {/* Panel de apuesta — idéntico a Mines */}
        <section className="mt-1.5 shrink-0 rounded-2xl border border-purple-500/30 glass-panel p-2">
          <div className="text-center text-[10px] uppercase tracking-widest text-purple-200/70">Apuesta (COP)</div>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBet((b) => Math.max(CHICKEN_MIN_BET, b - CHICKEN_BET_STEP))}
              disabled={phase !== "idle"}
              className="btn-bet flex h-11 w-12 items-center justify-center rounded-lg disabled:opacity-50"
              aria-label="Disminuir apuesta"
            >
              <Minus className="h-5 w-5" />
            </button>
            <div className="h-11 w-full min-w-0 flex-1 cursor-default rounded-lg border border-purple-500/30 bg-[#160830]/60 px-2 font-display text-xl font-bold text-white">
              <BetAmount bet={bet} bonusBalance={bonusBalance} />
            </div>
            <button
              type="button"
              onClick={() => setBet((b) => clampBetToStep(b + CHICKEN_BET_STEP, balance, CHICKEN_MAX_BET, CHICKEN_BET_STEP, CHICKEN_MIN_BET))}
              disabled={phase !== "idle"}
              className="btn-bet flex h-11 w-12 items-center justify-center rounded-lg disabled:opacity-50"
              aria-label="Aumentar apuesta"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBet((b) => clampBetToStep(b * 2, balance, CHICKEN_MAX_BET, CHICKEN_BET_STEP, CHICKEN_MIN_BET))}
              disabled={phase !== "idle"}
              className="btn-bet flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold disabled:opacity-50"
            >
              X2
            </button>
            {QUICK_ADDS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBet((b) => clampBetToStep(b + amt, balance, CHICKEN_MAX_BET, CHICKEN_BET_STEP, CHICKEN_MIN_BET))}
                disabled={phase !== "idle"}
                className="btn-bet flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold disabled:opacity-50"
              >
                +{formatCOP(amt)}
              </button>
            ))}
          </div>
          <div className="mt-1 text-center text-[10px] text-purple-300/70">
            MÍNIMO: {formatCOP(CHICKEN_MIN_BET)} COP · PASO: {formatCOP(CHICKEN_BET_STEP)}
          </div>

          {/* Botón principal — estados */}
          <div className="mt-3">
            {phase === "idle" && (
              <button
                type="button"
                onClick={startGame}
                disabled={!canStart}
                className="btn-primary-green btn-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-black uppercase tracking-widest disabled:opacity-50"
              >
                JUGAR
              </button>
            )}
            {(phase === "playing" || phase === "jumping") && step === 0 && (
              <button
                type="button"
                onClick={jump}
                disabled={phase !== "playing"}
                className="btn-primary-green btn-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-black uppercase tracking-widest disabled:opacity-50"
              >
                SALTAR
              </button>
            )}
            {(phase === "playing" || phase === "jumping") && step >= 1 && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={cashout}
                  disabled={phase !== "playing"}
                  className="btn-primary-red btn-primary-action btn-pop-in flex h-12 w-full flex-col items-center justify-center rounded-xl font-display font-black uppercase tracking-widest disabled:opacity-50"
                >
                  <span className="text-xs leading-none">COBRAR</span>
                  <span className="text-base leading-tight">{formatCOP(Math.floor(bet * currentMult))} COP</span>
                </button>
                <button
                  type="button"
                  onClick={jump}
                  disabled={phase !== "playing"}
                  className="btn-primary-green btn-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-black uppercase tracking-widest disabled:opacity-50"
                >
                  SALTAR
                </button>
              </div>
            )}
            {phase === "lost" && (
              <button
                type="button"
                onClick={resetToIdle}
                className="btn-primary-green btn-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-black uppercase tracking-widest"
              >
                JUGAR DE NUEVO
              </button>
            )}
            {phase === "cashed" && (
              <button
                type="button"
                onClick={resetToIdle}
                className="btn-primary-green btn-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-black uppercase tracking-widest"
              >
                JUGAR DE NUEVO
              </button>
            )}
          </div>

          {error && (
            <div className="mt-2 text-center text-xs font-semibold text-rose-300">{error}</div>
          )}
        </section>

      </div>
    </div>
  );
}

function chickenSpriteFor(fx: ChickenFx): string {
  switch (fx) {
    case "prepare": return IMG_PREPARE;
    case "jump-left-to-right": return IMG_JUMP;
    case "land-bounce": return IMG_IDLE;
    case "slide-to-left": return IMG_IDLE;
    case "fall": return IMG_FAIL;
    case "fail-still": return IMG_FAIL;
    case "idle":
    default:
      return IMG_IDLE;
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const ENCOURAGEMENTS = [
  "¿Otra más?",
  "¡Y si saltamos otra!",
  "¡Cluuuck!",
  "¡Sigue, sigue!",
  "¡Una más, valiente!",
  "¡Cluck cluck!",
  "¡No pares ahora!",
  "¡Vamos por más!",
];
function chickenEncouragement(step: number): string {
  if (step <= 0) return "";
  return ENCOURAGEMENTS[(step - 1) % ENCOURAGEMENTS.length];
}