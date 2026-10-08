import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { buscarPorNombre, traerPersonaPorId } from "@/lib/informes-servidor";
import { mesDeFecha, validarAsistencia } from "@/lib/asistencia";

/** Freno simple: máximo 25 búsquedas por minuto y conexión. */
const INTENTOS = new Map<string, number[]>();
const MAX_INTENTOS = 25;
const VENTANA_MS = 60_000;

function demasiadosIntentos(clave: string): boolean {
  const ahora = Date.now();
  const previos = (INTENTOS.get(clave) || []).filter((t) => ahora - t < VENTANA_MS);
  previos.push(ahora);
  INTENTOS.set(clave, previos);
  if (INTENTOS.size > 500) INTENTOS.clear();
  return previos.length > MAX_INTENTOS;
}

/** ¿Tiene la asignación de Acomodador (rol activo)? */
async function esAcomodador(participanteId: string): Promise<boolean> {
  const { data: rolesA, error: errorRoles } = await supabase
    .from("roles")
    .select("id")
    .eq("activo", true)
    .or("slug.eq.acomodador,nombre.ilike.*acomodador*");

  if (errorRoles) throw errorRoles;
  const ids = ((rolesA as { id: string }[]) || []).map((r) => r.id);
  if (!ids.length) return false;

  const { data, error } = await supabase
    .from("participante_roles")
    .select("role_id")
    .eq("participante_id", participanteId)
    .in("role_id", ids);

  if (error) throw error;
  return Boolean(data?.length);
}

/**
 * GET /api/asistencia?buscar=...  -> coincidencias del nombre
 * GET /api/asistencia?persona=... -> ¿es acomodador?
 */
export async function GET(request: NextRequest) {
  const buscar = request.nextUrl.searchParams.get("buscar")?.trim() || "";
  const personaId = request.nextUrl.searchParams.get("persona")?.trim() || "";

  const conexion = request.headers.get("x-forwarded-for") || "local";
  if (demasiadosIntentos(conexion)) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Esperá un minuto e intentá de nuevo." },
      { status: 429 },
    );
  }

  if (personaId) {
    try {
      const persona = await traerPersonaPorId(personaId);
      if (!persona?.nombre_completo) {
        return NextResponse.json(
          { error: "Ese nombre no está en la congregación." },
          { status: 404 },
        );
      }
      if (!(await esAcomodador(personaId))) {
        return NextResponse.json(
          {
            error:
              "Solo los acomodadores pueden registrar la asistencia. Si te corres, pedile a la Secretaría que te asigne el rol Acomodador.",
          },
          { status: 403 },
        );
      }
      return NextResponse.json({ ok: true, nombre: persona.nombre_completo });
    } catch {
      return NextResponse.json(
        { error: "No pudimos verificar el rol. Intentá en un momento." },
        { status: 500 },
      );
    }
  }

  if (buscar) {
    let coincidencias;
    try {
      // al formulario de asistencia entra cualquier acomodador, publicador o no
      coincidencias = await buscarPorNombre(buscar);
    } catch {
      return NextResponse.json(
        { error: "No pudimos buscar el nombre. Intentá en un momento." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, coincidencias });
  }

  return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
}

/** POST /api/asistencia -> el acomodador carga la asistencia de un día */
export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  if (!cuerpo || typeof cuerpo !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const { participante_id, fecha, auditorio, zoom } = cuerpo as Record<string, unknown>;

  if (typeof participante_id !== "string" || !participante_id) {
    return NextResponse.json({ error: "No encontramos tu nombre." }, { status: 400 });
  }

  const validado = validarAsistencia({
    fecha: typeof fecha === "string" ? fecha : "",
    auditorio:
      auditorio === null || auditorio === undefined || auditorio === ""
        ? null
        : Number(auditorio),
    zoom: zoom === null || zoom === undefined || zoom === "" ? null : Number(zoom),
  });
  if ("errores" in validado) {
    return NextResponse.json(
      { error: "Revisá los datos del formulario.", errores: validado.errores },
      { status: 400 },
    );
  }

  let persona;
  try {
    persona = await traerPersonaPorId(participante_id, "id, nombre_completo, activo");
  } catch {
    return NextResponse.json(
      { error: "No pudimos verificar tu nombre. Intentá en un momento." },
      { status: 500 },
    );
  }

  if (!persona || !persona.activo) {
    return NextResponse.json(
      { error: "Ese nombre no está en la congregación." },
      { status: 404 },
    );
  }

  try {
    if (!(await esAcomodador(participante_id))) {
      return NextResponse.json(
        {
          error:
            "Solo los acomodadores pueden registrar la asistencia. Pedile a la Secretaría que te asigne el rol Acomodador.",
        },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "No pudimos verificar el rol. Intentá en un momento." },
      { status: 500 },
    );
  }

  const { data: mesCerrado } = await supabase
    .from("asistencias_meses")
    .select("mes")
    .eq("mes", mesDeFecha(validado.datos.fecha))
    .maybeSingle();

  if (mesCerrado) {
    return NextResponse.json(
      { error: "Ese mes está cerrado. Comunicate con la Secretaría." },
      { status: 409 },
    );
  }

  const { data: yaCargado, error: errorDuplicado } = await supabase
    .from("asistencias")
    .select("id")
    .eq("registrado_por", participante_id)
    .eq("fecha", validado.datos.fecha)
    .limit(1);

  if (errorDuplicado) {
    return NextResponse.json(
      { error: "No pudimos verificar si ya cargaste ese día." },
      { status: 500 },
    );
  }

  if (yaCargado?.length) {
    return NextResponse.json(
      {
        error: "Ya cargaste la asistencia de ese día. Para corregirla, comunicate con la Secretaría.",
        yaRegistrado: true,
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("asistencias")
    .insert({ ...validado.datos, registrado_por: participante_id })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      {
        error:
          error?.message?.includes("asistencias")
            ? "No se pudo guardar: ¿pegaste supabase/migracion_v4.sql en el SQL Editor?"
            : `No se pudo guardar: ${error?.message || "error desconocido"}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
