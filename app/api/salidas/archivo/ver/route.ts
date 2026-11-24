import { NextResponse, type NextRequest } from "next/server";
import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = process.env.SALIDAS_DIR || "/data/salidas";

export async function GET(request: NextRequest) {
  const nombre = request.nextUrl.searchParams.get("nombre");
  if (!nombre) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  const ruta = join(DIR, nombre);
  if (!existsSync(ruta)) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const stream = createReadStream(ruta);
  return new NextResponse(stream as any, {
    headers: { "Content-Type": "application/octet-stream" },
  });
}