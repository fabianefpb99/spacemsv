import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y Condiciones | BETSPACE Casino Colombia" },
      { name: "description", content: "Términos y condiciones de uso y política de tratamiento de datos." },
    ],
  }),
  component: TerminosPage,
});

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "1",
    title: "1. Introducción",
    body: (
      <>
        <p>Bienvenido a BETSPACE.</p>
        <p>
          Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma BETSPACE,
          incluyendo su sitio web, aplicación móvil, juegos, promociones, servicios y cualquier
          funcionalidad ofrecida dentro de la plataforma.
        </p>
        <p>
          Al registrarse, acceder o utilizar BETSPACE, el usuario declara haber leído, entendido y
          aceptado íntegramente estos Términos y Condiciones. Si el usuario no está de acuerdo con
          cualquiera de sus disposiciones, deberá abstenerse de utilizar la plataforma.
        </p>
        <p>
          BETSPACE podrá actualizar estos términos cuando resulte necesario. Las modificaciones
          entrarán en vigor desde su publicación dentro de la plataforma.
        </p>
      </>
    ),
  },
  {
    id: "2",
    title: "2. Definiciones",
    body: (
      <>
        <p>Para efectos de estos Términos:</p>
        <ul>
          <li><strong>BETSPACE:</strong> Plataforma de entretenimiento y juegos operada bajo la presente política.</li>
          <li><strong>Usuario:</strong> Persona que crea una cuenta o utiliza cualquiera de los servicios ofrecidos por BETSPACE.</li>
          <li><strong>Cuenta:</strong> Registro personal creado por el usuario para acceder a la plataforma.</li>
          <li><strong>Saldo:</strong> Valor disponible dentro de la cuenta del usuario para participar en los juegos disponibles.</li>
          <li><strong>Servidor:</strong> Infraestructura tecnológica de BETSPACE donde se registran oficialmente todas las apuestas, resultados, movimientos y transacciones.</li>
        </ul>
      </>
    ),
  },
  {
    id: "3",
    title: "3. Requisitos para utilizar BETSPACE",
    body: (
      <>
        <p>Al utilizar BETSPACE el usuario declara y garantiza que:</p>
        <ul>
          <li>Tiene la edad mínima exigida por la legislación aplicable en su lugar de residencia y, en ningún caso, es menor de 18 años.</li>
          <li>Posee plena capacidad legal para aceptar estos Términos y Condiciones.</li>
          <li>Utilizará la plataforma únicamente para fines personales.</li>
          <li>Toda la información suministrada durante el registro es verdadera, actual y completa.</li>
        </ul>
        <p>
          BETSPACE podrá solicitar documentación adicional para verificar la identidad o edad del
          usuario cuando lo considere necesario. La negativa a suministrar dicha información podrá
          dar lugar a la suspensión temporal o definitiva de la cuenta.
        </p>
      </>
    ),
  },
  {
    id: "4",
    title: "4. Registro de la cuenta",
    body: (
      <>
        <p>Cada usuario podrá mantener únicamente una cuenta personal dentro de BETSPACE.</p>
        <p>No está permitido:</p>
        <ul>
          <li>Crear múltiples cuentas con el fin de obtener ventajas indebidas.</li>
          <li>Compartir cuentas con terceros.</li>
          <li>Transferir cuentas.</li>
          <li>Vender cuentas.</li>
          <li>Utilizar identidades falsas.</li>
          <li>Suplantar a otra persona.</li>
        </ul>
        <p>BETSPACE podrá cancelar cualquier cuenta que incumpla estas disposiciones.</p>
      </>
    ),
  },
  {
    id: "5",
    title: "5. Seguridad de la cuenta",
    body: (
      <>
        <p>El usuario es el único responsable de mantener la confidencialidad de sus credenciales de acceso.</p>
        <p>
          Todas las actividades realizadas desde una cuenta registrada se considerarán efectuadas
          por su titular, salvo prueba suficiente de un acceso no autorizado.
        </p>
        <p>
          El usuario deberá notificar inmediatamente a BETSPACE cualquier sospecha de acceso indebido,
          pérdida de credenciales o uso no autorizado de su cuenta.
        </p>
        <p>
          BETSPACE no será responsable por pérdidas ocasionadas por negligencia del usuario en la
          protección de sus datos de acceso.
        </p>
      </>
    ),
  },
  {
    id: "6",
    title: "6. Conductas prohibidas",
    body: (
      <>
        <p>
          Con el fin de proteger la integridad de la plataforma y garantizar condiciones equitativas
          para todos los usuarios, queda estrictamente prohibido:
        </p>
        <ul>
          <li>Utilizar bots, scripts, macros, autoclickers o cualquier sistema automatizado.</li>
          <li>Manipular el funcionamiento normal de los juegos.</li>
          <li>Explotar errores técnicos, vulnerabilidades o fallos del sistema para obtener beneficios.</li>
          <li>Intentar modificar el código, interceptar comunicaciones o realizar ingeniería inversa sobre la plataforma.</li>
          <li>Utilizar software destinado a alterar el funcionamiento de BETSPACE.</li>
          <li>Compartir, vender o alquilar cuentas.</li>
          <li>Crear múltiples cuentas para obtener promociones o beneficios adicionales.</li>
          <li>Participar en actividades fraudulentas, lavado de dinero o cualquier conducta ilícita.</li>
          <li>Realizar acciones que afecten la estabilidad, disponibilidad o seguridad de los servicios.</li>
        </ul>
        <p>
          BETSPACE podrá suspender, limitar o cerrar cualquier cuenta cuando existan indicios
          razonables de fraude, abuso, manipulación del sistema o incumplimiento de estos Términos y
          Condiciones. La adopción de estas medidas podrá realizarse incluso mientras se lleva a
          cabo una investigación interna.
        </p>
      </>
    ),
  },
];

function TerminosPage() {
  return (
    <div className="terminos-scope min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10 pt-4">
        <header className="terminos-header -mx-4 flex items-center gap-3 border-b border-purple-500/20 bg-[#060210] px-4 pb-3">
          <Link to="/" aria-label="Atrás" className="terminos-back rounded-md p-2 text-purple-100 hover:bg-white/5">
            <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
          </Link>
          <h1 className="terminos-title font-display text-base font-bold uppercase tracking-widest">
            Términos y Condiciones
          </h1>
        </header>

        <p className="terminos-updated mt-4 text-xs uppercase tracking-widest text-purple-300/60">
          Última actualización: 28 de junio de 2026
        </p>
        <p className="terminos-intro mt-3 text-sm leading-relaxed text-purple-100/85">
          Lee con atención cada sección. Al usar BETSPACE aceptas íntegramente estos términos.
        </p>

        <Accordion
          type="multiple"
          defaultValue={["1"]}
          className="mt-5 space-y-2"
        >
          {SECTIONS.map((s) => (
            <AccordionItem
              key={s.id}
              value={s.id}
              className="terminos-item rounded-lg border border-purple-500/25 bg-[#0c0620] px-3"
            >
              <AccordionTrigger className="terminos-trigger text-left text-sm font-semibold text-white hover:no-underline">
                {s.title}
              </AccordionTrigger>
              <AccordionContent className="terminos-content text-sm leading-relaxed text-purple-100/85 [&_p]:mb-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_strong]:text-white">
                {s.body}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="terminos-footer mt-6 text-[11px] text-purple-300/50">
          Si tienes dudas sobre estos términos, contáctanos desde la sección de Soporte.
        </p>
      </div>
    </div>
  );
}