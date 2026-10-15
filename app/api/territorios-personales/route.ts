import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { buscarPorNombre } from "@/lib/informes-servidor";
import { hoyClave } from "@/lib/territorios";

/** Freno simple: máximo 25 pedidos por minuto y conexión. */
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
  return req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "desconocida";
}

const CON_ERROR =
  "Falta la tabla de territorios personales. Pegá supabase/migracion_v13.sql en Supabase.";

/** Solo puede cargar quien tenga un territorio personal asignado. */
async function datosDe(publicadorId: string) {
  const { data: participante, error } = await supabase
    .from("participantes")
    .select("id, nombre_completo, activo, es_publicador")
    .eq("id", publicadorId)
    .maybeSingle();
  if (error) throw error;
  if (!participante)
    return { problema: "No encontramos a esa persona en la congregación." } as const;

  const { data: asignacion, error: errorAsignacion } = await supabase
    .from("territorios_personales")
    .select("territorio_numero")
    .eq("publicador_id", publicadorId)
    .maybeSingle();
  if (errorAsignacion) throw errorAsignacion;
  if (!asignacion)
    return {
      problema: "Todavía no tenés un territorio personal asignado. Hablá con el cuerpo pastoral.",
    } as const;

  const { data: territorio } = await supabase
    .from("territorios")
    .select("numero, letras")
    .eq("numero", asignacion.territorio_numero)
    .maybeSingle();

  return { participante, asignacion, territorio } as const;
}

/* ------------------------------------------------------------------ */
/*  GET ?buscar=nombre  → solo los que YA tienen territorio asignado     */
/*  GET ?persona=id     → su territorio y sus reportes anteriores        */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  if (demasiadosIntentos(clave(req)))
    return NextResponse.json(
      { error: "Demasiadas consultas. Esperá un minuto e intentá otra vez." },
      { status: 429 },
    );

  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get("buscar");
  const persona = searchParams.get("persona");

  try {
    if (buscar !== null) {
      // los que tienen territorio personal asignado
      const { data: asignados, error } = await supabase
        .from("territorios_personales")
        .select("publicador_id");
      if (error) return NextResponse.json({ error: CON_ERROR }, { status: 500 });

      const ids = new Set(
        ((asignados || []) as { publicador_id: string }[]).map((a) => a.publicador_id),
      );
      const coincidencias = (
        await buscarPorNombre(buscar.trim(), { soloPublicadores: true })
      ).filter((c) => ids.has(c.id));
      return NextResponse.json({ coincidencias });
    }

    if (persona) {
      const datos = await datosDe(persona);
      if ("problema" in datos)
        return NextResponse.json({ error: datos.problema }, { status: 403 });

      const { data: reportes } = await supabase
        .from("territorios_personales_reportes")
        .select("*")
        .eq("publicador_id", persona)
        .order("fecha", { ascending: false })
        .limit(10);

      return NextResponse.json({
        ok: true,
        nombre: datos.participante.nombre_completo,
        territorio: datos.territorio || null,
        reportes: reportes || [],
      });
    }

    return NextResponse.json({ error: "Falta qué buscar." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST → carga el reporte del territorio personal                      */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(clave(req)))
    return NextResponse.json(
      { error: "Demasiados envíos. Esperá un minuto e intentá otra vez." },
      { status: 429 },
    );

  let cuerpo: {
    publicador_id?: string;
    reporte_id?: string;
    fecha?: string;
    estado?: string;
    manzanas?: string[];
    observaciones?: string;
  };

  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el formulario." }, { status: 400 });
  }

  const publicadorId = cuerpo.publicador_id || "";
  if (!publicadorId)
    return NextResponse.json({ error: "Elegí tu nombre." }, { status: 400 });

  const fecha = (cuerpo.fecha || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyClave())
    return NextResponse.json(
      { error: "Elegí un día válido que no sea futuro." },
      { status: 400 },
    );

  const estado = cuerpo.estado === "INCOMPLETO" ? "INCOMPLETO" : "COMPLETADO";
  const manzanas = estado === "INCOMPLETO" ? (cuerpo.manzanas || []).filter(Boolean) : [];

  if (estado === "INCOMPLETO" && manzanas.length === 0)
    return NextResponse.json(
      { error: "Si quedó incompleto, marcá al menos una manzana." },
      { status: 400 },
    );

  try {
    const datos = await datosDe(publicadorId);
    if ("problema" in datos)
      return NextResponse.json({ error: datos.problema }, { status: 403 });

    const ahora = new Date().toISOString();
    const campos = {
      fecha,
      estado,
      manzanas,
      observaciones: cuerpo.observaciones?.trim() || null,
      actualizado_en: ahora,
    };

    // si viene un reporte, se corrige ese mismo
    if (cuerpo.reporte_id) {
      const { data: previo } = await supabase
        .from("territorios_personales_reportes")
        .select("id, publicador_id")
        .eq("id", cuerpo.reporte_id)
        .maybeSingle();
      if (!previo || previo.publicador_id !== publicadorId)
        return NextResponse.json(
          { error: "Ese reporte no es tuyo." },
          { status: 403 },
        );

      const { error } = await supabase
        .from("territorios_personales_reportes")
        .update(campos)
        .eq("id", cuerpo.reporte_id);
      if (error) throw error;

      return NextResponse.json({ ok: true, estado, editado: true });
    }

    const { error } = await supabase
      .from("territorios_personales_reportes")
      .insert({
        publicador_id: publicadorId,
        territorio_numero: datos.asignacion.territorio_numero,
        ...campos,
        creado_en: ahora,
      });
    if (error) throw error;

    return NextResponse.json({ ok: true, estado, editado: false });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}