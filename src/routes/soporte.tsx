import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Headphones, Mail, Send, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SUPPORT_EMAIL = "support@betspace.app";

export const Route = createFileRoute("/soporte")({
  head: () => ({
    meta: [
      { title: "Soporte y Ayuda 24/7 | BETSPACE Casino Colombia" },
      { name: "description", content: "Contacta al equipo de soporte de BETSPACE Casino." },
    ],
  }),
  component: SoportePage,
});

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
    "mt-1 w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors " +
    "border border-[#d8cfe8] bg-[#f5f1fa] text-[#1a0b3a] placeholder:text-[#7a6a92] " +
    "focus:border-[#7c3aed] focus:bg-white " +
    "dark:border-purple-500/30 dark:bg-[#150830] dark:text-white dark:placeholder:text-purple-300/40 dark:focus:border-fuchsia-400/60";

  const labelCls =
    "text-[10px] font-bold uppercase tracking-widest text-[#3b0764] dark:text-purple-200/70";

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

        {/* Hero — solid dark purple in both themes, with explicit fixed contrast. */}
        <section className="mt-5 rounded-2xl border border-[#3b0764] bg-[#1a0b3a] p-4 shadow-[0_8px_24px_-12px_rgba(59,7,100,0.45)] dark:border-fuchsia-500/30 dark:shadow-[0_0_18px_rgba(168,85,247,0.25)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#a855f7] bg-[#3b0764] text-[#f5d0fe]">
              <Headphones className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-black uppercase tracking-wider text-white">
                ¿Necesitas ayuda?
              </div>
              <div className="text-[11px] font-semibold text-white">
                Te respondemos lo antes posible.
              </div>
            </div>
          </div>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-4 flex min-h-11 w-full items-center gap-2 rounded-xl border border-[#f5d0fe] bg-white px-3 py-2.5 text-[#1a0b3a] transition-colors hover:border-[#d946ef] hover:bg-[#fff7ff]"
          >
            <Mail className="h-4 w-4 shrink-0 text-[#86198f]" />
            <span className="min-w-0 break-all text-xs font-black text-[#1a0b3a]">
              {SUPPORT_EMAIL}
            </span>
          </a>
        </section>

        <h2 className="font-display mt-6 mb-2 text-[10px] font-bold uppercase tracking-widest text-[#3b0764] dark:text-purple-200/80">
          Envíanos un mensaje
        </h2>

        {/* Form card — white in light, dark in dark. */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-[#e6dff2] bg-white p-4 shadow-[0_4px_18px_-10px_rgba(59,7,100,0.18)] dark:border-purple-500/30 dark:bg-[#0c0620]/80 dark:shadow-none"
        >
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
            <div className="mt-1 text-right text-[10px] font-semibold text-[#7a6a92] dark:text-purple-200/50">
              {message.length}/2000
            </div>
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_6px_16px_-4px_rgba(168,85,247,0.55)] transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Send className="h-4 w-4" />
            Enviar a soporte
          </button>
        </form>

        <div className="mt-5 rounded-2xl border border-[#e6dff2] bg-[#faf7ff] p-3 dark:border-purple-500/20 dark:bg-[#0c0620]/60">
          <div className="flex items-start gap-2 text-[11px] text-[#3b0764] dark:text-purple-200/80">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-600 dark:text-fuchsia-300" />
            <p>
              Horario de atención:{" "}
              <span className="font-bold text-[#1a0b3a] dark:text-white">
                Lun a Dom, 8:00 a 22:00 (COL)
              </span>
              . Las respuestas se envían a tu correo registrado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}