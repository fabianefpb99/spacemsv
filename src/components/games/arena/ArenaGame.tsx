import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Menu } from "lucide-react";

import { useMe } from "@/hooks/useMe";
import { AuthControl } from "@/components/auth/AuthControl";
import betspaceLogo from "@/assets/betspace-logo.svg";
import { playArena } from "@/lib/games/arena.functions";
import {
  ARENA_MIN_BET,
  type ArenaCharacterId,
  type ArenaRoundResult,
} from "@/lib/games/arena.shared";

import { ArenaLobby } from "./ArenaLobby";
import { ArenaFight } from "./ArenaFight";
import { ArenaResult } from "./ArenaResult";
import { BettingPanel } from "./BettingPanel";
import { ARENA_BACKGROUNDS, ARENA_CHARACTER_META } from "./characters";
import arenaFightAudio from "@/assets/audio/arena/arena-fight.mp3.asset.json";
import fightStartAudio from "@/assets/audio/arena/fight-start.mp3.asset.json";
import hit1Audio from "@/assets/audio/arena/hit-1.mp3.asset.json";
import hit2Audio from "@/assets/audio/arena/hit-2.mp3.asset.json";
import hit3Audio from "@/assets/audio/arena/hit-3.mp3.asset.json";
import hit4Audio from "@/assets/audio/arena/hit-4.mp3.asset.json";
import hit5Audio from "@/assets/audio/arena/hit-5.mp3.asset.json";
import hitFinalAudio from "@/assets/audio/arena/hit-final.mp3.asset.json";

type Phase = "lobby" | "fighting" | "result";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

/**
 * Top-level orchestrator for /arena.
 *  - owns selection + bet state
 *  - calls playArena once per round
 *  - drives the phase machine: lobby → fighting → result → lobby
 *
 * Sub-components are stateless presentational pieces so each can be
 * edited in isolation.
 */
