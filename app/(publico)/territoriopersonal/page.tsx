import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, tokenValido } from "@/lib/auth";
import FormularioTerritorioPersonal from "@/components/FormularioTerritorioPersonal";

export const metadata: Metadata = {
  title: "Territorio personal",
  description: "Los publicadores cargan cómo les fue en su territorio personal",
};

export default async function PaginaTerritorioPersonal() {
  const store = await cookies();
  if (await tokenValido(store.get(SESSION_COOKIE)?.value)) {
    redirect("/servicio");
  }

  return <FormularioTerritorioPersonal />;
}