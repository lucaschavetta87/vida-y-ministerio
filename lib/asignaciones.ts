import type { Participante, ReunionParte } from "./tipos";

/* ============================================================
   Asignaciones para la reunión: una imagen por persona, con el
   formato de "asignacion.jpeg".
   ============================================================ */

export const NOTA_ESTUDIANTE =
  "Nota al estudiante: En la Guía de actividades encontrará la información que necesita para su intervención. Repase también las indicaciones que se describen en las instrucciones para la reunión Vida y Ministerio Cristianos (S-38).";

export const TITULO_ASIGNACION = [
  "ASIGNACIÓN PARA LA REUNIÓN",
  "VIDA Y MINISTERIO CRISTIANOS",
];

/** "2026-09-08" → "8 de septiembre de 2026" */
export function fechaLargaAsignacion(fecha: string): string {
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const [a, m, d] = fecha.split("-");
  if (!a || !m || !d) return fecha;
  return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`;
}

/**
 * Día de la reunión entre semana: el martes de esa semana (por defecto)
 * o el día que tenga configurado la reunión.
 */
export function fechaDeReunion(
  fechaInicio: string,
  diaConfigurado?: string | null,
): string {
  const base = new Date(`${fechaInicio}T12:00:00`);
  if (Number.isNaN(base.getTime())) return fechaInicio;

  const dias = [
    "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
  ];
  const pedido = (diaConfigurado || "").toLowerCase().trim();
  let objetivo = 1; // martes
  const indice = dias.findIndex((d) => pedido.startsWith(d.slice(0, 5)));
  if (indice >= 0) objetivo = indice;

  const diaDeHoy = (base.getDay() + 6) % 7; // 0 = lunes
  base.setDate(base.getDate() + (objetivo - diaDeHoy));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(
    base.getDate(),
  ).padStart(2, "0")}`;
}

/** "Chavetta, Nahiara" → "Nahiara Chavetta" (como figura en la lista) */
export function nombreComoFigura(nombre: string): string {
  const limpio = (nombre || "").trim();
  const m = limpio.match(/^(.+?),\s*(.+)$/);
  return m ? `${m[2].trim()} ${m[1].trim()}` : limpio;
}

/**
 * Los temas que llevan asignación: la Lectura de la Biblia y todos los
 * de Seamos mejores maestros.
 */
/** El número va en el texto del título ("5. Empiece conversaciones"). */
export function numeroDe(p: ReunionParte): number | null {
  const m = p.titulo.match(/^(\d+)\.?\s*/);
  return m ? Number(m[1]) : null;
}

export function esTemaDeAsignacion(p: ReunionParte): boolean {
  if (p.tipo !== "item" || numeroDe(p) === null) return false;
  if (p.seccion === "SEAMOS MEJORES MAESTROS") return true;
  return /lectura de la biblia/i.test(p.titulo);
}

/** Una imagen a generar. */
export interface AsignacionImagen {
  clave: string;
  /** id del participante al que se le manda */
  participanteId: string;
  nombre: string;
  /** nombre del otro, si el tema es de a pares */
  ayudante: string | null;
  /** "5" */
  numero: string;
  /** "Empiece conversaciones (de casa en casa)" */
  titulo: string;
  /** "martes de la semana" */
  fecha: string;
  /** texto de la línea "Intervención núm." */
  intervencion: string;
}

export function armarAsignaciones({
  partes,
  participantes,
  fecha,
}: {
  partes: ReunionParte[];
  participantes: Participante[];
  fecha: string;
}): AsignacionImagen[] {
  const nombreDe = (id: string | null | undefined) =>
    participantes.find((p) => p.id === id)?.nombre_completo || "";

  const salida: AsignacionImagen[] = [];
  partes
    .filter(esTemaDeAsignacion)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .forEach((p) => {
      const gente = (p.participante_ids || []).filter(Boolean);
      if (!gente.length) return;

      // el título sin el número inicial, que va aparte
      const titulo = p.titulo.replace(/^\d+\.?\s*/, "");
      const intervencion = `${numeroDe(p)}. ${titulo}`;

      gente.forEach((id) => {
        const otro = gente.length > 1 ? gente.find((x) => x !== id) : null;
        salida.push({
          clave: `${p.id}-${id}`,
          participanteId: id,
          nombre: nombreDe(id),
          ayudante: otro ? nombreDe(otro) : null,
          numero: String(numeroDe(p)),
          titulo,
          fecha,
          intervencion,
        });
      });
    });

  return salida;
}

/** Los temas que generan asignación y todavía no tienen persona. */
export function temasSinGente(partes: ReunionParte[]): string[] {
  return partes
    .filter((p) => esTemaDeAsignacion(p) && !(p.participante_ids || []).length)
    .map((p) => p.titulo);
}