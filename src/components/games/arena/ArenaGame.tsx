import { useCallback, useState } from "react";
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
import { ARENA_BACKGROUNDS } from "./characters";

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
    // Refresh balance after the round settles.
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [queryClient]);

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

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-3 pb-3 pt-3 sm:max-w-lg sm:px-4">
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

        {/* Stage — fills available vertical space; bg image lives here */}
        <div className="relative mt-2 flex-1 min-h-0">
          {phase === "lobby" && (
            <ArenaLobby selected={selected} onSelect={setSelected} disabled={isPlaying} />
          )}
          {(phase === "fighting" || phase === "result") && result && (
            <ArenaFight
              combatLog={result.combat_log}
              winner={result.winner}
              characterBet={result.character_bet}
              onComplete={handleFightComplete}
            />
          )}
          {phase === "result" && result && (
            <ArenaResult result={result} onPlayAgain={handlePlayAgain} />
          )}
        </div>

        {/* Compact betting HUD */}
        {phase === "lobby" && (
          <div className="mt-2">
            <BettingPanel
              bet={bet}
              bonusBalance={bonusBalance}
              balance={balance}
              selected={selected}
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