import { MESES, MESES_CORTO, claveMes } from "./informes";

/** El año de servicio arranca en septiembre (índice 8) y termina en agosto. */
const MES_INICIO = 8;

/**
 * Año de servicio al que pertenece hoy: de septiembre a diciembre es el
 * año que arranca; de enero a agosto, el que arrancó el septiembre anterior.
 */
export function anioServicioActual(fecha: Date = new Date()): number {
  return fecha.getMonth() >= MES_INICIO ? fecha.getFullYear() : fecha.getFullYear() - 1;
}

/** '2026' -> '2026/2027' */
export function etiquetaAnioServicio(anio: number): string {
  return `${anio}/${anio + 1}`;
}

export interface MesServicio {
  /** 'YYYY-MM' */
  clave: string;
  /** 'Sep' */
  corto: string;
  /** 'septiembre de 2026' */
  etiqueta: string;
  /** mes (1-12) */
  numero: number;
}

/** Los 12 meses del año de servicio, de septiembre a agosto. */
export function mesesDelAnioServicio(anio: number): MesServicio[] {
  const lista: MesServicio[] = [];
  for (let i = 0; i < 12; i += 1) {
    const indice = (MES_INICIO + i) % 12;
    const anioDelMes = MES_INICIO + i >= 12 ? anio + 1 : anio;
    const clave = claveMes(anioDelMes, indice);
    lista.push({
      clave,
      corto: MESES_CORTO[indice],
      etiqueta: `${MESES[indice]} ${anioDelMes}`,
      numero: indice + 1,
    });
  }
  return lista;
}

/** '2026-09' .. '2027-08' */
export function rangoAnioServicio(anio: number): { desde: string; hasta: string } {
  return { desde: claveMes(anio, MES_INICIO), hasta: claveMes(anio + 1, 7) };
}

/** Para consultar la tabla de asistencias por fecha. */
export function rangoFechasAnioServicio(anio: number): {
  desde: string;
  hasta: string;
} {
  return { desde: `${anio}-09-01`, hasta: `${anio + 1}-08-31` };
}

/** Fechas legible para los encabezados: '1 de septiembre de 2026 al 31 de agosto de 2027' */
export function rangoLegible(anio: number): string {
  return `1 de septiembre de ${anio} al 31 de agosto de ${anio + 1}`;
}

/** Un año de servicio y todos los que el usuario puede elegir. */
export function aniosDisponibles(conDatos: number[] = [], actual = anioServicioActual()): number[] {
  const set = new Set<number>([actual, ...conDatos.filter((a) => Number.isFinite(a))]);
  return [...set].sort((a, b) => b - a);
}

/** El año de servicio de una ficha: desde el que se creó, hasta el que está en curso. */
export function aniosDeFicha(
  inicio: number | null | undefined,
  actual = anioServicioActual(),
): number[] {
  const desde = inicio && Number.isFinite(inicio) ? inicio : actual;
  const lista: number[] = [];
  // siempre se puede ver el año anterior al que arrancó la ficha
  for (let a = Math.min(desde, actual) - 1; a <= actual; a += 1) lista.push(a);
  return [...new Set(lista)].sort((a, b) => b - a);
}
