import avatar1 from "@/assets/avatars/avatar-1.png.asset.json";
import avatar2 from "@/assets/avatars/avatar-2.png.asset.json";
import avatar3 from "@/assets/avatars/avatar-3.png.asset.json";
import avatar4 from "@/assets/avatars/avatar-4.png.asset.json";
import avatar5 from "@/assets/avatars/avatar-5.png.asset.json";
import avatar6 from "@/assets/avatars/avatar-6.png.asset.json";
import avatar7 from "@/assets/avatars/avatar-7.png.asset.json";
import avatar8 from "@/assets/avatars/avatar-8.png.asset.json";
import avatarArena from "@/assets/avatar-astronauta-arena.png.asset.json";
import astronautDefault from "@/assets/astronaut.svg";

export type AvatarKey =
  | "avatar-1"
  | "avatar-2"
  | "avatar-3"
  | "avatar-4"
  | "avatar-5"
  | "avatar-6"
  | "avatar-7"
  | "avatar-8"
  | "avatar-arena";

export type AvatarOption = {
  key: AvatarKey;
  url: string;
  label: string;
  collectible?: boolean;
  unlockHint?: string;
};

// Display order: astronaut (default) → men/characters → women at the end.
export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: "avatar-8", url: avatar8.url, label: "Astronauta" },
  { key: "avatar-1", url: avatar1.url, label: "Rey" },
  { key: "avatar-2", url: avatar2.url, label: "Asesino" },
  { key: "avatar-4", url: avatar4.url, label: "Caballero" },
  { key: "avatar-7", url: avatar7.url, label: "Mafioso" },
  { key: "avatar-3", url: avatar3.url, label: "Tiburón" },
  { key: "avatar-5", url: avatar5.url, label: "Dama" },
  { key: "avatar-6", url: avatar6.url, label: "Diosa" },
  {
    key: "avatar-arena",
    url: avatarArena.url,
    label: "Astronauta Dorado",
    collectible: true,
    unlockHint: "Gana 10 veces en ARENA",
  },
];

export const COLLECTIBLE_AVATARS = AVATAR_OPTIONS.filter((o) => o.collectible);

export const DEFAULT_AVATAR_KEY: AvatarKey = "avatar-8";
export const DEFAULT_AVATAR_FALLBACK = astronautDefault;

export function getAvatarUrl(key: string | null | undefined): string {
  if (!key) return DEFAULT_AVATAR_FALLBACK;
  const found = AVATAR_OPTIONS.find((o) => o.key === key);
  return found?.url ?? DEFAULT_AVATAR_FALLBACK;
}