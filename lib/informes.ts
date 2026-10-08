import type { Clasificacion, Genero } from "./tipos";

export type TipoInforme = "PRECURSOR" | "AUXILIAR" | "PUBLICADOR";

export type OrigenInforme = "formulario" | "secretaria";

export const TIPOS_INFORME: { valor: TipoInforme; texto: string }[] = [
  { valor: "PRECURSOR", texto: "Precursor" },
  { valor: "AUXILIAR", texto: "Auxiliar" },
  { valor: "PUBLICADOR", texto: "Publicador" },
];

/** Metas de auxiliar: la persona marca a cuál llegó, y aparte reporta las horas reales. */
export const HORAS_AUXILIAR = [15, 30] as const;

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Abreviaturas para el PDF / tablas. */
export const MESES_CORTO = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export interface Informe {
  id: string;
  participante_id: string;
  mes: string;
  tipo: TipoInforme;
  horas: number | null;
  horas_meta: number | null;
  participo: boolean | null;
  estudios_biblicos: number;
  observaciones: string | null;
  origen: OrigenInforme;
  enviado_en: string;
  actualizado_en: string;
}

/** Persona que ya carga su informe en otra web: solo queda la marca en verde. */
export interface MarcaInforme {
  participante_id: string;
  mes: string;
  creado_en: string;
}

/** Un mes ya cerrado por la Secretaría (nada se borra, solo deja de pedirse). */
export interface MesCerrado {
  mes: string;
  cerrado_en: string;
}

/** Lo que se guarda de un informe, sin los datos de la base. */
export interface BorradorInforme {
  tipo: TipoInforme;
  horas: number | null;
  horas_meta: number | null;
  participo: boolean | null;
  estudios_biblicos: number;
  observaciones: string | null;
}

/** Lo que se va completando en el formulario (el tipo todavía puede estar vacío). */
export interface BorradorFormulario {
  tipo: TipoInforme | null;
  horas: number | null;
  horas_meta: number | null;
  participo: boolean | null;
  estudios_biblicos: number;
  observaciones: string | null;
}

export const BORRADOR_VACIO: BorradorFormulario = {
  tipo: null,
  horas: null,
  horas_meta: null,
  participo: null,
  estudios_biblicos: 0,
  observaciones: null,
};

/** Persona devuelta por la búsqueda del formulario público. */
export interface Coincidencia {
  id: string;
  nombre: string;
  genero: Genero;
  edad: number | null;
  clasificacion: Clasificacion;
  puntaje: number;
}

/** Un mes en clave 'YYYY-MM'. */
export function claveMes(anio: number, mesCeroBased: number): string {
  return `${anio}-${String(mesCeroBased + 1).padStart(2, "0")}`;
}

/** siempre el mes anterior al de hoy */
export function mesAnterior(fecha: Date = new Date()): string {
  const mes = fecha.getMonth();
  return mes === 0
    ? claveMes(fecha.getFullYear() - 1, 11)
    : claveMes(fecha.getFullYear(), mes - 1);
}

export function mesActual(fecha: Date = new Date()): string {
  return claveMes(fecha.getFullYear(), fecha.getMonth());
}

/** '2026-09' -> 'septiembre de 2026' */
export function etiquetaMes(clave: string): string {
  const [anio, mes] = clave.split("-");
  const indice = Number(mes) - 1;
  if (!anio || Number.isNaN(indice) || !MESES[indice]) return clave;
  return `${MESES[indice]} de ${anio}`;
}

/** Los últimos n meses, del más reciente al más antiguo. */
export function ultimosMeses(cantidad: number, desde: Date = new Date()): string[] {
  const lista: string[] = [];
  let anio = desde.getFullYear();
  let mes = desde.getMonth();
  for (let i = 0; i < cantidad; i++) {
    lista.push(claveMes(anio, mes));
    mes -= 1;
    if (mes < 0) {
      mes = 11;
      anio -= 1;
    }
  }
  return lista;
}

/** Sin acentos, en minúsculas y sin comas/puntos: 'Castro, Ernesto Fabián' -> 'castro ernesto fabian' */
export function normalizarNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distancia de Levenshtein, para 'ern' ≈ 'ernesto'. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previo = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(actual[j - 1] + 1, previo[j] + 1, previo[j - 1] + costo);
    }
    previo = actual;
  }
  return previo[b.length];
}

/**
 * Qué tan parecidas son dos palabras (0..1): igual > prefijo > edición corta.
 */
export function parecidoPalabra(consulta: string, palabra: string): number {
  if (consulta === palabra) return 1;
  const corto = Math.min(consulta.length, palabra.length);
  const largo = Math.max(consulta.length, palabra.length);
  if (corto < 3) return 0;
  if (palabra.startsWith(consulta) || consulta.startsWith(palabra)) return 0.85;
  const distancia = levenshtein(consulta, palabra);
  if (distancia <= 1 && largo >= 5) return 0.8;
  if (distancia <= 2 && largo >= 7) return 0.65;
  if (distancia / largo <= 0.34) return 0.45;
  return 0;
}

/**
 * Puntaje 0..100 de coincidencias entre lo que escribió y un nombre completo.
 * Se puede escribir parcial, sin acentos, desordenado y sin el apellido entero.
 */
