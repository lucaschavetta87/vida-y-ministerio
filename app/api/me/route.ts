import { NextResponse } from "next/server";
import { SESSION_COOKIE, leerToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/vm_sesion=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  const sesion = await leerToken(token);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let participante = null;
  if (sesion.participanteId) {
    const { data } = await supabase
      .from("participantes")
      .select("*")
      .eq("id", sesion.participanteId)
      .maybeSingle();
    participante = data;
  }

  return NextResponse.json({
    nombre: sesion.nombre,
    participanteId: sesion.participanteId,
    permisos: sesion.permisos,
    admin: sesion.admin,
    participante,
  });
}