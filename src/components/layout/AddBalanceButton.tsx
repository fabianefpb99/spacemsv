import { Link } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Circular "+" shortcut that sits between the balance and the settings gear.
 * Hidden for admins; links to the deposit flow for regular users.
 *
 * Visual intent: same visual weight as the adjacent Settings gear, not larger.
 * Uses a custom refined SVG so it doesn't look like a generic Lucide sticker.
 */
export function AddBalanceButton({ className }: { className?: string }) {
  const isAdmin = useIsAdmin();
  if (isAdmin.data === true) return null;

  return (
    <Link
      to="/pay"
      aria-label="Recargar saldo"
      className={[
        "add-balance-btn group relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-7 sm:w-7",
        "transition active:scale-95",
        className,
      ].join(" ")}
    >
      {/* subtle rim glow on hover */}
      <span className="absolute inset-0 rounded-full opacity-0 transition duration-300 group-hover:opacity-100" />

      {/* custom refined plus icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative h-[14px] w-[14px] sm:h-4 sm:w-4"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          className="stroke-current opacity-60"
          strokeWidth="1.5"
        />
        <path
          d="M12 8v8M8 12h8"
          className="stroke-current"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  );
}
