import { MESES } from "./informes";

/** Una carga de asistencia: un día con auditorio, zoom y el total que se suma solo. */
export interface Asistencia {
  id: string;
  fecha: string;
  auditorio: number;
  zoom: number;
  total: number;
  registrado_por: string | null;
  creado_en: string;
}

/** Lo que devuelve Supabase con el nombre de quien cargó. */
export interface AsistenciaFila extends Asistencia {
  registrado?: { nombre_completo: string } | null;
}

/** Mes de asistencias cerrado por la Secretaría. */
export interface AsistenciaMesCerrado {
  mes: string;
  cerrado_en: string;
}

/** Datos del formulario (lo que se escribe y se valida). */
export interface DatosAsistencia {
  fecha: string;
  auditorio: number | null;
  zoom: number | null;
}

export type ErroresAsistencia = {
  fecha?: string;
  auditorio?: string;
  zoom?: string;
};

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** '2026-10-05' -> 'lunes' */
export function diaDeSemana(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : DIAS[d.getDay()];
}

/** '2026-10-05' -> '5 de octubre' */
export function fechaCorta(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** '2026-10-05' -> '5 de octubre de 2026' */
export function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** El mes al que pertenece un día: '2026-10-05' -> '2026-10' */
export function mesDeFecha(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Hoy en clave 'YYYY-MM-DD' (hora local). */
export function hoyClave(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida una carga de asistencia.
 * Devuelve `{ errores }` o `{ datos }` (igual que validarInforme).
 */
export function validarAsistencia(
  datos: DatosAsistencia,
): { errores: ErroresAsistencia } | { datos: { fecha: string; auditorio: number; zoom: number } } {
  const errores: ErroresAsistencia = {};

  const fecha = (datos.fecha || "").trim();
  if (!fecha) {
    errores.fecha = "Elegí el día de la reunión.";
  } else if (!FECHA_RE.test(fecha) || Number.isNaN(new Date(`${fecha}T12:00:00`).getTime())) {
    errores.fecha = "Ese día no es una fecha válida.";
  } else if (fecha > hoyClave()) {
    errores.fecha = "No se puede cargar un día futuro.";
  } else if (fecha < "2020-01-01") {
    errores.fecha = "Revisá la fecha: parece demasiado vieja.";
  }

  for (const clave of ["auditorio", "zoom"] as const) {
    const valor = datos[clave];
    if (valor === null || Number.isNaN(valor)) {
      errores[clave] = "Cargá 0 si no hubo asistentes.";
    } else if (!Number.isInteger(valor) || valor < 0) {
      errores[clave] = "Solo números enteros desde 0.";
    } else if (valor > 5000) {
      errores[clave] = "Revisá el número: parece demasiado grande.";
    }
  }

  if (Object.keys(errores).length) return { errores };
  return {
    datos: {
      fecha,
      auditorio: datos.auditorio as number,
      zoom: datos.zoom as number,
    },
  };
}

/** Resumen por día de un mes: filas ordenadas con total general. */
export function resumenPorDia(filas: Asistencia[]): {
  dias: { fecha: string; auditorio: number; zoom: number; total: number }[];
  totalMes: number;
  totalAuditorio: number;
  totalZoom: number;
  diasConReunion: number;
  mejorDia: { fecha: string; total: number } | null;
} {
  const porDia = new Map<string, { auditorio: number; zoom: number; total: number }>();
  for (const fila of filas) {
    const acumulado = porDia.get(fila.fecha) || { auditorio: 0, zoom: 0, total: 0 };
    acumulado.auditorio += fila.auditorio;
    acumulado.zoom += fila.zoom;
    acumulado.total += fila.total;
    porDia.set(fila.fecha, acumulado);
  }

  const dias = [...porDia.entries()]
    .map(([fecha, totales]) => ({ fecha, ...totales }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const totalMes = dias.reduce((suma, d) => suma + d.total, 0);
  const mejorDia = dias.length
    ? dias.reduce((mejor, d) => (d.total > mejor.total ? d : mejor), dias[0])
    : null;

  return {
    dias,
    totalMes,
    totalAuditorio: dias.reduce((suma, d) => suma + d.auditorio, 0),
    totalZoom: dias.reduce((suma, d) => suma + d.zoom, 0),
    diasConReunion: dias.length,
    mejorDia: mejorDia ? { fecha: mejorDia.fecha, total: mejorDia.total } : null,
  };
}
