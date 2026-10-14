import type { Participante } from "./tipos";

/* ============================================================
   Territorios y salidas al ministerio
   ============================================================ */

export type Zona = "NORTE" | "ESTE" | "CENTRO" | "SUR";

export const ZONAS: { valor: Zona; texto: string; rango: string }[] = [
  { valor: "NORTE", texto: "Norte", rango: "1-18" },
  { valor: "ESTE", texto: "Este", rango: "19-30" },
  { valor: "CENTRO", texto: "Centro", rango: "31-48" },
  { valor: "SUR", texto: "Sur", rango: "49-69" },
];

export const LETRAS = ["A", "B", "C", "D", "E", "F"] as const;

export interface Territorio {
  numero: number;
  zona: Zona;
  /** manzanas del territorio */
  letras: string[];
  nombre: string | null;
  /** posición sobre la imagen del mapa, en porcentaje */
  mapa_x: number | null;
  mapa_y: number | null;
  activo: boolean;
  /** lo que hay que saber antes de salir a ese territorio */
  observaciones?: string | null;
}

/* ------------------------------------------------------------
   Territorios personales: uno por publicador
   ------------------------------------------------------------ */

export interface TerritorioPersonal {
  id: string;
  publicador_id: string;
  territorio_numero: number;
  asignado_en: string;
  actualizado_en: string;
}

/** Un reporte que carga el publicador desde /territoriopersonal. */
export interface ReporteTerritorioPersonal {
  id: string;
  publicador_id: string;
  territorio_numero: number;
  fecha: string;
  estado: "COMPLETADO" | "INCOMPLETO";
  manzanas: string[];
  observaciones: string | null;
  creado_en: string;
  actualizado_en: string;
}

export type EstadoTerritorio = "COMPLETADO" | "PENDIENTE" | "DISPONIBLE";

/** Estado de cada territorio en un mes: verde, amarillo o gris. */
export type ColoresTerritorio = Record<
  number,
  { estado: EstadoTerritorio; ultima: string | null; letrasHechas: string[] }
>;

