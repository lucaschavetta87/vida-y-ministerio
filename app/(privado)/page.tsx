import Link from "next/link";
import { CalendarDays, ClipboardList, Wrench, Users } from "lucide-react";
import { cookies } from "next/headers";
import { SESSION_COOKIE, leerToken, puedeEntrar } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import { Panel } from "@/components/ui";

const tarjetas = [
  {
    href: "/participantes",
    permiso: "participantes",
    icono: Users,
    titulo: "Participantes",
    texto: "Cargá de la congregación: nombre, género, teléfono, dirección, fecha de bautismo y las asignaciones que pueden cumplir.",
  },
  {
    href: "/reunion",
    permiso: "reunion",
    icono: CalendarDays,
    titulo: "Vida y Ministerio",
    texto: "Armá la reunión parte por parte y elegí con un buscador quién cumple cada asignación, según los roles de cada participante.",
  },
  {
    href: "/asignaciones-mecanicas",
    permiso: "asignaciones",
    icono: Wrench,
    titulo: "Asignaciones Mecánicas",
    texto: "Acomodadores, micrófonos, audio, video, retiro de donaciones y limpieza, para la reunión de entre semana y la de fin de semana.",
  },
  {
    href: "/secretaria",
    permiso: "secretaria",
    icono: ClipboardList,
    titulo: "Secretaría",
    texto: "Los informes de actividad del mes: precursores, auxiliares y publicadores, con las horas, los estudios y las observaciones de cada uno.",
  },
];

export default async function Home() {
  const store = await cookies();
  const sesion = await leerToken(store.get(SESSION_COOKIE)?.value);

  if (!sesion) {
    return <LoginForm />;
  }

  // solo las partes a las que esta sesión tiene permiso
  const visibles = tarjetas.filter((t) => puedeEntrar(sesion, t.href));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">
          Congregación de Este Las Heras
        </h1>
        <p className="mt-1 text-sm text-suave">
          Entraste como <strong>{sesion.nombre}</strong>
          {sesion.admin ? " (acceso total)" : ""}. Elegí qué querés gestionar hoy.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map(({ href, icono: Icono, titulo, texto }) => (
          <Link key={href} href={href} className="group block">
            <Panel className="h-full p-6 transition-colors group-hover:border-teal/60">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal/10 text-teal transition-colors group-hover:bg-teal group-hover:text-fondo">
                <Icono size={22} />
              </span>
              <h2 className="mb-2 text-lg font-bold">{titulo}</h2>
              <p className="text-sm leading-relaxed text-suave">{texto}</p>
            </Panel>
          </Link>
        ))}
      </div>

      <Panel className="mt-6 flex items-start gap-3 p-5 text-sm text-suave">
        <ClipboardList size={18} className="mt-0.5 shrink-0 text-teal" />
        <p>
          Cada participante tiene su ficha con las asignaciones que aceptó.
          Cuando armás la reunión, el buscador de cada parte solo propone a
          quienes tildaron ese rol y cumplen con el género requerido.
        </p>
      </Panel>
    </div>
  );
}