export function ArenaGame() {
  const me = useMe();
  const queryClient = useQueryClient();
  const play = useServerFn(playArena);

  const [selected, setSelected] = useState<ArenaCharacterId | null>(null);
  const [bet, setBet] = useState(ARENA_MIN_BET);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [result, setResult] = useState<ArenaRoundResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recentWinners, setRecentWinners] = useState<ArenaCharacterId[]>(() => {
    const DEFAULTS: ArenaCharacterId[] = [
      "titan", "nova", "blaze", "shadow", "titan", "shadow", "nova", "blaze",
    ];
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = window.localStorage.getItem("arena:recent-winners");
      if (!raw) return DEFAULTS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULTS;
      const stored = parsed.slice(0, 8) as ArenaCharacterId[];
      // Rellenar con defaults si hay menos de 8
      return stored.length >= 8
        ? stored
        : [...stored, ...DEFAULTS].slice(0, 8);
    } catch {
      return DEFAULTS;
    }
  });

  // Preload every sprite / background / SFX as soon as the player lands on
  // the arena, so by the time the fight starts the browser cache has the
  // assets ready and the scene paints in a single frame instead of trickling
  // in piece-by-piece.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const imageUrls: string[] = [
      ARENA_BACKGROUNDS.lobby,
      ARENA_BACKGROUNDS.fight,
      ...Object.values(ARENA_CHARACTER_META).flatMap((c) => Object.values(c.sprites)),
    ];
    const audioUrls: string[] = [
      arenaFightAudio.url,
      fightStartAudio.url,
      hit1Audio.url,
      hit2Audio.url,
      hit3Audio.url,
      hit4Audio.url,
      hit5Audio.url,
      hitFinalAudio.url,
    ];
    const imgs = imageUrls.map((src) => {
      const i = new Image();
      i.decoding = "async";
      i.src = src;
      return i;
    });
    const auds = audioUrls.map((src) => {
      const a = new Audio();
      a.preload = "auto";
      a.src = src;
      return a;
    });
    return () => {
      imgs.length = 0;
      auds.forEach((a) => {
        a.pause();
        a.src = "";
      });
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("arena:recent-winners", JSON.stringify(recentWinners));
    } catch {
      // ignore
    }
  }, [recentWinners]);

  const balance = (me.data?.balance ?? 0) + (me.data?.bonus_balance ?? 0);
  const bonusBalance = me.data?.bonus_balance ?? 0;

  const handlePlay = useCallback(async () => {
    if (!selected || isPlaying) return;
    if (bet > balance) {
      toast.error("Saldo insuficiente");
      return;
    }
    setIsPlaying(true);
    try {
      const action_id = crypto.randomUUID();
      const res = await play({ data: { bet, character: selected, client_action_id: action_id } });
      setResult(res);
      setPhase("fighting");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al pelear";
      toast.error(msg);
      setIsPlaying(false);
    }
  }, [selected, bet, balance, isPlaying, play]);

  const handleFightComplete = useCallback(() => {
    setPhase("result");
    if (result?.winner) {
      setRecentWinners((prev) => [result.winner, ...prev].slice(0, 8));
    }
    // Refresh balance after the round settles.
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [queryClient, result?.winner]);

  const handlePlayAgain = useCallback(() => {
    setResult(null);
    setPhase("lobby");
    setIsPlaying(false);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060210] text-white">
      {/* Full-bleed arena background — covers the entire viewport.
          Swaps art between selection (lobby) and combat (fight). */}
      <div
        className="pointer-events-none fixed inset-0 -z-0 bg-cover bg-center transition-[background-image] duration-500"
        style={{
          backgroundImage: `url(${phase === "lobby" ? ARENA_BACKGROUNDS.lobby : ARENA_BACKGROUNDS.fight})`,
        }}
      />
      <div className="pointer-events-none fixed inset-0 -z-0 bg-gradient-to-b from-black/55 via-black/15 to-black/80" />
      {/* Stadium light sweep — subtle, on a loop, on top of the backdrop */}
      <div
        className={`arena-stadium-lights pointer-events-none fixed inset-0 -z-0 ${
          phase === "result" ? "is-result" : ""
        }`}
      />

      <div className="relative z-10 mx-auto flex h-screen max-w-md flex-col px-3 pb-2 pt-2 sm:max-w-lg sm:px-4">
        {/* Header (matches Mines/Spaceman/Dados) */}
        <header
          className="flex items-center justify-between border-b border-purple-500/20 bg-[#060210]/60 px-3 pb-2 -mx-3 -mt-3 backdrop-blur-sm"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <div className="flex items-center gap-1">
            <Link to="/home" className="rounded-md p-2 text-white hover:bg-white/10">
              <Menu className="h-7 w-7" strokeWidth={3} />
            </Link>
            <Link to="/home">
              <img src={betspaceLogo} alt="BETSPACE" className="h-6 w-auto sm:h-7 translate-y-px" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="font-display text-[11px] font-bold sm:text-xs text-white">
                <span className="mr-0.5 text-emerald-400">$</span>
                {formatCOP(balance)} COP
              </div>
            </div>
            <AuthControl />
          </div>
        </header>

        {/* Stage — fills all remaining vertical space, no scroll */}
        <div className="relative mt-2 min-h-0 flex-1">
          {phase === "lobby" && (
            <ArenaLobby selected={selected} onSelect={setSelected} disabled={isPlaying} />
          )}
          {(phase === "fighting" || phase === "result") && result && (
            <ArenaFight
              combatLog={result.combat_log}
              winner={result.winner}
              characterBet={result.character_bet}
              resultMode={phase === "result"}
              onComplete={handleFightComplete}
            />
          )}
          {phase === "result" && result && (
            <ArenaResult result={result} onPlayAgain={handlePlayAgain} />
          )}
        </div>

        {/* Compact betting HUD */}
        {phase === "lobby" && (
          <div className="mt-2 shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.15rem)]">
            <BettingPanel
              bet={bet}
              bonusBalance={bonusBalance}
              balance={balance}
              selected={selected}
              recentWinners={recentWinners}
              onBetChange={setBet}
              onSelect={setSelected}
              onPlay={handlePlay}
              isPlaying={isPlaying}
            />
          </div>
        )}
      </div>
    </div>
  );
}