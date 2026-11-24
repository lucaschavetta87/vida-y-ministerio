import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, leerToken, puedeEntrar } from "./lib/auth";

export default async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sesion = await leerToken(token);

  if (!sesion) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // si no tiene permiso para esa parte, vuelve al inicio
  if (!puedeEntrar(sesion, request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?sin=permiso";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/participantes/:path*",
    "/reunion/:path*",
    "/asignaciones-mecanicas/:path*",
    "/servicio/:path*",
    "/secretaria/:path*",
    "/mi-perfil/:path*",
    "/mi-espacio/:path*",
    "/usuarios/:path*",
  ],
};