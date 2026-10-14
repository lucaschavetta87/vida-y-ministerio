import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { buscarPorNombre, traerPersonaPorId } from "@/lib/informes-servidor";
import { esConductorSalidas, hoyClave, mesDe } from "@/lib/territorios";

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

function clave(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "desconocida"
  );
}

const CON_ERROR_TABLA =
  "Falta la tabla de territorios. Pegá supabase/migracion_v10.sql en Supabase.";

/** Solo los hombres aprobados como conductores de salidas pueden cargar. */
async function verificarConductor(participanteId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("participantes")
    .select("id, genero, activo, conductor_salidas_aprobado")
    .eq("id", participanteId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return "No encontramos a esa persona en la congregación.";
  if (!esConductorSalidas(data as Parameters<typeof esConductorSalidas>[0]))
    return "Todavía no estás aprobado como conductor de salidas. Hablá con el cuerpo pastoral.";
  return null;
}

/* ------------------------------------------------------------------ */
/*  GET ?buscar=nombre   → coincidencias (solo conductores aprobados)     */
/*  GET ?persona=id      → verifica que pueda cargar                     */
/*  GET ?disponibles=mes → territorios disponibles en ese mes            */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get("buscar");
  const persona = searchParams.get("persona");
  const mes = searchParams.get("disponibles");

  if (buscar !== null) {
    if (demasiadosIntentos(clave(req)))
      return NextResponse.json(
        { error: "Demasiadas búsquedas. Esperá un minuto e intentá otra vez." },
        { status: 429 },
      );
    try {
      const coincidencias = (await buscarPorNombre(buscar.trim(), {
        soloPublicadores: false,
      })).filter((c) => c.conductor_salidas_aprobado === true);
      return NextResponse.json({ coincidencias });
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 500 },
      );
    }
  }

  if (persona) {
    try {
      const problema = await verificarConductor(persona);
      if (problema) return NextResponse.json({ error: problema });
      const nombre = await traerPersonaPorId(persona);
      return NextResponse.json({ ok: true, nombre: nombre?.nombre_completo || "" });
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 500 },
      );
    }
  }

  if (mes) {
    const { data: territorios, error } = await supabase
      .from("territorios")
      .select("*")
      .eq("activo", true)
      .order("numero");
    if (error) {
      return NextResponse.json({ error: CON_ERROR_TABLA }, { status: 500 });
    }
    const lista = (territorios || []) as {
      numero: number;
      zona: string;
      letras: string[];
    }[];

    // los que ya se completaron este mes ya no están disponibles
    const { data: salidas } = await supabase
      .from("territorios_salidas")
      .select("id")
      .gte("fecha", `${mes}-01`)
      .lte("fecha", `${mes}-31`);
    const ids = ((salidas || []) as { id: string }[]).map((s) => s.id);

    let hechos = new Set<number>();
    if (ids.length) {
      const { data: detalles } = await supabase
        .from("territorios_salidas_detalle")
        .select("territorio_numero")
        .in("salida_id", ids)
        .eq("estado", "COMPLETADO");
      hechos = new Set(
        ((detalles || []) as { territorio_numero: number }[]).map(
          (d) => d.territorio_numero,
        ),
      );
    }

    return NextResponse.json({
      mes,
      territorios: lista.filter((t) => !hechos.has(t.numero)),
    });
  }

  return NextResponse.json({ error: "Falta qué buscar." }, { status: 400 });
}

/* ------------------------------------------------------------------ */
/*  POST → guarda la salida (fecha + territorios completos y pendientes) */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(clave(req)))
    return NextResponse.json(
      { error: "Demasiados envíos. Esperá un minuto e intentá otra vez." },
      { status: 429 },
    );

  let cuerpo: {
    participante_id?: string;
    fecha?: string;
    notas?: string;
    detalle?: { territorio: number; letras?: string[]; estado?: string }[];
  };

  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el formulario." }, { status: 400 });
  }

  const participanteId = cuerpo.participante_id;
  if (!participanteId)
    return NextResponse.json({ error: "Falta el conductor." }, { status: 400 });

  const fecha = (cuerpo.fecha || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyClave())
    return NextResponse.json(
      { error: "Elegí un día válido que no sea futuro." },
      { status: 400 },
    );

  const detalle = (cuerpo.detalle || []).filter(
    (d) =>
      Number.isInteger(d.territorio) &&
      d.territorio >= 1 &&
      d.territorio <= 69 &&
      (d.estado === "COMPLETADO" || d.estado === "PENDIENTE"),
  );

  if (!detalle.length)
    return NextResponse.json(
      { error: "Marcá al menos un territorio." },
      { status: 400 },
    );

  try {
    const problema = await verificarConductor(participanteId);
    if (problema) return NextResponse.json({ error: problema }, { status: 403 });

    const ahora = new Date().toISOString();
    const { data: salida, error: errorSalida } = await supabase
      .from("territorios_salidas")
      .insert({
        fecha,
        conductor_id: participanteId,
        notas: cuerpo.notas?.trim() || null,
        creado_en: ahora,
        actualizado_en: ahora,
      })
      .select("id")
      .single();

    if (errorSalida) throw errorSalida;

    const filas = detalle.map((d) => ({
      salida_id: salida.id,
      territorio_numero: d.territorio,
      letras: d.letras || [],
      estado: d.estado as "COMPLETADO" | "PENDIENTE",
    }));

    const { error: errorDetalle } = await supabase
      .from("territorios_salidas_detalle")
      .insert(filas);
    if (errorDetalle) throw errorDetalle;

    return NextResponse.json({
      ok: true,
      id: salida.id,
      mes: mesDe(fecha),
      completos: detalle.filter((d) => d.estado === "COMPLETADO").length,
      pendientes: detalle.filter((d) => d.estado === "PENDIENTE").length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE ?id=... → borra una salida y su detalle                       */
/* ------------------------------------------------------------------ */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta la salida." }, { status: 400 });

  const { error } = await supabase.from("territorios_salidas").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}