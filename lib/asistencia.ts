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

/**
 * Un mes cargado a mano (para los meses que no se cargaron reunión por
 * reunión). El promedio siempre se calcula: total ÷ reuniones.
 */
export interface ResumenManual {
  mes: string;
  tipo: TipoReunion;
  reuniones: number;
  total: number;
  actualizado_en?: string;
}

export type ErroresResumen = {
  mes?: string;
  tipo?: string;
  reuniones?: string;
  total?: string;
};

const TIPOS: TipoReunion[] = ["entre-semana", "fin-de-semana"];

/** Valida el resumen mensual y devuelve los datos para guardar. */
export function validarResumen(
  entrada: {
    mes?: unknown;
    tipo?: unknown;
    reuniones?: unknown;
    total?: unknown;
  },
): { errores: ErroresResumen } | { datos: Omit<ResumenManual, "actualizado_en"> } {
  const errores: ErroresResumen = {};

  const mes = typeof entrada.mes === "string" ? entrada.mes.trim() : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    errores.mes = "Elegí el mes del resumen.";
  }

  const tipo = entrada.tipo;
  if (tipo !== "entre-semana" && tipo !== "fin-de-semana") {
    errores.tipo = "Elegí si es de entre semana o de fin de semana.";
  }

  const leer = (valor: unknown): number | null => {
    if (valor === null || valor === undefined || valor === "") return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  };

  const reuniones = leer(entrada.reuniones);
  if (reuniones === null || !Number.isInteger(reuniones) || reuniones < 0) {
    errores.reuniones = "Escribí cuántas reuniones hubo (0 si no hubo ninguna).";
  }

  const total = leer(entrada.total);
  if (total === null || !Number.isInteger(total) || total < 0) {
    errores.total = "Escribí la asistencia total del mes.";
  }

  if (Object.keys(errores).length) return { errores };
  return {
    datos: {
      mes,
      tipo: tipo as TipoReunion,
      reuniones: reuniones as number,
      total: total as number,
    },
  };
}

/** Etiqueta corta del tipo de reunión. */
export function etiquetaTipo(tipo: TipoReunion): string {
  return tipo === "entre-semana" ? "Entre semana" : "Fin de semana";
}

export const TIPOS_REUNION: TipoReunion[] = TIPOS;

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

/**
 * Primer día del mes siguiente: '2026-09' -> '2026-10-01'.
 * Sirve como límite exclusivo para agarrar un mes entero sin inventar
 * el último día (septiembre no tiene 31, febrero tampoco).
 */
