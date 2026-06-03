import { useState } from "react";
import { Settings, LogOut, User as UserIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { AuthDialog } from "./AuthDialog";
import { getAvatarUrl } from "@/lib/avatars";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(n));
}

/**
 * Reusable gear control:
 * - Logged out: opens AuthDialog.
 * - Logged in: opens a popover with profile + official balance + logout.
 *
 * Drop in wherever the existing Settings gear lives — same icon, same styling
 * intent, no layout changes.
 */
export function AuthControl({ className }: { className?: string }) {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const me = useMe();
  const balanceText = me.data ? formatCOP(me.data.balance) : "—";
  const bonusText = me.data ? formatCOP(me.data.bonus_balance) : null;

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          aria-label="Iniciar sesión"
          className={className ?? "rounded-md p-1.5 text-purple-200/80 hover:bg-white/5"}
        >
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
        <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Cuenta"
          className={className ?? "rounded-md p-1.5 text-purple-200/80 hover:bg-white/5"}
        >
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="z-50 w-[min(16rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] border-purple-500/40 bg-[#0c0620] text-white"
      >
        <div className="flex items-center gap-2 border-b border-purple-500/20 pb-3">
          <div className="h-10 w-10 overflow-hidden rounded-full border border-fuchsia-400/40 bg-purple-900/40 ring-1 ring-purple-400/30">
            <img
              src={getAvatarUrl(me.data?.profile?.avatar_key)}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {me.data?.profile?.username ?? user.email?.split("@")[0]}
            </div>
            <div className="truncate text-[11px] text-purple-200/60">{user.email}</div>
          </div>
        </div>
        <div className="pt-3">
          <div className="text-[10px] uppercase tracking-widest text-purple-200/70">
            Balance
          </div>
          <div className="font-display text-sm font-bold">
            <span className="neon-green mr-0.5">$</span>
            <span className="text-white">{balanceText} COP</span>
          </div>
          {bonusText && me.data!.bonus_balance > 0 && (
            <div className="mt-0.5 text-[10px] font-semibold text-yellow-300">
              Bono: ${bonusText}
            </div>
          )}
          {me.isError && (
            <div className="mt-1 text-[10px] text-rose-300/90">
              No se pudo cargar el saldo.
            </div>
          )}
        </div>
        <Link
          to="/perfil"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-purple-500/40 bg-transparent px-3 py-2 text-sm font-medium text-purple-100 transition hover:bg-purple-500/10 hover:text-white"
        >
          <UserIcon className="h-4 w-4" />
          Ver perfil
        </Link>
        <LogoutButton />
      </PopoverContent>
    </Popover>
  );
}

function LogoutButton() {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      onClick={async () => {
        setLoading(true);
        await signOut();
        setLoading(false);
      }}
      disabled={loading}
      variant="outline"
      className="mt-3 w-full border-purple-500/40 bg-transparent text-purple-100 hover:bg-purple-500/10 hover:text-white"
    >
      <LogOut className="h-4 w-4" />
      Cerrar sesión
    </Button>
  );
}