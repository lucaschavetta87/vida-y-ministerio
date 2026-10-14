import type { SalidaMinisterio } from "./territorios";

/* ============================================================
   La planilla se arma por semana: los 7 días, de lunes a domingo.
   ============================================================ */

export type Turno = "MANANA" | "TARDE";
export type TipoSalida = "TERRITORIO" | "TELEFONICA";

export interface TurnoSemana {
  /** 0 = lunes ... 6 = domingo */
  indice: number;
  nombre: string;
  /**
   * Si la tarde es habitual. El martes no lo es, pero se puede agregar
   * a mano con el botón + cuando haga falta.
   */
  tardeHabitual: boolean;
}

/** La semana fija de salidas: lunes a domingo. */
export const SEMANA: TurnoSemana[] = [
  { indice: 0, nombre: "Lunes", tardeHabitual: true },
  { indice: 1, nombre: "Martes", tardeHabitual: false },
  { indice: 2, nombre: "Miércoles", tardeHabitual: true },
  { indice: 3, nombre: "Jueves", tardeHabitual: true },
  { indice: 4, nombre: "Viernes", tardeHabitual: true },
  { indice: 5, nombre: "Sábado", tardeHabitual: true },
  { indice: 6, nombre: "Domingo", tardeHabitual: true },
];

/** Cuántas filas libres arranca cada día en la pantalla. */
export const FILAS_POR_DIA = 3;

/** El día de la semana de una fecha: 0 = lunes ... 6 = domingo. */
export function diaDeSemana(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return (d.getDay() + 6) % 7;
}

/** Devuelve la fecha como 'YYYY-MM-DD', sin corrimiento por zona horaria. */
export function aClave(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(
    fecha.getDate(),
  ).padStart(2, "0")}`;
}

const desdeClave = (fecha: string) => new Date(`${fecha}T12:00:00`);

/** El lunes de la semana de una fecha cualquiera. */
export function inicioDeSemana(fecha: string): string {
  const d = desdeClave(fecha);
  d.setDate(d.getDate() - diaDeSemana(fecha));
  return aClave(d);
}

/** Los 7 días de la semana de una fecha, de lunes a domingo. */
export function diasDeSemana(fecha: string): string[] {
  const lunes = inicioDeSemana(fecha);
  const d = desdeClave(lunes);
  return Array.from({ length: 7 }, (_, i) => {
    const copia = new Date(d);
    copia.setDate(d.getDate() + i);
    return aClave(copia);
  });
}

/** Suma (o resta) días a una fecha. */
export function moverDias(fecha: string, dias: number): string {
  const d = desdeClave(fecha);
  d.setDate(d.getDate() + dias);
  return aClave(d);
}

/** "DEL 12 AL 17 DE OCTUBRE" — el rango que va en el encabezado. */
export function rangoDeSemana(fecha: string): string {
  const dias = diasDeSemana(fecha);
  const ini = desdeClave(dias[0]);
  const fin = desdeClave(dias[6]);
  const mesCorto = (d: Date) =>
    [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ][d.getMonth()];
  if (ini.getMonth() === fin.getMonth()) {
    return `DEL ${ini.getDate()} AL ${fin.getDate()} DE ${mesCorto(ini).toUpperCase()}`;
  }
  return `DEL ${ini.getDate()} DE ${mesCorto(ini).toUpperCase()} AL ${fin.getDate()} DE ${mesCorto(
    fin,
  ).toUpperCase()}`;
}

/** "Semana del 12 al 17 de octubre de 2026" — para el título de la pantalla. */
export function tituloDeSemana(fecha: string): string {
  const dias = diasDeSemana(fecha);
  const ini = desdeClave(dias[0]);
  const fin = desdeClave(dias[6]);
  const mes = (d: Date) =>
    [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ][d.getMonth()];
  return `Semana del ${ini.getDate()} al ${fin.getDate()} de ${mes(fin)} de ${fin.getFullYear()}`;
}

/** Todas las fechas de un mes 'YYYY-MM', en orden. */
export function fechasDelMes(mes: string): string[] {
  const [anio, m] = mes.split("-");
  const num = Number(m);
  const dias = new Date(Number(anio), num, 0).getDate();
  const lista: string[] = [];
  for (let d = 1; d <= dias; d += 1) {
    lista.push(`${anio}-${String(num).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return lista;
}

