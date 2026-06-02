import { useState } from "react";
import { Settings, LogOut, User as UserIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { AuthDialog } from "./AuthDialog";

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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600/30 ring-1 ring-purple-400/30">
            <UserIcon className="h-4 w-4 text-purple-200" />
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
            <span className="text-white">{formatCOP(me.data?.balance ?? 0)} COP</span>
          </div>
          {(me.data?.bonus_balance ?? 0) > 0 && (
            <div className="mt-0.5 text-[10px] text-purple-200/70">
              Bono: ${formatCOP(me.data?.bonus_balance ?? 0)}
            </div>
          )}
        </div>
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