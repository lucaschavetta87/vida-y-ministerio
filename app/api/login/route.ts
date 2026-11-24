import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_DURACION_SEG,
  claveCorrecta,
  credencialesCorrectas,
  firmarToken,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  let body: { usuario?: unknown; password?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const usuario = typeof body.usuario === "string" ? body.usuario.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!usuario || !password) {
    return NextResponse.json(
      { error: "Ingresá usuario y contraseña" },
      { status: 400 },
    );
  }

  const expira = Date.now() + SESSION_DURACION_SEG * 1000;
  let token: string;

  if (await credencialesCorrectas(usuario, password)) {
    // la cuenta principal entra a todo
    token = await firmarToken(usuario, null, [], expira);
  } else {
    // los usuarios delegados: se busca por nombre
    const { data, error } = await supabase
      .from("app_usuarios")
      .select("id, nombre, clave_hash, activo, participante_id")
      .ilike("nombre", usuario)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "No pudimos verificar" }, { status: 500 });
    }

    const fila = data as
      | { id: string; nombre: string; clave_hash: string; activo: boolean; participante_id: string | null }
      | null;

    if (
      !fila ||
      !fila.activo ||
      !(await claveCorrecta(password, fila.clave_hash))
    ) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 },
      );
    }

    const { data: permisos } = await supabase
      .from("app_usuarios_permisos")
      .select("permiso")
      .eq("usuario_id", fila.id);

    token = await firmarToken(
      fila.nombre,
      fila.participante_id,
      ((permisos || []) as { permiso: string }[]).map((p) => p.permiso),
      expira,
    );

    supabase
      .from("app_usuarios")
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq("id", fila.id)
      .then(() => {});
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // sin maxAge: es cookie de sesión, al cerrar el navegador se cae
    path: "/",
  });
  return response;
}