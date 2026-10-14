import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, tokenValido } from "@/lib/auth";
import FormularioTerritorios from "@/components/FormularioTerritorios";

export const metadata: Metadata = {
  title: "Salidas de territorio",
  description: "Los conductores de salidas registran los territorios que hicieron",
};

export default async function PaginaTerritorios() {
  const store = await cookies();
  if (await tokenValido(store.get(SESSION_COOKIE)?.value)) {
    redirect("/servicio");
  }

  return <FormularioTerritorios />;
}