/** Una salida de territorio: día, conductor y qué se hizo. */
export interface SalidaTerritorio {
  id: string;
  fecha: string;
  conductor_id: string;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface SalidaTerritorioDetalle {
  id: string;
  salida_id: string;
  territorio_numero: number;
  letras: string[];
  estado: "COMPLETADO" | "PENDIENTE";
}

/** Salida con todo junto (para mostrar). */
export interface SalidaConDetalle extends SalidaTerritorio {
  detalle: SalidaTerritorioDetalle[];
  conductor?: string | null;
}

/** Una fila de la planilla de salidas al ministerio. */
export interface SalidaMinisterio {
  id: string;
  fecha: string;
  hora: string | null;
  ubicacion: string | null;
  conductor_id: string | null;
  territorios: string | null;
  notas: string | null;
  /** TERRITORIO (default) o TELEFONICA (sin territorios). */
  tipo?: "TERRITORIO" | "TELEFONICA" | null;
  /** MANANA o TARDE, para ordenar la planilla. */
  turno?: "MANANA" | "TARDE" | null;
  /** la fila ocupa toda la línea (feriado, nota del día) */
  es_nota?: boolean | null;
  /** conductor escrito a mano cuando no es una persona (PRECURSORES…) */
  conductor_texto?: string | null;
  creado_en: string;
  actualizado_en: string;
  conductor?: string | null;
}

/** Encabezado de la portada del PDF. */
export interface ConfigSalidas {
  titulo: string;
  subtitulo: string;
  rango: string | null;
  color_fondo: string;
  color_tabla: string;
  /** fondos que se alternan día por día en la planilla */
  color_fila_a: string;
  color_fila_b: string;
  /** data URL de la imagen que va a la derecha del encabezado */
  encabezado_imagen?: string | null;
}

export const CONFIG_POR_DEFECTO: ConfigSalidas = {
  titulo: "Campaña de invitación",
  subtitulo: "Este Las Heras",
  rango: null,
  color_fondo: "#8d7a74",
  color_tabla: "#413b39",
  color_fila_a: "#ffffff",
  color_fila_b: "#f0eae4",
};

/** Un mes 'YYYY-MM' */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Meses con salidas, del más nuevo al más viejo. */
export function mesesConSalidas(salidas: SalidaTerritorio[]): string[] {
  const set = new Set(salidas.map((s) => mesDe(s.fecha)));
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** Los últimos n meses, del más reciente al más viejo. */
export function ultimosMeses(n: number, desde: Date = new Date()): string[] {
  const lista: string[] = [];
  let a = desde.getFullYear();
  let m = desde.getMonth();
  for (let i = 0; i < n; i += 1) {
    lista.push(`${a}-${String(m + 1).padStart(2, "0")}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      a -= 1;
    }
  }
  return lista;
}

/**
 * Estado de cada territorio en un mes: completado, pendiente o disponible.
 * Un territorio completado en el mes ya no se muestra; uno pendiente
 * vuelve a quedar disponible (y con la letra a medias, para seguir).
 */
export function estadoDeTerritorios(
  territorios: Territorio[],
  salidas: SalidaConDetalle[],
  mes: string,
): ColoresTerritorio {
  const mapa: ColoresTerritorio = {};
  territorios.forEach((t) => {
    mapa[t.numero] = { estado: "DISPONIBLE", ultima: null, letrasHechas: [] };
  });

  for (const salida of salidas) {
    if (mesDe(salida.fecha) !== mes) continue;
    for (const item of salida.detalle) {
      const actual = mapa[item.territorio_numero];
      if (!actual) continue;
      if (item.estado === "COMPLETADO") {
        actual.estado = "COMPLETADO";
        actual.ultima = salida.fecha;
        actual.letrasHechas = item.letras || [];
      } else if (actual.estado !== "COMPLETADO") {
        actual.estado = "PENDIENTE";
        actual.ultima = actual.ultima || salida.fecha;
        actual.letrasHechas = [
          ...new Set([...actual.letrasHechas, ...(item.letras || [])]),
        ];
      }
    }
  }
  return mapa;
}

/** La última vez que se completó cada territorio (de cualquier mes). */
export function ultimasVisitas(salidas: SalidaConDetalle[]): Record<number, string> {
  const mapa: Record<number, string> = {};
  for (const salida of [...salidas].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    for (const item of salida.detalle) {
      if (item.estado === "COMPLETADO") mapa[item.territorio_numero] = salida.fecha;
    }
  }
  return mapa;
}

/** Territorios que todavía no se hicieron completos este mes. */
export function pendientesDelMes(
  territorios: Territorio[],
  colores: ColoresTerritorio,
): Territorio[] {
  return territorios
    .filter((t) => t.activo && colores[t.numero]?.estado !== "COMPLETADO")
    .sort((a, b) => a.numero - b.numero);
}

/** Conductor aprobado para salidas (siempre hombre). */
export function esConductorSalidas(
  persona: Pick<Participante, "conductor_salidas_aprobado" | "genero" | "activo"> | null,
): boolean {
  if (!persona) return false;
  return persona.activo && persona.genero === "HOMBRE" && !!persona.conductor_salidas_aprobado;
}


/** '2026-10' -> 'octubre de 2026' */
export function nombreDelMes(clave: string): string {
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const [anio, m] = clave.split("-");
  const i = Number(m) - 1;
  return `${meses[i] || clave} de ${anio}`;
}

/** '2026-10-14' -> 'miércoles 14 de octubre' */
export function fechaCorta(fecha: string): string {
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`;
}

/** Hoy en clave 'YYYY-MM-DD' */
export function hoyClave(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Colores del punto sobre el mapa, según el estado. */
export const COLOR_ESTADO: Record<EstadoTerritorio, string> = {
  COMPLETADO: "#2f9e44",
  PENDIENTE: "#f59f00",
  DISPONIBLE: "#adb5bd",
};