/**
 * Arena character visual config — purely presentational.
 * Asset URLs come from CDN pointers in src/assets/arena/.
 * Side determines which half of the arena the sprite renders on
 * (the artwork is already drawn facing the opposite side).
 */
import { ARENA_ODDS, type ArenaCharacterId } from "@/lib/games/arena.shared";

import novaIdle from "@/assets/arena/nova-idle.png.asset.json";
import novaStance from "@/assets/arena/nova-stance.png.asset.json";
import novaAttack from "@/assets/arena/nova-attack.png.asset.json";
import novaDamage from "@/assets/arena/nova-damage.png.asset.json";

import shadowIdle from "@/assets/arena/shadow-idle.png.asset.json";
import shadowStance from "@/assets/arena/shadow-stance.png.asset.json";
import shadowAttack from "@/assets/arena/shadow-attack.png.asset.json";
import shadowDamage from "@/assets/arena/shadow-damage.png.asset.json";

import titanIdle from "@/assets/arena/titan-idle.png.asset.json";
import titanStance from "@/assets/arena/titan-stance.png.asset.json";
import titanAttack from "@/assets/arena/titan-attack.png.asset.json";
import titanDamage from "@/assets/arena/titan-damage.png.asset.json";

import blazeIdle from "@/assets/arena/blaze-idle.png.asset.json";
import blazeStance from "@/assets/arena/blaze-stance.png.asset.json";
import blazeAttack from "@/assets/arena/blaze-attack.png.asset.json";
import blazeDamage from "@/assets/arena/blaze-damage.png.asset.json";

import arenaLobbyBg from "@/assets/arena/arena-lobby-v4.png.asset.json";
import arenaFightBg from "@/assets/arena/arena-fight-final.png.asset.json";

export type ArenaSpritePhase = "idle" | "stance" | "attack" | "damage";

export type ArenaCharacterMeta = {
  id: ArenaCharacterId;
  name: string;
  tagline: string;
  /** "left" = stays on left half of arena; "right" = right half. */
  side: "left" | "right";
  /** Theme color (hex) for accents, HP bars, name highlight. */
  color: string;
  panelTone: string;
  glow: string;
  wins: number;
  odds: number;
  sprites: Record<ArenaSpritePhase, string>;
};

export const ARENA_CHARACTER_META: Record<ArenaCharacterId, ArenaCharacterMeta> = {
  nova: {
    id: "nova",
    name: "NOVA",
    tagline: "Estrella prodigio",
    side: "left",
    color: "#22d3ee",
    panelTone: "rgba(34, 211, 238, 0.16)",
    glow: "rgba(34, 211, 238, 0.6)",
    wins: 52,
    odds: ARENA_ODDS.nova,
    sprites: {
      idle: novaIdle.url,
      stance: novaStance.url,
      attack: novaAttack.url,
      damage: novaDamage.url,
    },
  },
  shadow: {
    id: "shadow",
    name: "SHADOW",
    tagline: "Asesino silencioso",
    side: "left",
    color: "#a855f7",
    panelTone: "rgba(168, 85, 247, 0.16)",
    glow: "rgba(168, 85, 247, 0.58)",
    wins: 48,
    odds: ARENA_ODDS.shadow,
    sprites: {
      idle: shadowIdle.url,
      stance: shadowStance.url,
      attack: shadowAttack.url,
      damage: shadowDamage.url,
    },
  },
  titan: {
    id: "titan",
    name: "TITAN",
    tagline: "Coloso espartano",
    side: "right",
    color: "#ef4444",
    panelTone: "rgba(239, 68, 68, 0.16)",
    glow: "rgba(239, 68, 68, 0.58)",
    wins: 40,
    odds: ARENA_ODDS.titan,
    sprites: {
      idle: titanIdle.url,
      stance: titanStance.url,
      attack: titanAttack.url,
      damage: titanDamage.url,
    },
  },
  blaze: {
    id: "blaze",
    name: "BLAZE",
    tagline: "Outsider intergaláctico",
    side: "right",
    color: "#22c55e",
    panelTone: "rgba(34, 197, 94, 0.16)",
    glow: "rgba(34, 197, 94, 0.58)",
    wins: 46,
    odds: ARENA_ODDS.blaze,
    sprites: {
      idle: blazeIdle.url,
      stance: blazeStance.url,
      attack: blazeAttack.url,
      damage: blazeDamage.url,
    },
  },
};

export const ARENA_BACKGROUNDS = {
  lobby: arenaLobbyBg.url,
  fight: arenaFightBg.url,
} as const;