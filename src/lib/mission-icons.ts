import iconSwords from "@/assets/mission-swords.png.asset.json";
import iconCoins from "@/assets/mission-coins.png.asset.json";
import iconSparkles from "@/assets/mission-sparkles.png.asset.json";
import iconUsers from "@/assets/mission-users.png.asset.json";
import iconTrophy from "@/assets/mission-trophy.png.asset.json";
import iconDice from "@/assets/mission-dice.png.asset.json";
import iconGift from "@/assets/mission-gift.png.asset.json";
import iconTarget from "@/assets/mission-target.png.asset.json";

export type MissionIconKey =
  | "swords"
  | "coins"
  | "sparkles"
  | "users"
  | "trophy"
  | "dice"
  | "gift"
  | "target";

export const MISSION_ICONS: { key: MissionIconKey; url: string; label: string }[] = [
  { key: "swords", url: iconSwords.url, label: "Espadas" },
  { key: "coins", url: iconCoins.url, label: "Monedas" },
  { key: "sparkles", url: iconSparkles.url, label: "Estrella" },
  { key: "users", url: iconUsers.url, label: "Amigos" },
  { key: "trophy", url: iconTrophy.url, label: "Trofeo" },
  { key: "dice", url: iconDice.url, label: "Dados" },
  { key: "gift", url: iconGift.url, label: "Regalo" },
  { key: "target", url: iconTarget.url, label: "Diana" },
];

const MAP: Record<string, string> = MISSION_ICONS.reduce(
  (acc, i) => ((acc[i.key] = i.url), acc),
  {} as Record<string, string>,
);

export function getMissionIconUrl(key: string | null | undefined): string {
  if (!key) return MISSION_ICONS[0].url;
  return MAP[key] ?? MISSION_ICONS[0].url;
}