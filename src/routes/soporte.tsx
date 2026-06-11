import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Headphones, Mail, Send, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SUPPORT_EMAIL = "support@betspace.app";

export const Route = createFileRoute("/soporte")({
  head: () => ({
    meta: [
      { title: "Soporte — BETSPACE Casino" },
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

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-10 pt-4 sm:max-w-lg sm:px-4">
        <header
          className="-mx-3 -mt-4 flex items-center justify-between border-b border-purple-500/20 bg-[#060210] px-3 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <button
            onClick={() => navigate({ to: "/home" })}
            aria-label="Atrás"
            className="rounded-md p-2 text-purple-100 hover:bg-white/5"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={3} />
          </button>
          <h1 className="font-display text-base font-bold uppercase tracking-widest">Soporte</h1>
          <div className="h-7 w-11" />
        </header>

        <section className="mt-5 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-[#1a0b3a] to-[#0c0620] p-4 shadow-[0_0_18px_rgba(168,85,247,0.25)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200">
              <Headphones className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-black uppercase tracking-wider text-white">
                ¿Necesitas ayuda?
              </div>
              <div className="text-[11px] text-purple-200/80">
                Te respondemos lo antes posible.
              </div>
            </div>
          </div>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-4 flex items-center gap-2 rounded-xl border border-purple-500/30 bg-[#0c0620]/80 px-3 py-2.5 text-purple-100 hover:border-fuchsia-500/50"
          >
            <Mail className="h-4 w-4 text-fuchsia-300" />
            <span className="text-xs font-semibold">{SUPPORT_EMAIL}</span>
          </a>
        </section>

        <h2 className="font-display mt-5 mb-2 text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
          Envíanos un mensaje
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-purple-500/30 bg-[#0c0620]/80 p-3"
        >
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
              Tu correo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="mt-1 w-full rounded-lg border border-purple-500/30 bg-[#150830]/60 px-3 py-2 text-xs text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
              Asunto
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder="Ej. Problema con un retiro"
              className="mt-1 w-full rounded-lg border border-purple-500/30 bg-[#150830]/60 px-3 py-2 text-xs text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-purple-200/70">
              Mensaje
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={6}
              placeholder="Cuéntanos en detalle qué sucede…"
              className="mt-1 w-full resize-none rounded-lg border border-purple-500/30 bg-[#150830]/60 px-3 py-2 text-xs text-white placeholder:text-purple-300/40 focus:border-fuchsia-400/60 focus:outline-none"
            />
            <div className="mt-1 text-right text-[9px] text-purple-200/50">
              {message.length}/2000
            </div>
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-[0_4px_14px_rgba(217,70,239,0.45)] hover:brightness-110"
          >
            <Send className="h-4 w-4" />
            Enviar a soporte
          </button>
        </form>

        <div className="mt-5 rounded-2xl border border-purple-500/20 bg-[#0c0620]/60 p-3">
          <div className="flex items-start gap-2 text-[11px] text-purple-200/80">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
            <p>
              Horario de atención: <span className="font-semibold text-white">Lun a Dom, 8:00 a 22:00 (COL)</span>.
              Las respuestas se envían a tu correo registrado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}