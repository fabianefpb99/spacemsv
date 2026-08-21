import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Circular "+" shortcut that sits between the balance and the settings gear.
 * Hidden for admins; links to the deposit flow for regular users.
 *
 * Visual intent: identical footprint and stroke weight as the Settings gear.
 * One single circular border (the button's own border) + a clean plus sign.
 */
export function AddBalanceButton({ className }: { className?: string }) {
  const isAdmin = useIsAdmin();
  if (isAdmin.data === true) return null;

  return (
    <Link
      to="/pay"
      aria-label="Recargar saldo"
      className={[
        "add-balance-btn group flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-7 sm:w-7",
        "transition active:scale-95",
        className,
      ].join(" ")}
    >
      <Plus
        className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </Link>
  );
}
