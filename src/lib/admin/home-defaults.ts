// Default Slider + Featured Games shown on the Home before the admin
// has customized anything. Same source used to seed the database from
// the admin panel via "Cargar contenido actual".

import heroImg from "@/assets/home-hero.jpg";
import heroMinesImg from "@/assets/home-hero-mines.jpg";
import heroSlotImg from "@/assets/home-hero-slot.jpg";
import heroDiceImg from "@/assets/home-hero-dice.jpg";
import heroBlackjackImg from "@/assets/home-hero-blackjack.jpg";
import heroRuletaImg from "@/assets/home-hero-ruleta.jpg";
import heroArenaImg from "@/assets/home-hero-arena.png.asset.json";
import gameSpaceman from "@/assets/game-spaceman.jpg";
import gameSlotMafia from "@/assets/game-slot-mafia.jpg";
import gameMines from "@/assets/game-mines.jpg";
import gameDice from "@/assets/game-dice.jpg";

export type DefaultSlide = {
  img: string;
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  to: string;
};

export type DefaultFeatured = {
  name: string;
  img: string;
  tag: string;
  tag_color: "purple" | "emerald" | "rose" | "amber" | "fuchsia";
  to: string;
};

export const DEFAULT_SLIDES: DefaultSlide[] = [
  { img: heroArenaImg.url, eyebrow: "ENTRA A LA", title: "ARENA", desc: "Apuesta por tu campeón\ny gana hasta 6.5x.", cta: "Jugar Arena", to: "/arena" },
  { img: heroImg, eyebrow: "¡BIENVENIDO A", title: "SPACEMAN", desc: "Apuesta, multiplica\ny gana en las estrellas.", cta: "Jugar ahora", to: "/spaceman" },
  { img: heroMinesImg, eyebrow: "DESCUBRE", title: "BUSCAMINAS", desc: "Esquiva minas,\nrevela gemas y gana.", cta: "Jugar Minas", to: "/mines" },
  { img: heroSlotImg, eyebrow: "GIRA EN", title: "SLOT MAFIA", desc: "Alinea los 777\ny llévate el botín.", cta: "Jugar Slot", to: "/slot" },
  { img: heroDiceImg, eyebrow: "LANZA LOS", title: "DADOS", desc: "Predice, apuesta\ny multiplica tu suerte.", cta: "Jugar Dados", to: "/dados" },
  { img: heroBlackjackImg, eyebrow: "JUEGA AL", title: "BLACKJACK", desc: "Llega a 21\ny vence a la banca.", cta: "Jugar Blackjack", to: "/blackjack" },
  { img: heroRuletaImg, eyebrow: "GIRA LA", title: "RULETA", desc: "Rojo, negro o verde:\napuesta y multiplica.", cta: "Jugar Ruleta", to: "/ruleta" },
];

export const DEFAULT_FEATURED: DefaultFeatured[] = [
  { name: "SPACEMAN", img: gameSpaceman, tag: "POPULAR", tag_color: "purple", to: "/spaceman" },
  { name: "SLOT", img: gameSlotMafia, tag: "NUEVO", tag_color: "emerald", to: "/slot" },
  { name: "MINAS", img: gameMines, tag: "POPULAR", tag_color: "purple", to: "/mines" },
  { name: "DICE", img: gameDice, tag: "CLÁSICO", tag_color: "rose", to: "/dados" },
];