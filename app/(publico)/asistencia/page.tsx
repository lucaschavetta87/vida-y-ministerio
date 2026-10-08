import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, tokenValido } from "@/lib/auth";
import { etiquetaMes, mesActual } from "@/lib/informes";
import FormularioAsistencia from "@/components/FormularioAsistencia";

export const metadata: Metadata = {
  title: "Asistencia a las reuniones",
  description: "Los acomodadores registran la asistencia de cada día",
};

export default async function PaginaAsistencia() {
  const store = await cookies();
  if (await tokenValido(store.get(SESSION_COOKIE)?.value)) {
    redirect("/secretaria");
  }

  const mes = mesActual();

  return <FormularioAsistencia etiqueta={etiquetaMes(mes)} />;
}
