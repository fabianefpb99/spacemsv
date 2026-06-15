import { Link, useNavigate } from "@tanstack/react-router";
import {
  Gift,
  History,
  Headphones,
  Wallet,
  Trophy,
  Sun,
  Moon,
  X,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Send,
  MessageCircle,
  Music2,
  Hash,
  type LucideIcon,
} from "lucide-react";
import { cloneElement, isValidElement, useEffect, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/useTheme";
import betspaceLogo from "@/assets/betspace-logo.svg";
import arenaHero from "@/assets/home-hero-arena.png.asset.json";
import { getPublicDrawerSettings } from "@/lib/admin/drawer-content.functions";

type Item = {
  label: string;
  icon: LucideIcon;
  to?: string;
};

const ITEMS: Item[] = [
  { label: "Eventos y Bonos", icon: Gift, to: "/eventos" },
  { label: "Mis Recargas", icon: History, to: "/mis-recargas" },
  { label: "Depósito", icon: Wallet, to: "/pay" },
  { label: "Ranking", icon: Trophy, to: "/ranking" },
  { label: "Soporte", icon: Headphones, to: "/soporte" },
];

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
  tiktok: Music2,
  telegram: Send,
  whatsapp: MessageCircle,
  discord: Hash,
};

export function HamburgerDrawer({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const isLight = theme === "light";

  const settingsFn = useServerFn(getPublicDrawerSettings);
  const settingsQ = useQuery({
    queryKey: ["public-drawer"],
    queryFn: () => settingsFn(),
    staleTime: 60_000,
  });
  const promo = settingsQ.data?.promo;
  const socials = settingsQ.data?.socials ?? [];
  const promoImage = promo?.image_url || arenaHero.url;
  const promoActive = promo?.active !== false;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyTouchAction = body.style.touchAction;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.touchAction = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.touchAction = previousBodyTouchAction;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<any>, {
        "aria-controls": "hamburger-drawer-panel",
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        onClick: (event: MouseEvent<HTMLElement>) => {
          (trigger as ReactElement<any>).props.onClick?.(event);
          if (!event.defaultPrevented) {
            setOpen(true);
          }
        },
      })
    : (
        <button
          type="button"
          aria-controls="hamburger-drawer-panel"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          {trigger}
        </button>
      );

  return (
    <>
      {triggerNode}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[120] overflow-hidden" role="dialog" aria-modal="true" aria-label="Menú principal">
              <button
                type="button"
                aria-label="Cerrar menú"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-200"
                onClick={() => setOpen(false)}
              />

              <aside
                id="hamburger-drawer-panel"
                className="absolute inset-y-0 left-0 flex h-full w-[82vw] max-w-[320px] animate-in slide-in-from-left duration-300 flex-col border-r border-purple-500/20 bg-[#0a0418] text-white"
                style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
              >
                <div className="flex items-center justify-between pl-6 pr-4 pb-3">
                  <Link
                    to="/home"
                    onClick={() => setOpen(false)}
                    className="logo-shine"
                    aria-label="Inicio"
                  >
                    <img src={betspaceLogo} alt="BETSPACE" className="h-5 w-auto" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar"
                    className="rounded-md p-1.5 text-white/80 hover:bg-white/10"
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>

                <div className="mx-4 h-px bg-purple-500/15" />

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

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: (promo?.cta_link as string) || "/arena" });
                    }}
                    className="group relative mt-4 block aspect-[16/10] w-full overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-[#1a0a3a] text-left shadow-[0_0_24px_rgba(168,85,247,0.25)] transition hover:shadow-[0_0_32px_rgba(217,70,239,0.45)]"
                    aria-label="Promoción Arena"
                    hidden={!promoActive}
                  >
                    <img
                      src={promoImage}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(10,4,24,0.95) 0%, rgba(26,10,58,0.85) 38%, rgba(26,10,58,0.15) 65%, rgba(26,10,58,0) 100%)",
                      }}
                    />
                    <div className="relative z-10 flex h-full flex-col justify-center gap-1.5 p-3 pr-[48%]">
                      <span className="inline-flex w-fit items-center rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-fuchsia-200 ring-1 ring-fuchsia-400/40">
                        {promo?.eyebrow || "Juego destacado"}
                      </span>
                      <h3 className="text-lg font-black uppercase leading-none tracking-wide text-white drop-shadow-[0_0_12px_rgba(217,70,239,0.6)]">
                        {promo?.title || "ARENA"}
                      </h3>
                      <p className="text-[10px] leading-tight text-purple-100/80">
                        {promo?.subtitle || "Combates épicos y premios reales"}
                      </p>
                      <span className="mt-1 inline-flex w-fit items-center rounded-md bg-gradient-to-r from-fuchsia-500 to-purple-600 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-[0_4px_14px_rgba(217,70,239,0.5)]">
                        {promo?.cta_label || "¡Pelear ahora!"}
                      </span>
                    </div>
                  </button>
                </nav>

                {socials.length > 0 && (
                  <div className="border-t border-purple-500/15 px-4 pb-3 pt-3">
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-purple-300/70">
                      Síguenos
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {socials.map((s) => {
                        const Icon = SOCIAL_ICONS[s.platform] ?? Hash;
                        return (
                          <a
                            key={s.id}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={s.platform}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-500/30 bg-[#150830] text-fuchsia-200 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/15 hover:text-white"
                          >
                            <Icon className="h-4 w-4" strokeWidth={2.2} />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border-t border-purple-500/15 px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
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
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}