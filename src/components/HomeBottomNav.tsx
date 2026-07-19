import { Link } from "@tanstack/react-router";
import { Home, Star, Wallet, User, Trophy } from "lucide-react";

function BottomItem({ icon, label, active, to }: { icon: React.ReactNode; label: string; active?: boolean; to?: string }) {
  const className = `home-bottom-item flex w-14 flex-col items-center gap-1 ${active ? "home-bottom-item--active text-emerald-400" : "text-purple-300/70 hover:text-purple-200"}`;
  if (to) {
    return (
      <Link to={to} className={className}>
        {icon}
        <span className="text-[9px] font-bold tracking-wider">{label}</span>
      </Link>
    );
  }
  return (
    <button className={className}>
      {icon}
      <span className="text-[9px] font-bold tracking-wider">{label}</span>
    </button>
  );
}

function BottomCenter() {
  return (
    <Link to="/ranking" className="home-bottom-center -mt-7 flex w-16 flex-col items-center gap-1">
      <span className="home-bottom-center-circle theme-dark-fixed flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-500/20 bg-[#060210] shadow-lg shadow-purple-900/60">
        <Trophy className="h-7 w-7 text-purple-300/70" strokeWidth={2.2} />
      </span>
      <span className="home-bottom-center-label text-[9px] font-bold tracking-wider text-purple-200">RANKING</span>
    </Link>
  );
}

export function HomeBottomNav({ activeKey }: { activeKey?: "inicio" | "eventos" | "deposito" | "perfil" }) {
  return (
    <nav
      className="home-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-purple-500/20 bg-[#060210]/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-md items-end justify-between px-4 pt-2 pb-2 sm:max-w-lg">
        <BottomItem icon={<Home className="h-5 w-5" />} label="INICIO" to="/" active={activeKey === "inicio"} />
        <BottomItem icon={<Star className="h-5 w-5" />} label="EVENTOS" to="/eventos" active={activeKey === "eventos"} />
        <BottomCenter />
        <BottomItem icon={<Wallet className="h-5 w-5" />} label="DEPÓSITO" to="/pay" active={activeKey === "deposito"} />
        <BottomItem icon={<User className="h-5 w-5" />} label="PERFIL" to="/perfil" active={activeKey === "perfil"} />
      </div>
    </nav>
  );
}
