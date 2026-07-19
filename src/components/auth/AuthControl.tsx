import { useState } from "react";
import { Settings, LogOut, User as UserIcon, Wallet, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { AuthDialog } from "./AuthDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { useVip } from "@/hooks/useVip";
import { computeProgress } from "@/lib/vip/vip.shared";
import { RANK_ART } from "@/lib/vip/vip-art";

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
  const vip = useVip();
  const vipProgress = vip.data
    ? computeProgress(vip.data.user_vip?.total_xp ?? 0, vip.data.levels)
    : null;
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
        className="auth-popover auth-pop-v2 z-50 w-[min(15rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-2xl border p-0"
      >
        {/* Header: avatar + name/email */}
        <div className="ap-header flex items-center gap-2.5 px-3 pb-3 pt-3">
          <div className="relative h-10 w-10 shrink-0">
            <div className="ap-avatar h-10 w-10 overflow-hidden rounded-full">
              <UserAvatar avatarKey={me.data?.profile?.avatar_key} alt="" />
            </div>
            {vipProgress && (
              <img
                src={RANK_ART[vipProgress.rank]}
                alt=""
                className="pointer-events-none absolute -bottom-1 -right-1 h-4 w-4 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                draggable={false}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="ap-name truncate text-[13px] font-semibold leading-tight">
              {me.data?.profile?.username ?? user.email?.split("@")[0]}
            </div>
            <div className="ap-email truncate text-[11px] leading-tight">{user.email}</div>
          </div>
        </div>

        <div className="ap-divider" />

        {/* Balance row */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="ap-label text-[10px] font-bold uppercase tracking-wider">
              SALDO
            </div>
            <div className="ap-balance mt-0.5 text-[17px] font-extrabold leading-tight">
              ${balanceText} <span className="ap-currency">COP</span>
            </div>
            {bonusText && me.data!.bonus_balance > 0 && (
              <div className="ap-bonus mt-0.5 text-[10px] font-medium">
                BONUS ${bonusText} COP
              </div>
            )}
            {me.isError && (
              <div className="mt-1 text-[10px] text-rose-400">
                No se pudo cargar el saldo.
              </div>
            )}
          </div>
          <div className="ap-wallet flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Wallet className="h-4 w-4" />
          </div>
        </div>

        <div className="ap-divider" />

        {/* Ver perfil */}
        <Link to="/perfil" className="ap-row flex w-full items-center gap-2.5 px-3 py-2.5">
          <UserIcon className="ap-row-icon h-4 w-4" />
          <span className="ap-row-label flex-1 text-left text-[13px] font-medium">
            Ver perfil
          </span>
          <ChevronRight className="ap-row-chev h-3.5 w-3.5" />
        </Link>

        <div className="ap-divider" />

        <LogoutButton />
      </PopoverContent>
    </Popover>
  );
}

function LogoutButton() {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        await signOut();
        setLoading(false);
      }}
      disabled={loading}
      className="ap-row ap-row-danger flex w-full items-center gap-2.5 px-3 py-2.5 disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      <span className="flex-1 text-left text-[13px] font-medium">Cerrar sesión</span>
    </button>
  );
}