import type { Clasificacion, Rol } from "./tipos";

/**
 * Clasificaciones que además del rol exige cada asignación. Si el rol no
 * está en la lista, con tenerla tildada alcanza (el género lo revisa la
 * propia tabla de roles).
 */
export const CLASIFICACIONES_POR_ROL: Record<string, Clasificacion[]> = {
  // la presidencia de fin de semana puede ser un anciano o un siervo
  // ministerial; la de entre semana es solo de ancianos
  presidente: ["ANCIANO", "SIERVO_MINISTERIAL"],
  presidente_entre_semana: ["ANCIANO"],
};

/** texto para mostrar en la ficha y en "Gestionar roles" */
export const REQUISITOS_POR_ROL: Record<string, string> = {
  presidente: "Solo ancianos o siervos ministeriales",
  presidente_entre_semana: "Solo ancianos",
};

export function clasificacionesDeRol(slug: string): Clasificacion[] {
  return CLASIFICACIONES_POR_ROL[slug] ?? [];
}

/** el rol exige alguna de estas clasificaciones (o ninguna, si no pide) */
export function rolAdmiteClasificacion(
  rol: Pick<Rol, "slug">,
  clasificacion: Clasificacion[] | null | undefined,
): boolean {
  const pedidas = clasificacionesDeRol(rol.slug);
  if (pedidas.length === 0) return true;
  return (clasificacion ?? []).some((c) => pedidas.includes(c));
}