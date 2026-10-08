import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { buscarPorNombre, mesDelFormulario, traerPersonaPorId } from "@/lib/informes-servidor";
import { esClaveMes, etiquetaMes, validarInforme } from "@/lib/informes";

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

/**
 * GET /api/informes?buscar=...  -> solo las coincidencias de ese nombre
 * GET /api/informes?mes=YYYY-MM  -> si el mes está abierto
 */
export async function GET(request: NextRequest) {
  const buscar = request.nextUrl.searchParams.get("buscar")?.trim() || "";
  const mesPedido = request.nextUrl.searchParams.get("mes") || "";

  if (buscar) {
    const conexion = request.headers.get("x-forwarded-for") || "local";
    if (demasiadosIntentos(conexion)) {
      return NextResponse.json(
        { error: "Demasiadas consultas. Esperá un minuto e intentá de nuevo." },
        { status: 429 },
      );
    }

    let coincidencias;
    try {
      // solo los tildados como "Es publicador" llenan el informe
      coincidencias = await buscarPorNombre(buscar, { soloPublicadores: true });
    } catch {
      return NextResponse.json(
        { error: "No pudimos buscar el nombre. Intentá en un momento." },
        { status: 500 },
      );
    }

    const mes = mesDelFormulario();
    return NextResponse.json({ ok: true, mes, etiqueta: etiquetaMes(mes), coincidencias });
  }

  const mes = mesPedido || mesDelFormulario();
  if (!esClaveMes(mes)) {
    return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  }

  const abierto = mes === mesDelFormulario();
  return NextResponse.json({ abierto, mes, etiqueta: etiquetaMes(mes) });
}

/** POST /api/informes -> el participante manda su informe */
export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  if (!cuerpo || typeof cuerpo !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const { participante_id, tipo, horas, horas_meta, participo, estudios_biblicos, observaciones } =
    cuerpo as Record<string, unknown>;

  if (typeof participante_id !== "string" || !participante_id) {
    return NextResponse.json({ error: "No encontramos tu nombre." }, { status: 400 });
  }

  const validado = validarInforme({
    tipo,
    horas,
    horas_meta,
    participo,
    estudios_biblicos,
    observaciones,
  });
  if ("errores" in validado) {
    return NextResponse.json(
      { error: "Revisá los datos del formulario.", errores: validado.errores },
      { status: 400 },
    );
  }

  const persona = await traerPersonaPorId(participante_id, "id, nombre_completo, activo");

  if (!persona || !persona.activo) {
    return NextResponse.json(
      { error: "Ese nombre no está en la congregación." },
      { status: 404 },
    );
  }

  if (persona.es_publicador === false) {
    return NextResponse.json(
      { error: "Esa persona no está marcada como publicador: no informa. Comunicate con la Secretaría." },
      { status: 403 },
    );
  }

  // el servidor manda: el mes siempre es el anterior, no lo elige el cliente
  const mes = mesDelFormulario();
  const etiqueta = etiquetaMes(mes);

  const { data: yaEnviado } = await supabase
    .from("informes")
    .select("id")
    .eq("participante_id", participante_id)
    .eq("mes", mes)
    .maybeSingle();

  if (yaEnviado) {
    return NextResponse.json(
      {
        error: `Ya mandaste tu informe. Si necesitas modificarlo, hablá con tu superintendente de grupo o el secretario.`,
        yaEnviado: true,
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("informes")
    .insert({ ...validado.datos, participante_id, mes, origen: "formulario" })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const duplicado = error?.code === "23505";
    return NextResponse.json(
      {
        error: duplicado
          ? `Ya mandaste tu informe. Si necesitas modificarlo, hablá con tu superintendente de grupo o el secretario.`
          : "No pudimos guardar tu informe. Intentá otra vez.",
        yaEnviado: duplicado,
      },
      { status: duplicado ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, mes, etiqueta });
}
