import { NextResponse } from "next/server";
import { SESSION_COOKIE, hashearClave, leerToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function ultimos4(tel: string | null | undefined) {
  const digitos = (tel || "").replace(/\D/g, "");
  return digitos.length >= 4 ? digitos.slice(-4) : "0000";
}

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/vm_sesion=([^;]+)/);
  const sesion = await leerToken(match ? decodeURIComponent(match[1]) : null);
  if (!sesion?.admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const [{ data: participantes }, { data: usuarios }] = await Promise.all([
    supabase.from("participantes").select("id, nombre_completo, telefono, activo"),
    supabase.from("app_usuarios").select("nombre, participante_id"),
  ]);

  const existentes = new Set((usuarios || []).map((u: any) => u.nombre.toLowerCase()));
  const conParticipante = new Set((usuarios || []).map((u: any) => u.participante_id).filter(Boolean));
  const generados: { nombre: string; clave: string }[] = [];

  for (const p of participantes || []) {
    if (!p.activo) continue;
    if (conParticipante.has(p.id)) continue;
    let base = normalizar(p.nombre_completo);
    if (!base) continue;
    let nombre = base;
    let i = 2;
    while (existentes.has(nombre)) {
      nombre = `${base}${i}`;
      i += 1;
    }
    const clave = ultimos4(p.telefono);
    const hash = await hashearClave(clave);
    const { error } = await supabase.from("app_usuarios").insert({
      nombre,
      participante_id: p.id,
      clave_hash: hash,
      activo: true,
    });
    if (error) continue;
    existentes.add(nombre);
    conParticipante.add(p.id);
    generados.push({ nombre, clave });
  }

  return NextResponse.json({ ok: true, generados });
}