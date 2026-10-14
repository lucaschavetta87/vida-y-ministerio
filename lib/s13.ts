import type { SalidaConDetalle, Territorio } from "./territorios";

/* ============================================================
   S-13-S · REGISTRO DE ASIGNACIÓN DE TERRITORIO

   El formulario se arma solo con las salidas de territorio:
   cada vez que un territorio aparece en una salida, se anota
   la fecha en que se asignó; si en otra salida quedó completado,
   se anota también la fecha en que se completó.

   Lo que el usuario corrija a mano (tabla s13_ajustes) pisa lo
   automático.
   ============================================================ */

/** Cuántos ciclos entran por territorio en el formulario. */
export const CICLOS_POR_TERRITORIO = 4;

/** Una corrección manual de un ciclo. */
export interface AjusteS13 {
  territorio_numero: number;
  ciclo: number;
  fecha_asignado: string | null;
  fecha_completo: string | null;
  conductor_id: string | null;
  conductor_texto: string | null;
  borrado: boolean;
  actualizado_en?: string;
}

/** Un ciclo del formulario. */
export interface CicloS13 {
  /** 1 a 4 */
  indice: number;
  fechaAsignado: string | null;
  fechaCompletado: string | null;
  /** nombre del conductor */
  conductor: string | null;
  /** true si viene de una corrección manual */
  manual: boolean;
}

/** Una fila del formulario: un territorio y sus 4 ciclos. */
export interface FilaS13 {
  numero: number;
  zona: string;
  letras: string[];
  /** última fecha en que se completó */
  ultimaCompleto: string | null;
  /** siempre 4, con huecos donde no hay nada */
  ciclos: CicloS13[];
  /** cuántos ciclos hay en total (puede ser más que 4) */
  total: number;
}

const cicloVacio = (indice: number): CicloS13 => ({
  indice,
  fechaAsignado: null,
  fechaCompletado: null,
  conductor: null,
  manual: false,
});

/**
 * Los ciclos automáticos de un territorio, sacados de las salidas:
 * se abre un ciclo cuando el territorio aparece pendiente y se
 * cierra con la salida donde quedó completado.
 */
function ciclosDeSalidas(
  salidas: SalidaConDetalle[],
  numero: number,
  nombreDe: (id: string | null | undefined) => string | null,
): { asignado: string; completado: string | null; conductor: string | null }[] {
  const pasos = salidas
    .filter((s) => s.detalle.some((d) => d.territorio_numero === numero))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const ciclos: {
    asignado: string;
    completado: string | null;
    conductor: string | null;
  }[] = [];
  let abierto: { asignado: string; completado: string | null; conductor: string | null } | null =
    null;

  for (const salida of pasos) {
    const delTerritorio = salida.detalle.filter((d) => d.territorio_numero === numero);
    const completo = delTerritorio.some((d) => d.estado === "COMPLETADO");
    const pendiente = delTerritorio.some((d) => d.estado === "PENDIENTE");
    const conductor = nombreDe(salida.conductor_id) || null;

    if (completo) {
      if (abierto) {
        // el conductor que queda es el que lo tenía asignado,
        // que es lo que dice el formulario ("Asignado a")
        abierto.completado = salida.fecha;
        ciclos.push(abierto);
        abierto = null;
      } else {
        // se hizo y completó en la misma salida
        ciclos.push({ asignado: salida.fecha, completado: salida.fecha, conductor });
      }
    } else if (pendiente && !abierto) {
      abierto = { asignado: salida.fecha, completado: null, conductor };
    }
  }

  if (abierto) ciclos.push(abierto);
  return ciclos;
}

/**
 * Arma el formulario completo: los 69 territorios con sus 4 ciclos,
 * ya sea con lo automático o con las correcciones manuales.
 */
export function armarS13({
  territorios,
  salidas,
  ajustes,
  nombreDe,
}: {
  territorios: Territorio[];
  salidas: SalidaConDetalle[];
  ajustes: AjusteS13[];
  nombreDe: (id: string | null | undefined) => string | null;
}): FilaS13[] {
  const porTerritorio = new Map<number, AjusteS13[]>();
  ajustes.forEach((a) => {
    porTerritorio.set(a.territorio_numero, [
      ...(porTerritorio.get(a.territorio_numero) || []),
      a,
    ]);
  });

  return [...territorios]
    .filter((t) => t.activo !== false)
    .sort((a, b) => a.numero - b.numero)
    .map((t) => {
      const automaticos = ciclosDeSalidas(salidas, t.numero, nombreDe);
      const mios = (porTerritorio.get(t.numero) || []).sort(
        (a, b) => a.ciclo - b.ciclo,
      );

      // primero se arma con lo automático
      const lista: CicloS13[] = automaticos
        .slice(0, CICLOS_POR_TERRITORIO)
        .map((c, i) => ({
          indice: i + 1,
          fechaAsignado: c.asignado,
          fechaCompletado: c.completado,
          conductor: c.conductor,
          manual: false,
        }));

      // después pisan los ajustes
      for (const a of mios) {
        if (a.borrado) {
          // si se borró un ciclo, los siguientes se corren
          const restante = lista.filter((c) => c.indice !== a.ciclo);
          lista.length = 0;
          lista.push(...restante);
          continue;
        }
        const ciclo = lista.find((c) => c.indice === a.ciclo);
        const nuevo: CicloS13 = {
          indice: a.ciclo,
          fechaAsignado: a.fecha_asignado,
          fechaCompletado: a.fecha_completo,
          conductor:
            a.conductor_texto ||
            (a.conductor_id ? nombreDe(a.conductor_id) : null),
          manual: true,
        };
        if (ciclo) Object.assign(ciclo, nuevo);
        else lista.push(nuevo);
      }

      // se rellenan los huecos hasta 4
      for (let i = lista.length; i < CICLOS_POR_TERRITORIO; i += 1) {
        lista.push(cicloVacio(i + 1));
      }
      lista.sort((a, b) => a.indice - b.indice);

      const completados = lista
        .map((c) => c.fechaCompletado)
        .filter((f): f is string => !!f)
        .sort();

      return {
        numero: t.numero,
        zona: t.zona,
        letras: t.letras || [],
        ultimaCompleto: automaticos.length
          ? completados[completados.length - 1] || null
          : null,
        ciclos: lista,
        total: automaticos.length,
      };
    });
}

/** "12/10" o "12/10/24" si es de otro año. */
export function fechaCortaS13(fecha: string | null, anioServicio?: number): string {
  if (!fecha) return "";
  const [a, m, d] = fecha.split("-");
  if (!a || !m || !d) return fecha;
  if (anioServicio && Number(a) !== anioServicio) return `${d}/${m}/${a.slice(2)}`;
  return `${d}/${m}`;
}