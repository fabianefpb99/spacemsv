import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Circular "+" shortcut that sits between the balance and the settings gear.
 * Hidden for admins; links to the deposit flow for regular users.
 */
export function AddBalanceButton({ className }: { className?: string }) {
  const isAdmin = useIsAdmin();
  if (isAdmin.data === true) return null;

  return (
    <Link
      to="/pay"
      aria-label="Recargar saldo"
      className={[
        "add-balance-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        "border border-[#2effa1]/60 bg-[#0c0620]/80 text-[#2effa1]",
        "transition active:scale-95 hover:border-[#2effa1] hover:bg-[#2effa1]/10 hover:shadow-[0_0_10px_rgba(46,255,161,0.35)]",
        className,
      ].join(" ")}
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
    </Link>
  );
}
