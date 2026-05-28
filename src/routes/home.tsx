import { createFileRoute, Link } from "@tanstack/react-router";
import { Menu, Settings, Trophy, ChevronRight, Gift, Home, Gamepad2, Wallet, User } from "lucide-react";
import { useState } from "react";
import astronautRocket from "@/assets/astronaut-rocket.svg";
import heroImg from "@/assets/home-hero.jpg";
import gameSpaceman from "@/assets/game-spaceman.jpg";
import gameCrash from "@/assets/game-crash.jpg";
import gameMines from "@/assets/game-mines.jpg";
import gameDice from "@/assets/game-dice.jpg";

const LAST_WINS = [
  { user: "Usuario123", game: "Spaceman", amount: 252413, mult: 1.85 },
  { user: "Astronauta7", game: "Crash", amount: 121876, mult: 2.34 },
  { user: "GalaxyWin", game: "Mines", amount: 82776, mult: 3.12 },
  { user: "MoonPlayer", game: "Dice", amount: 61329, mult: 1.45 },
  { user: "NovaKing", game: "Spaceman", amount: 47892, mult: 1.27 },
  { user: "StarHunter", game: "Crash", amount: 198344, mult: 2.91 },
  { user: "CometRider", game: "Mines", amount: 35421, mult: 4.08 },
  { user: "LunarFox", game: "Dice", amount: 78215, mult: 1.62 },
  { user: "OrbitX", game: "Spaceman", amount: 134567, mult: 2.18 },
  { user: "PlasmaGirl", game: "Crash", amount: 56892, mult: 1.74 },
  { user: "VoidWalker", game: "Mines", amount: 312485, mult: 5.43 },
  { user: "GalaxyKid", game: "Dice", amount: 22719, mult: 1.18 },
  { user: "RocketJoe", game: "Spaceman", amount: 89124, mult: 1.96 },
  { user: "NebulaQ", game: "Crash", amount: 145678, mult: 2.67 },
  { user: "MeteorMax", game: "Mines", amount: 67432, mult: 3.21 },
  { user: "AlphaStar", game: "Dice", amount: 41587, mult: 1.53 },
];

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Inicio — BetSpaceman" },
      { name: "description", content: "Tu home en BetSpaceman: juegos destacados, jackpot y más." },
      { property: "og:title", content: "Inicio — BetSpaceman" },
      { property: "og:description", content: "Tu home en BetSpaceman: juegos destacados, jackpot y más." },
    ],
  }),
  component: HomePage,
});

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

const GAMES = [
  { name: "SPACEMAN", img: gameSpaceman, tag: "POPULAR", tagCls: "bg-purple-600/40 text-purple-200 border-purple-500/50", to: "/spaceman" },
  { name: "CRASH", img: gameCrash, tag: "NUEVO", tagCls: "bg-emerald-600/30 text-emerald-200 border-emerald-500/50", to: "/home" },
  { name: "MINES", img: gameMines, tag: "POPULAR", tagCls: "bg-purple-600/40 text-purple-200 border-purple-500/50", to: "/mines" },
  { name: "DICE", img: gameDice, tag: "CLÁSICO", tagCls: "bg-rose-600/30 text-rose-200 border-rose-500/50", to: "/home" },
];

