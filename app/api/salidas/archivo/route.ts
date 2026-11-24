import { NextResponse, type NextRequest } from "next/server";
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { supabase } from "@/lib/supabase";

const DIR = process.env.SALIDAS_DIR || "/data/salidas";

function asegurarDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

export async function GET(request: NextRequest) {
  const clave = request.nextUrl.searchParams.get("clave");
  if (!clave) return NextResponse.json({ error: "Falta la clave." }, { status: 400 });
  const { data, error } = await supabase
    .from("salidas_archivos")
    .select("archivo_url, registrado_por, actualizado_en")
    .eq("clave", clave)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, archivo: data });
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const archivo = form.get("archivo");
    const clave = String(form.get("clave") || "").trim();
    const participanteId = String(form.get("participante_id") || "").trim() || null;
    if (!(archivo instanceof File) || !clave)
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });

    asegurarDir();
    const { data: anterior } = await supabase
      .from("salidas_archivos")
      .select("archivo_url")
      .eq("clave", clave)
      .maybeSingle();

    if (anterior?.archivo_url) {
      const rutaAnterior = join(DIR, anterior.archivo_url.split("/").pop() || "");
      try {
        if (existsSync(rutaAnterior)) unlinkSync(rutaAnterior);
      } catch {}
    }

    const nombre = `${clave}-${archivo.name}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = join(DIR, nombre);
    const buffer = Buffer.from(await archivo.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(ruta);
      stream.on("finish", () => resolve());
      stream.on("error", reject);
      stream.end(buffer);
    });

    const url = `/api/salidas/archivo/ver?nombre=${encodeURIComponent(nombre)}`;
    const { error } = await supabase.from("salidas_archivos").upsert({
      clave,
      archivo_url: url,
      registrado_por: participanteId,
      actualizado_en: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al subir el archivo." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const clave = request.nextUrl.searchParams.get("clave");
  if (!clave) return NextResponse.json({ error: "Falta la clave." }, { status: 400 });
  const { data } = await supabase
    .from("salidas_archivos")
    .select("archivo_url")
    .eq("clave", clave)
    .maybeSingle();
  if (data?.archivo_url) {
    const ruta = join(DIR, data.archivo_url.split("/").pop() || "");
    try {
      if (existsSync(ruta)) unlinkSync(ruta);
    } catch {}
  }
  await supabase.from("salidas_archivos").delete().eq("clave", clave);
  return NextResponse.json({ ok: true });
}