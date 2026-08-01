import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Headphones, Mail, Send, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { toast } from "sonner";

const SUPPORT_EMAIL = "support@betspace.app";

export const Route = createFileRoute("/soporte")({
  head: () => ({
    meta: [
      { title: "Soporte y Ayuda 24/7 | BETSPACE Casino Colombia" },
      { name: "description", content: "Contacta al equipo de soporte de BETSPACE Casino." },
      { property: "og:title", content: "Soporte y Ayuda 24/7 | BETSPACE" },
      { property: "og:description", content: "Escríbenos y te ayudamos con recargas, retiros y tu cuenta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SoporteRoute,
});

function SoporteRoute() {
  return (
    <RequireAuth>
      <SoportePage />
    </RequireAuth>
  );
}

function SoportePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Completa el asunto y el mensaje");
      return;
    }
    const body =
      `${message}\n\n— — — — —\nUsuario: ${email || "anónimo"}` +
      (user?.id ? `\nID: ${user.id}` : "");
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[Soporte] ${subject}`,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    toast.success("Abriendo tu correo…");
  }

  // Light mode: white surface, dark purple text. Dark mode: original dark purple.
  // Inputs use solid backgrounds (no opacity) and high-contrast text in both modes.
  const inputCls =
    "mt-1.5 w-full rounded-xl px-3.5 py-3 text-sm outline-none transition-all " +
    "border border-[#e6dff2] bg-[#faf8ff] text-[#1a0b3a] placeholder:text-[#9c8fb3] " +
    "focus:border-[#a855f7] focus:bg-white focus:ring-2 focus:ring-[#a855f7]/15 " +
    "dark:border-purple-500/25 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-purple-300/35 dark:focus:border-fuchsia-400/60 dark:focus:ring-fuchsia-400/15";

  const labelCls =
    "text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b21a8] dark:text-purple-200/60";

  return (
    <div className="min-h-screen bg-white text-[#1a0b3a] dark:bg-[#060210] dark:text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-10 pt-4 sm:max-w-lg sm:px-4">
        <header
          className="-mx-3 -mt-4 flex items-center justify-between border-b border-[#e6dff2] bg-white px-3 pb-3 dark:border-purple-500/20 dark:bg-[#060210]"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <button
            onClick={() => navigate({ to: "/" })}
            aria-label="Atrás"
            className="rounded-md p-2 text-[#3b0764] hover:bg-[#f1ebfa] dark:text-purple-100 dark:hover:bg-white/5"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={3} />
          </button>
          <h1 className="font-display text-base font-bold uppercase tracking-widest text-[#3b0764] dark:text-white">
            Soporte
          </h1>
          <div className="h-7 w-11" />
        </header>

        {/* Hero — clean centered intro, no heavy boxing. */}
        <section className="mt-8 flex flex-col items-center text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white shadow-[0_10px_28px_-10px_rgba(168,85,247,0.65)]">
            <Headphones className="h-8 w-8" strokeWidth={2} />
          </div>
          <h2 className="font-display mt-4 text-xl font-black tracking-tight text-[#1a0b3a] dark:text-white">
            ¿Necesitas ayuda?
          </h2>
          <p className="mt-1.5 max-w-[19rem] text-[13px] leading-relaxed text-[#6b5b85] dark:text-purple-200/60">
            Escríbenos y nuestro equipo te responde a tu correo registrado lo antes posible.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#e6dff2] bg-[#faf8ff] px-4 py-2 text-[11px] font-bold text-[#6b21a8] transition-colors hover:border-[#c084fc] hover:bg-white dark:border-purple-500/25 dark:bg-white/[0.04] dark:text-purple-100 dark:hover:bg-white/[0.08]"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-fuchsia-500" />
            <span className="break-all">{SUPPORT_EMAIL}</span>
          </a>
        </section>

        {/* Form card — soft, airy surface in both themes. */}
        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-4 rounded-3xl border border-[#ece5f7] bg-white p-5 shadow-[0_10px_36px_-22px_rgba(59,7,100,0.28)] dark:border-purple-500/20 dark:bg-white/[0.03] dark:shadow-none"
        >
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-[#a78bbf] dark:text-purple-300/40">
            Envíanos un mensaje
          </div>
          <div>
            <label className={labelCls}>Tu correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder="Ej. Problema con un retiro"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Mensaje</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={6}
              placeholder="Cuéntanos en detalle qué sucede…"
              className={`${inputCls} resize-none`}
            />
            <div className="mt-1.5 text-right text-[10px] font-semibold text-[#9c8fb3] dark:text-purple-200/40">
              {message.length}/2000
            </div>
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(168,85,247,0.7)] transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Send className="h-4 w-4" />
            Enviar a soporte
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-[#8d7ba8] dark:text-purple-200/50">
          <Clock className="h-3.5 w-3.5 shrink-0 text-fuchsia-500/80" />
          <span>
            Atención{" "}
            <span className="font-bold text-[#3b0764] dark:text-purple-100">
              Lun a Dom, 8:00 – 22:00 (COL)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}