export function diaSiguienteMes(mes: string): string {
  const [anio, numero] = mes.split("-");
  const a = Number(anio);
  const n = Number(numero);
  if (!a || !n) return "";
  return n === 12 ? `${a + 1}-01-01` : `${a}-${String(n + 1).padStart(2, "0")}-01`;
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

/** Una reunión entre semana (de lunes a sábado) o de fin de semana (domingo). */
export type TipoReunion = "entre-semana" | "fin-de-semana";

export function tipoDeReunion(fecha: string): TipoReunion {
  return new Date(`${fecha}T12:00:00`).getDay() === 0 ? "fin-de-semana" : "entre-semana";
}

/** De dónde salen los números de un mes de un tipo de reunión. */
export type OrigenResumen = "automatico" | "manual";

/** Totales de un mes: reuniones, asistentes y promedio por reunión. */
export interface ResumenMes {
  /** 'YYYY-MM' */
  mes: string;
  etiqueta: string;
  reuniones: number;
  total: number;
  /** total / reuniones, con 2 decimales (0 si no hubo reuniones). */
  promedio: number;
  reunionesEntreSemana: number;
  totalEntreSemana: number;
  promedioEntreSemana: number;
  reunionesFinSemana: number;
  totalFinSemana: number;
  promedioFinSemana: number;
  /** false = el mes (o ese tipo de reunión) está cargado a mano. */
  automaticoEntreSemana: boolean;
  automaticoFinSemana: boolean;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function resumenDeUnMes(
  mes: string,
  etiqueta: string,
  dias: { total: number; tipo: TipoReunion }[],
  manuales: Map<string, ResumenManual>,
): ResumenMes {
  const manualEntre = manuales.get(`${mes}|entre-semana`);
  const manualFin = manuales.get(`${mes}|fin-de-semana`);

  // el resumen manual manda sobre las cargas día por día
  const diasEntre = manualEntre ? [] : dias.filter((d) => d.tipo === "entre-semana");
  const diasFin = manualFin ? [] : dias.filter((d) => d.tipo === "fin-de-semana");

  const totalEntre = manualEntre ? manualEntre.total : diasEntre.reduce((s, d) => s + d.total, 0);
  const totalFin = manualFin ? manualFin.total : diasFin.reduce((s, d) => s + d.total, 0);
  const reunionesEntre = manualEntre ? manualEntre.reuniones : diasEntre.length;
  const reunionesFin = manualFin ? manualFin.reuniones : diasFin.length;
  const total = totalEntre + totalFin;

  return {
    mes,
    etiqueta,
    reuniones: reunionesEntre + reunionesFin,
    total,
    promedio: reunionesEntre + reunionesFin ? redondear(total / (reunionesEntre + reunionesFin)) : 0,
    reunionesEntreSemana: reunionesEntre,
    totalEntreSemana: totalEntre,
    promedioEntreSemana: reunionesEntre ? redondear(totalEntre / reunionesEntre) : 0,
    reunionesFinSemana: reunionesFin,
    totalFinSemana: totalFin,
    promedioFinSemana: reunionesFin ? redondear(totalFin / reunionesFin) : 0,
    automaticoEntreSemana: !manualEntre,
    automaticoFinSemana: !manualFin,
  };
}

export interface ResumenAnioServicio {
  meses: ResumenMes[];
  totalReuniones: number;
  totalAsistencia: number;
  /** Promedio del año: promedio de los promedios de cada mes con reuniones. */
  promedioAnual: number;
  totalEntreSemana: number;
  totalFinSemana: number;
  /** Reuniones de entre semana (lun a sábado). */
  reunionesEntreSemana: number;
  reunionesFinSemana: number;
  /** Promedio de entre semana del año = promedio de los promedios mensuales. */
  promedioAnualEntreSemana: number;
  /** Promedio de fin de semana del año = promedio de los promedios mensuales. */
  promedioAnualFinSemana: number;
}

/**
 * Resumen mes a mes de un rango de meses (un año de servicio).
 * Los meses sin reuniones se listan igual con 0, para que se vea el hueco.
 */
export function resumenPorMes(
  filas: Pick<Asistencia, "fecha" | "total">[],
  meses: { clave: string; etiqueta: string }[],
  manuales: ResumenManual[] = [],
): ResumenAnioServicio {
  const porDia = new Map<string, { total: number; tipo: TipoReunion }>();
  for (const fila of filas) {
    const actual = porDia.get(fila.fecha) || { total: 0, tipo: tipoDeReunion(fila.fecha) };
    actual.total += fila.total;
    porDia.set(fila.fecha, actual);
  }

  const porManual = new Map(manuales.map((r) => [`${r.mes}|${r.tipo}`, r]));

  const resumenes = meses.map((m) =>
    resumenDeUnMes(
      m.clave,
      m.etiqueta,
      [...porDia.entries()]
        .filter(([fecha]) => fecha.startsWith(m.clave))
        .map(([, d]) => ({ total: d.total, tipo: d.tipo })),
      porManual,
    ),
  );

  const conReunion = resumenes.filter((r) => r.reuniones > 0);
  const conEntre = resumenes.filter((r) => r.reunionesEntreSemana > 0);
  const conFin = resumenes.filter((r) => r.reunionesFinSemana > 0);
  const totalReuniones = resumenes.reduce((s, r) => s + r.reuniones, 0);
  const totalAsistencia = resumenes.reduce((s, r) => s + r.total, 0);
  const totalEntre = resumenes.reduce((s, r) => s + r.totalEntreSemana, 0);
  const totalFin = resumenes.reduce((s, r) => s + r.totalFinSemana, 0);
  const reunionesEntre = resumenes.reduce((s, r) => s + r.reunionesEntreSemana, 0);
  const reunionesFin = resumenes.reduce((s, r) => s + r.reunionesFinSemana, 0);

  return {
    meses: resumenes,
    totalReuniones,
    totalAsistencia,
    // promedio de los promedios mensuales (los meses sin reunión no cuentan)
    promedioAnual: conReunion.length
      ? redondear(conReunion.reduce((s, r) => s + r.promedio, 0) / conReunion.length)
      : 0,
    totalEntreSemana: totalEntre,
    totalFinSemana: totalFin,
    reunionesEntreSemana: reunionesEntre,
    reunionesFinSemana: reunionesFin,
    promedioAnualEntreSemana: conEntre.length
      ? redondear(conEntre.reduce((s, r) => s + r.promedioEntreSemana, 0) / conEntre.length)
      : 0,
    promedioAnualFinSemana: conFin.length
      ? redondear(conFin.reduce((s, r) => s + r.promedioFinSemana, 0) / conFin.length)
      : 0,
  };
}

/** '100.5' -> '100,50' */
export function numeroPromedio(valor: number): string {
  return valor.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
