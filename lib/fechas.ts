/* ============================================================
   Edad y años bautizado: los calcula el sistema a partir de las
   fechas. Si no hay fecha, se usa el valor que estuviera cargado
   a mano (para los registros viejos sin fecha).
   ============================================================ */

import type { Participante } from "./tipos";

/** Más de esto no es una fecha de nacimiento válida: se ignora. */
const MAX_ANIOS = 120;

interface Partes {
  anos: number;
  meses: number;
}

function partes(fecha: string | null | undefined, hoy: Date): Partes | null {
  if (!fecha) return null;
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  // meses completos entre la fecha y hoy
  let mesesTotales =
    (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
  if (hoy.getDate() < d.getDate()) mesesTotales -= 1;

  const anos = Math.floor(mesesTotales / 12);
  const meses = mesesTotales % 12;

  // una fecha con más de 120 años está mal escrita (ej: 2987)
  if (anos > MAX_ANIOS || anos < 0) return null;

  return { anos, meses };
}

/** '1986-04-03' con hoy 13/10/2026 -> 40 (años cumplidos). */
export function aniosCumplidos(
  fecha: string | null | undefined,
  hoy: Date = new Date(),
): number | null {
  return partes(fecha, hoy)?.anos ?? null;
}

/** '1998-09-06' con hoy 13/10/2026 -> 28.1 (años + meses, un decimal). */
export function aniosYMeses(
  fecha: string | null | undefined,
  hoy: Date = new Date(),
): number | null {
  const p = partes(fecha, hoy);
  if (!p) return null;
  return Math.round((p.anos + p.meses / 12) * 10) / 10;
}

/**
 * Edad de la persona: la calcula desde la fecha de nacimiento; si no hay
 * fecha válida usa el valor que estuviera cargado a mano.
 */
export function edadDe(
  persona: Pick<Participante, "fecha_nacimiento" | "edad">,
  hoy: Date = new Date(),
): number | null {
  return aniosCumplidos(persona.fecha_nacimiento, hoy) ?? persona.edad ?? null;
}

/**
 * Años bautizado: los calcula desde la fecha de bautismo; si no hay fecha
 * válida usa el valor cargado a mano.
 */
export function aniosBautizadoDe(
  persona: Pick<Participante, "fecha_bautismo" | "anios_bautizado">,
  hoy: Date = new Date(),
): number | null {
  return aniosYMeses(persona.fecha_bautismo, hoy) ?? persona.anios_bautizado ?? null;
}

/** true = el número viene de la fecha, false = del valor cargado a mano. */
export function edadCalculada(
  persona: Pick<Participante, "fecha_nacimiento">,
  hoy: Date = new Date(),
): boolean {
  return aniosCumplidos(persona.fecha_nacimiento, hoy) !== null;
}

export function bautizadoCalculado(
  persona: Pick<Participante, "fecha_bautismo">,
  hoy: Date = new Date(),
): boolean {
  return aniosYMeses(persona.fecha_bautismo, hoy) !== null;
}

/** 40 -> '40 años' · 1 -> '1 año' */
export function textoEdad(anos: number | null | undefined): string {
  if (anos === null || anos === undefined) return "";
  return `${anos} ${anos === 1 ? "año" : "años"}`;
}

/** 28.1 -> '28 años y 1 mes' · 28.0 -> '28 años' */
export function textoAniosBautizado(anos: number | null | undefined): string {
  if (anos === null || anos === undefined) return "";
  const enteros = Math.floor(anos);
  const meses = Math.round((anos - enteros) * 12);
  if (meses === 0 || Number.isNaN(meses)) return `${enteros} ${enteros === 1 ? "año" : "años"}`;
  return `${enteros} ${enteros === 1 ? "año" : "años"} y ${meses} ${meses === 1 ? "mes" : "meses"}`;
}