import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, tokenValido } from "@/lib/auth";
import { etiquetaMes, mesAnterior } from "@/lib/informes";
import FormularioInforme from "@/components/FormularioInforme";

export const metadata: Metadata = {
  title: "Informe de actividad",
  description: "Envía tu informe mensual de actividad",
};

export default async function PaginaInformes() {
  const store = await cookies();
  if (await tokenValido(store.get(SESSION_COOKIE)?.value)) {
    redirect("/secretaria");
  }

  const mes = mesAnterior();

  return <FormularioInforme etiqueta={etiquetaMes(mes)} />;
}
