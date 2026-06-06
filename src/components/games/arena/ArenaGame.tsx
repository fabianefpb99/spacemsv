import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useMe } from "@/hooks/useMe";
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
    <div className="min-h-screen bg-gradient-to-b from-[#0a0118] via-[#1a0533] to-[#0a0118] text-white">
      <div className="mx-auto flex max-w-md flex-col gap-3 p-3 pb-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/home"
            className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/80 backdrop-blur-sm hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Link>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Saldo</div>
            <div className="font-mono text-sm font-bold text-white">
              ${formatCOP(balance)}
            </div>
          </div>
        </header>

        {/* Stage (lobby or fight) */}
        <div className="relative">
          {phase === "lobby" && (
            <ArenaLobby
              selected={selected}
              onSelect={setSelected}
              disabled={isPlaying}
            />
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

        {/* Betting panel only on lobby */}
        {phase === "lobby" && (
          <BettingPanel
            bet={bet}
            bonusBalance={bonusBalance}
            balance={balance}
            selected={selected}
            onBetChange={setBet}
            onPlay={handlePlay}
            isPlaying={isPlaying}
          />
        )}
      </div>
    </div>
  );
}