/** Mañana y tarde siempre: los dos se pueden usar, el + los agrega. */
export function turnosDe(fecha: string): TurnoSemana[] {
  const dia = SEMANA[diaDeSemana(fecha)];
  return [dia, { ...dia, nombre: "Tarde" }];
}

export function nombreDelTurno(turno: Turno): string {
  return turno === "MANANA" ? "Mañana" : "Tarde";
}

export function nombreDelTipo(tipo: TipoSalida): string {
  return tipo === "TELEFONICA" ? "Telefónica" : "Territorio";
}

/** Una celda de la planilla. */
export interface CeldaPlanilla {
  fecha: string;
  turno: Turno;
  /** día de la semana */
  dia: TurnoSemana;
  /** false = se agregó a mano (el martes a la tarde no es habitual) */
  habitual: boolean;
  filas: SalidaMinisterio[];
}

/**
 * Arma la planilla del mes: una celda por día y turno. Solo trae los
 * turnos que existen ese día (el martes no tiene tarde).
 */
export function planillaDelMes(
  salidas: SalidaMinisterio[],
  mes: string,
): CeldaPlanilla[] {
  const celdas: CeldaPlanilla[] = [];
  for (const fecha of fechasDelMes(mes)) {
    const dia = SEMANA[diaDeSemana(fecha)];
    for (const turno of ["MANANA", "TARDE"] as Turno[]) {
      celdas.push({
        fecha,
        turno,
        dia,
        habitual: turno === "MANANA" || dia.tardeHabitual,
        filas: salidas
          .filter((s) => s.fecha === fecha && (s.turno || "MANANA") === turno)
          .sort((a, b) => (a.hora || "").localeCompare(b.hora || "")),
      });
    }
  }
  return celdas;
}

/** Las celdas que tienen algo cargado (los días vacíos no se imprimen). */
export function celdasConSalidas(celdas: CeldaPlanilla[]): CeldaPlanilla[] {
  return celdas.filter((c) => c.filas.length > 0);
}

/** Las salidas de llamada telefónica (no llevan territorios). */
export function esTelefonica(salida: SalidaMinisterio): boolean {
  return (salida.tipo || "TERRITORIO") === "TELEFONICA";
}

/**
 * Los 7 días de la semana con lo que hay cargado: notas a lo ancho y
 * salidas ordenadas por hora. Lo vacío no se imprime.
 */
export interface DiaPlanilla {
  fecha: string;
  dia: TurnoSemana;
  notas: SalidaMinisterio[];
  salidas: SalidaMinisterio[];
}

export function planillaDeSemana(
  salidas: SalidaMinisterio[],
  fecha: string,
): DiaPlanilla[] {
  const conHora = (a: SalidaMinisterio, b: SalidaMinisterio) =>
    (a.hora || "").localeCompare(b.hora || "") || a.creado_en.localeCompare(b.creado_en);

  return diasDeSemana(fecha).map((f) => {
    const delDia = salidas.filter((s) => s.fecha === f);
    return {
      fecha: f,
      dia: SEMANA[diaDeSemana(f)],
      notas: delDia.filter((s) => s.es_nota),
      salidas: delDia.filter((s) => !s.es_nota).sort(conHora),
    };
  });
}

/** "martes 13" — como se ve la fecha en la planilla. */
export function fechaTabla(fecha: string): string {
  const d = desdeClave(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return `${SEMANA[diaDeSemana(fecha)].nombre} ${d.getDate()}`;
}

/** Sin tildes y en minúsculas, para buscar nombres. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}