function HomePage() {
  const [balance] = useState(100000);
  const [online] = useState(219);
  const [slide, setSlide] = useState(0);
  const slides = 4;

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6 pt-4 sm:max-w-lg sm:px-4">
        {/* Header — must match SpacemanGame header exactly, sin icono de sonido */}
        <header
          className="flex items-center justify-between bg-[#060210] border-b border-purple-500/20 pb-3 px-3 -mx-3 -mt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <button className="rounded-md p-2 text-white hover:bg-white/10">
            <Menu className="h-7 w-7" strokeWidth={3} />
          </button>
          <Link to="/home">
            <h1 className="font-display text-sm font-black leading-tight tracking-widest sm:text-base">
              BETSPACEMAN
            </h1>
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-purple-200/70">Balance</div>
              <div className="font-display text-xs font-bold sm:text-sm text-white">
                <span className="neon-green mr-0.5">$</span>{formatCOP(balance)} COP
              </div>
            </div>
            <button className="rounded-md p-1.5 text-purple-200/80 hover:bg-white/5">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </header>

        {/* Online indicator */}
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-semibold text-emerald-300/90">{online} ONLINE</span>
        </div>

        {/* Hero banner */}
        <section className="mt-3 overflow-hidden rounded-2xl border border-purple-500/30 bg-[#1a0b3a]">
          <div className="relative h-44 sm:h-52">
            <img
              src={heroImg}
              alt="Astronauta volando en el universo"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1a0b3a] via-[#1a0b3a]/80 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center gap-2 p-4 sm:p-5">
              <p className="font-display text-xs tracking-widest text-purple-100/80">¡BIENVENIDO A</p>
              <h2 className="font-display text-2xl font-black leading-tight tracking-wide text-white drop-shadow sm:text-3xl">
                BETSPACEMAN!
              </h2>
              <p className="max-w-[55%] text-xs text-purple-100/80 sm:text-sm">
                Apuesta, multiplica<br />y gana en las estrellas.
              </p>
              <Link
                to="/"
                className="mt-1 inline-flex w-fit items-center justify-center rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/50 transition hover:bg-purple-500"
              >
                Jugar ahora
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-2.5">
            {Array.from({ length: slides }).map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-4 bg-purple-400" : "w-1.5 bg-purple-200/30"}`}
              />
            ))}
          </div>
        </section>

        {/* Featured games */}
        <section className="mt-5">
          <div className="flex items-end justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white">
              Juegos destacados
            </h3>
            <button className="text-xs font-semibold text-purple-300 hover:text-purple-200">
              Ver todos
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
            {GAMES.map((g) => (
              <Link
                key={g.name}
                to={g.to}
                className="group flex flex-col overflow-hidden rounded-xl border border-purple-500/20 bg-[#0c0620] transition hover:border-purple-400/50"
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img
                    src={g.img}
                    alt={g.name}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col items-center gap-1 px-1 py-2">
                  <span className="font-display text-[10px] font-bold tracking-wider text-white sm:text-xs">
                    {g.name}
                  </span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider sm:text-[9px] ${g.tagCls}`}>
                    {g.tag}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Jackpot */}
        <section className="mt-5 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-gradient-to-r from-[#1a0b3a]/80 to-[#0c0620] p-3 sm:p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 sm:h-14 sm:w-14">
            <Trophy className="h-7 w-7 text-amber-400 sm:h-8 sm:w-8" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-purple-200/70">
              Jackpot activo
            </div>
            <div className="font-display text-base font-bold sm:text-lg">
              <span className="neon-green mr-1">$</span>
              <span className="text-white">{formatCOP(25000000)} COP</span>
            </div>
          </div>
          <button className="rounded-full border border-purple-500/40 p-2 text-purple-200 hover:bg-purple-500/10">
            <ChevronRight className="h-4 w-4" />
          </button>
        </section>

        {/* Últimas ganancias */}
        <section className="mt-5 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 p-3 sm:p-4">
          <h3 className="font-display text-xs font-bold uppercase tracking-widest text-white">
            Últimas ganancias
          </h3>
          <div
            className="relative mt-3 overflow-hidden"
            style={{
              height: "calc(4 * 52px)",
              maskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)",
            }}
          >
            <ul
              className="flex flex-col gap-2"
              style={{ animation: `wins-scroll ${LAST_WINS.length * 2.2}s linear infinite` }}
            >
              {[...LAST_WINS, ...LAST_WINS].map((w, i) => (
                <li
                  key={`${w.user}-${i}`}
                  className="flex h-[44px] items-center gap-3 rounded-lg border border-purple-500/20 bg-[#150830]/60 px-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600/30 ring-1 ring-purple-400/30">
                    <User className="h-4 w-4 text-purple-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white">{w.user}</div>
                    <div className="text-[10px] uppercase tracking-wider text-purple-300/70">{w.game}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xs font-bold">
                      <span className="neon-green mr-0.5">$</span>
                      <span className="text-white">{formatCOP(w.amount)} COP</span>
                    </div>
                    <div className="text-[10px] font-bold text-purple-300">{w.mult.toFixed(2)}x</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <style>{`
            @keyframes wins-scroll {
              0% { transform: translateY(0); }
              100% { transform: translateY(calc(-${LAST_WINS.length} * 52px)); }
            }
          `}</style>
        </section>

        {/* Invita y gana */}
        <section className="mt-4 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-gradient-to-r from-[#1a0b3a]/80 to-[#0c0620] p-3 sm:p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 ring-1 ring-pink-400/30">
            <Gift className="h-6 w-6 text-pink-400" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Invita y gana
            </div>
            <div className="text-[11px] text-purple-200/70">
              Obtén 5% de tus referidos
            </div>
          </div>
          <button className="rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/50 hover:bg-purple-500">
            Invitar
          </button>
        </section>

        {/* Spacer for bottom nav */}
        <div className="h-24" />
      </div>

      {/* Bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-purple-500/20 bg-[#060210]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-md items-end justify-between px-4 pt-2 pb-2 sm:max-w-lg">
          <BottomItem icon={<Home className="h-5 w-5" />} label="INICIO" active />
          <BottomItem icon={<Gamepad2 className="h-5 w-5" />} label="JUEGOS" />
          <BottomCenter />
          <BottomItem icon={<Wallet className="h-5 w-5" />} label="DEPÓSITO" />
          <BottomItem icon={<User className="h-5 w-5" />} label="PERFIL" />
        </div>
      </nav>
    </div>
  );
}

function BottomItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      className={`flex w-14 flex-col items-center gap-1 ${active ? "text-emerald-400" : "text-purple-300/70 hover:text-purple-200"}`}
    >
      {icon}
      <span className="text-[9px] font-bold tracking-wider">{label}</span>
    </button>
  );
}

function BottomCenter() {
  return (
    <Link to="/spaceman" className="-mt-7 flex w-16 flex-col items-center gap-1">
      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-purple-400/60 shadow-lg shadow-purple-900/60">
        <img src={gameSpaceman} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="text-[9px] font-bold tracking-wider text-purple-200">SPACEMAN</span>
    </Link>
  );
}

/* sentinel */
function _unused() {
  return null;
}