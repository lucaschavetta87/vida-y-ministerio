import { edadDe } from "./fechas";
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

type PersonaBasica = {
  id: string;
  nombre_completo: string;
  genero: Coincidencia["genero"];
  edad: number | null;
  fecha_nacimiento: string | null;
  clasificacion: Coincidencia["clasificacion"];
  conductor_salidas_aprobado?: boolean;
  es_publicador?: boolean;
};

type PersonaId = {
  nombre_completo?: string;
  activo?: boolean;
  es_publicador?: boolean;
};

/**
 * Trae una persona por id. Si todavía no existe la columna
 * es_publicador (migración pendiente) reintenta sin ella.
 */
export async function traerPersonaPorId(
  id: string,
  columnas = "nombre_completo",
): Promise<PersonaId | null> {
  let { data, error } = await supabase
    .from("participantes")
    .select(`${columnas}, es_publicador`)
    .eq("id", id)
    .maybeSingle();

  if (error && /es_publicador/.test(error.message)) {
    ({ data, error } = await supabase
      .from("participantes")
      .select(columnas)
      .eq("id", id)
      .maybeSingle());
  }

  if (error) throw error;
  return (data as PersonaId | null) || null;
}

/**
 * Candidatos activos para la búsqueda por nombre. Si todavía no existe la
 * columna es_publicador (migración pendiente) la trae sin ella.
 */
async function candidatos(): Promise<{ personas: PersonaBasica[]; conPublicador: boolean }> {
  const columnas =
    "id, nombre_completo, genero, edad, fecha_nacimiento, clasificacion, conductor_salidas_aprobado";

  const conColumna = await supabase
    .from("participantes")
    .select(`${columnas}, es_publicador`)
    .eq("activo", true);

  if (!conColumna.error) {
    return { personas: (conColumna.data as PersonaBasica[]) || [], conPublicador: true };
  }

  if (!/es_publicador/.test(conColumna.error.message)) throw conColumna.error;

  const sinColumna = await supabase
    .from("participantes")
    .select(columnas)
    .eq("activo", true);
  if (sinColumna.error) throw sinColumna.error;
  return { personas: (sinColumna.data as PersonaBasica[]) || [], conPublicador: false };
}

/**
 * Busca participantes activos cuyo nombre se parece a lo escrito.
 * Tolera acentos, mayúsculas, comas, nombres parciales y orden invertido.
 * Nunca devuelve la lista completa: solo las 4 coincidencias más parecidas.
 *
 * Con `soloPublicadores` deja afuera a los que no llenan el informe.
 */
export async function buscarPorNombre(
  buscar: string,
  opciones: { soloPublicadores?: boolean } = {},
): Promise<Coincidencia[]> {
  if (normalizarNombre(buscar).length < MIN_LETRAS_BUSQUEDA) return [];

  const { personas, conPublicador } = await candidatos();
  const filtradas =
    opciones.soloPublicadores && conPublicador
      ? personas.filter((p) => p.es_publicador !== false)
      : personas;

  return mejoresCoincidencias(buscar, filtradas, (p) => p.nombre_completo, {
    limite: 4,
  }).map(({ elemento, puntaje }) => ({
    id: elemento.id,
    nombre: elemento.nombre_completo,
    genero: elemento.genero,
    edad: edadDe(elemento),
    clasificacion: elemento.clasificacion,
    conductor_salidas_aprobado: elemento.conductor_salidas_aprobado === true,
    puntaje,
  }));
}

/** ¿Esa persona ya envió el informe del mes? */
export async function estadoDe(
  participanteId: string,
  mes: string,
): Promise<{
  enviado: boolean;
  nombre?: string;
  esPublicador: boolean;
  informe?: Informe;
}> {
  const [informe, persona] = await Promise.all([
    supabase
      .from("informes")
      .select("*")
      .eq("participante_id", participanteId)
      .eq("mes", mes)
      .maybeSingle()
      .then(({ data }) => data as Informe | null),
    traerPersonaPorId(participanteId),
  ]);

  return {
    enviado: Boolean(informe),
    nombre: persona?.nombre_completo,
    esPublicador: persona?.es_publicador !== false,
    informe: informe || undefined,
  };
}

/** El mes que se informa es siempre el anterior. */
export function mesDelFormulario(): string {
  return mesAnterior();
}

export { etiquetaMes };
