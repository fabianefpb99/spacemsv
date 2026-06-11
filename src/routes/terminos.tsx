import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y Condiciones — BETSPACE Casino" },
      { name: "description", content: "Términos y condiciones de uso y política de tratamiento de datos." },
    ],
  }),
  component: TerminosPage,
});

function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10 pt-4">
        <header className="-mx-4 flex items-center gap-3 border-b border-purple-500/20 bg-[#060210] px-4 pb-3">
          <Link to="/home" aria-label="Atrás" className="rounded-md p-2 text-purple-100 hover:bg-white/5">
            <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
          </Link>
          <h1 className="font-display text-base font-bold uppercase tracking-widest">
            Términos y Condiciones
          </h1>
        </header>
        <div className="mt-6 text-sm text-purple-200/70">
          Contenido pendiente. Esta página se completará próximamente.
        </div>
      </div>
    </div>
  );
}