import { Link, useNavigate } from "@tanstack/react-router";
import {
  Gift,
  History,
  Users,
  Settings,
  Headphones,
  Wallet,
  Trophy,
  User as UserIcon,
  Sun,
  Moon,
  X,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";
import betspaceLogo from "@/assets/betspace-logo.svg";

type Item = {
  label: string;
  icon: LucideIcon;
  to?: string;
};

const ITEMS: Item[] = [
  { label: "Bonus", icon: Gift },
  { label: "Historial", icon: History },
  { label: "Referidos", icon: Users },
  { label: "Depósito", icon: Wallet, to: "/pay" },
  { label: "Ranking", icon: Trophy, to: "/ranking" },
  { label: "Perfil", icon: UserIcon, to: "/perfil" },
  { label: "Configuración", icon: Settings },
  { label: "Soporte", icon: Headphones },
];

export function HamburgerDrawer({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const isLight = theme === "light";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="left"
        className="w-[82vw] max-w-[320px] border-r border-purple-500/20 bg-[#0a0418] p-0 text-white [&>button]:hidden"
      >
        <div
          className="flex h-full flex-col"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
        >
          {/* Header del drawer */}
          <div className="flex items-center justify-between px-4 pb-3">
            <Link
              to="/home"
              onClick={() => setOpen(false)}
              className="logo-shine"
              aria-label="Inicio"
            >
              <img src={betspaceLogo} alt="BETSPACE" className="h-5 w-auto" />
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="rounded-md p-1.5 text-white/80 hover:bg-white/10"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>

          <div className="mx-4 h-px bg-purple-500/15" />

          {/* Lista de opciones — compactas */}
          <nav className="mt-2 flex-1 overflow-y-auto px-2">
            <ul className="flex flex-col gap-0.5">
              {ITEMS.map((it) => (
                <li key={it.label}>
                  <button
                    type="button"
                    onClick={() => {
                      if (it.to) {
                        setOpen(false);
                        navigate({ to: it.to });
                      }
                    }}
                    className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-[#150830] text-fuchsia-300">
                      <it.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                    <span className="flex-1 text-[13px] font-semibold tracking-wide text-white/90">
                      {it.label}
                    </span>
                    <span className="text-white/30">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Switch de tema al pie */}
          <div className="border-t border-purple-500/15 px-4 py-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-[#150830]/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                {isLight ? (
                  <Sun className="h-4 w-4 text-amber-300" />
                ) : (
                  <Moon className="h-4 w-4 text-purple-200" />
                )}
                <div className="leading-tight">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white">
                    {isLight ? "Modo claro" : "Modo oscuro"}
                  </div>
                  <div className="text-[10px] text-purple-200/70">
                    Cambiar apariencia
                  </div>
                </div>
              </div>
              <Switch
                checked={isLight}
                onCheckedChange={toggle}
                aria-label="Cambiar tema"
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}