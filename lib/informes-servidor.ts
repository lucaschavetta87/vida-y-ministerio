import { supabase } from "@/lib/supabase";
import {
  etiquetaMes,
  mejoresCoincidencias,
  mesAnterior,
  normalizarNombre,
  type Coincidencia,
  type Informe,
} from "@/lib/informes";

/** Mínimo de letras para buscar ("paula", "cast"). */
export const MIN_LETRAS_BUSQUEDA = 3;

/**
 * Busca participantes activos cuyo nombre se parece a lo escrito.
 * Tolera acentos, mayúsculas, comas, nombres parciales y orden invertido.
 * Nunca devuelve la lista completa: solo las 4 coincidencias más parecidas.
 */
export async function buscarPorNombre(buscar: string): Promise<Coincidencia[]> {
  if (normalizarNombre(buscar).length < MIN_LETRAS_BUSQUEDA) return [];

  const { data, error } = await supabase
    .from("participantes")
    .select("id, nombre_completo, genero, edad, clasificacion")
    .eq("activo", true);

  if (error) throw error;

  const personas = (data as {
    id: string;
    nombre_completo: string;
    genero: Coincidencia["genero"];
    edad: number | null;
    clasificacion: Coincidencia["clasificacion"];
  }[]) || [];

  return mejoresCoincidencias(buscar, personas, (p) => p.nombre_completo, {
    limite: 4,
  }).map(({ elemento, puntaje }) => ({
    id: elemento.id,
    nombre: elemento.nombre_completo,
    genero: elemento.genero,
    edad: elemento.edad,
    clasificacion: elemento.clasificacion,
    puntaje,
  }));
}

/** ¿Esa persona ya envió el informe del mes? */
export async function estadoDe(
  participanteId: string,
  mes: string,
): Promise<{ enviado: boolean; nombre?: string; informe?: Informe }> {
  const [{ data: informe }, { data: persona }] = await Promise.all([
    supabase
      .from("informes")
      .select("*")
      .eq("participante_id", participanteId)
      .eq("mes", mes)
      .maybeSingle(),
    supabase.from("participantes").select("nombre_completo").eq("id", participanteId).maybeSingle(),
  ]);

  return {
    enviado: Boolean(informe),
    nombre: (persona as { nombre_completo?: string } | null)?.nombre_completo,
    informe: (informe as Informe) || undefined,
  };
}

/** El mes que se informa es siempre el anterior. */
export function mesDelFormulario(): string {
  return mesAnterior();
}

export { etiquetaMes };