export function puntajeNombre(consulta: string, nombreCompleto: string): number {
  const q = normalizarNombre(consulta);
  const n = normalizarNombre(nombreCompleto);
  if (!q || !n) return 0;
  if (q === n) return 100;
  if (n.startsWith(q)) return 95;
  if (n.includes(q) && q.length >= 4) return 88;

  const palabrasConsulta = q.split(" ").filter(Boolean);
  const palabrasNombre = n.split(" ").filter(Boolean);
  let suma = 0;
  for (const palabra of palabrasConsulta) {
    let mejor = 0;
    for (const delNombre of palabrasNombre) {
      mejor = Math.max(mejor, parecidoPalabra(palabra, delNombre));
    }
    suma += mejor;
  }
  const puntaje = (suma / palabrasConsulta.length) * 88;
  return Math.round(Math.min(puntaje, 84));
}

/** Ordena por puntaje y deja las mejores coincidencias (>= umbral). */
export function mejoresCoincidencias<T>(
  consulta: string,
  elementos: T[],
  nombreDe: (elemento: T) => string,
  opciones: { limite?: number; umbral?: number } = {},
): { elemento: T; puntaje: number }[] {
  const limite = opciones.limite ?? 4;
  const umbral = opciones.umbral ?? 45;
  return elementos
    .map((elemento) => ({ elemento, puntaje: puntajeNombre(consulta, nombreDe(elemento)) }))
    .filter((x) => x.puntaje >= umbral)
    .sort((a, b) => b.puntaje - a.puntaje || nombreDe(a.elemento).localeCompare(nombreDe(b.elemento), "es"))
    .slice(0, limite);
}

export function esClaveMes(valor: unknown): valor is string {
  return typeof valor === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

export function textoTipo(tipo: TipoInforme | null | undefined): string {
  if (tipo === "PRECURSOR") return "Precursor";
  if (tipo === "AUXILIAR") return "Auxiliar";
  if (tipo === "PUBLICADOR") return "Publicador";
  return "Sin informar";
}

/** Error de validación por campo. */
export type ErroresInforme = Partial<
  Record<"tipo" | "horas" | "horas_meta" | "participo" | "estudios_biblicos" | "observaciones", string>
>;

function aNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const limpio = valor.trim().replace(",", ".");
    if (!limpio) return null;
    const n = Number(limpio);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function validarHoras(entrada: unknown, errores: ErroresInforme): number | null {
  const valor = aNumero(entrada);
  if (valor === null) {
    errores.horas = "Ingresá cuántas horas hiciste este mes.";
    return null;
  }
  if (valor < 0) {
    errores.horas = "Las horas no pueden ser negativas.";
    return null;
  }
  if (valor > 999) {
    errores.horas = "Revisá las horas (máximo 999).";
    return null;
  }
  return valor;
}

/**
 * Valida y normaliza lo que llega del formulario.
 * Devuelve el informe listo para guardar o los errores por campo.
 */
export function validarInforme(entrada: {
  tipo?: unknown;
  horas?: unknown;
  horas_meta?: unknown;
  participo?: unknown;
  estudios_biblicos?: unknown;
  observaciones?: unknown;
}): { datos: BorradorInforme } | { errores: ErroresInforme } {
  const errores: ErroresInforme = {};

  const tipo = entrada.tipo;
  if (tipo !== "PRECURSOR" && tipo !== "AUXILIAR" && tipo !== "PUBLICADOR") {
    errores.tipo = "Elegí cómo fue tu mes.";
    return { errores };
  }

  let horas: number | null = null;
  let horas_meta: number | null = null;
  let participo: boolean | null = null;

  if (tipo === "PRECURSOR") {
    horas = validarHoras(entrada.horas, errores);
  }

  if (tipo === "AUXILIAR") {
    // a qué meta llegó (15 o 30) y cuántas horas hizo en realidad
    const meta = aNumero(entrada.horas_meta);
    if (meta === null || !HORAS_AUXILIAR.includes(meta as 15 | 30)) {
      errores.horas_meta = "Elegí si llegaste a la meta de 15 o de 30 horas.";
    } else {
      horas_meta = meta;
    }
    horas = validarHoras(entrada.horas, errores);
  }

  if (tipo === "PUBLICADOR") {
    const valor = entrada.participo;
    if (typeof valor !== "boolean") errores.participo = "Decí si participaste o no.";
    else participo = valor;
  }

  const estudios = aNumero(entrada.estudios_biblicos);
  if (
    entrada.estudios_biblicos !== undefined &&
    entrada.estudios_biblicos !== null &&
    entrada.estudios_biblicos !== ""
  ) {
    if (estudios === null || estudios < 0 || !Number.isInteger(estudios)) {
      errores.estudios_biblicos = "Escribí un número entero (0 si no tuviste).";
    }
  }

  let observaciones: string | null = null;
  if (typeof entrada.observaciones === "string" && entrada.observaciones.trim()) {
    observaciones = entrada.observaciones.trim();
    if (observaciones.length > 1000)
      errores.observaciones = "Las observaciones son muy largas (máximo 1000).";
  }

  if (Object.keys(errores).length) return { errores };

  return {
    datos: {
      tipo,
      horas,
      horas_meta,
      participo,
      estudios_biblicos: estudios ?? 0,
      observaciones,
    },
  };
}
