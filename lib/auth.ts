export const SESSION_COOKIE = "vm_sesion";
export const SESSION_DURACION_SEG = 60 * 60 * 24 * 7; // 7 días

/** Las partes del sistema a las que se puede dar acceso. */
export const PERMISOS = [
  { codigo: "participantes", texto: "Personas de la congregación" },
  { codigo: "reunion", texto: "Vida y Ministerio" },
  { codigo: "asignaciones", texto: "Asignaciones Mecánicas" },
  { codigo: "servicio", texto: "Servicio" },
  { codigo: "secretaria", texto: "Secretaría" },
  { codigo: "grupos", texto: "Grupos de Predicación" },
] as const;

export type Permiso = (typeof PERMISOS)[number]["codigo"];

/** Qué permiso hace falta para entrar a cada parte. */
export const PERMISO_DE_RUTA: Record<string, Permiso> = {
  "/participantes": "participantes",
  "/reunion": "reunion",
  "/asignaciones-mecanicas": "asignaciones",
  "/servicio": "servicio",
  "/secretaria": "secretaria",
  "/grupos": "grupos",
};

/** Los que pueden administrar usuarios (solo la cuenta principal). */
export const PERMISOS_ADMIN = ["usuarios"] as const;

export function usuarioEsperado(): string {
  return process.env.APP_USER || "este";
}

export function passwordEsperado(): string {
  return process.env.APP_PASSWORD || "1914";
}

function secreto(): string {
  return process.env.APP_SECRET || passwordEsperado();
}

function aHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function aBase64(datos: string | ArrayBuffer | Uint8Array): string {
  const bytes =
    typeof datos === "string"
      ? new TextEncoder().encode(datos)
      : datos instanceof Uint8Array
        ? datos
        : new Uint8Array(datos);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

async function claveHMAC(texto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(texto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/* ============================================================
   Claves (PBKDF2-SHA256 con salto aleatorio)
   ============================================================ */

const ITERACIONES = 150_000;
const LARGO_CLAVE = 32;

async function derivada(clave: string, salto: string): Promise<string> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clave),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salto),
      iterations: ITERACIONES,
      hash: "SHA-256",
    },
    base,
    LARGO_CLAVE * 8,
  );
  return aHex(bits);
}

/** Devuelve "salto:hash" para guardar en la base. */
export async function hashearClave(
  clave: string,
  salto?: string,
): Promise<string> {
  const s = salto || aHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return `${s}:${await derivada(clave, s)}`;
}

/** Comprueba una clave contra lo guardado ("salto:hash"). */
export async function claveCorrecta(
  clave: string,
  guardado: string,
): Promise<boolean> {
  const [salto, esperado] = (guardado || "").split(":");
  if (!salto || !esperado) return false;
  const real = await derivada(clave, salto);
  let diff = real.length ^ esperado.length;
  for (let i = 0; i < Math.min(real.length, esperado.length); i += 1) {
    diff |= real.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diff === 0;
}

/* ============================================================
   Token de sesión
   Formato: nombre.expira.permisos.firma
   Los permisos van dentro y firmados, así el proxy no necesita
   consultar la base en cadarequest.
   ============================================================ */

export interface Sesion {
  nombre: string;
  participanteId: string | null;
  permisos: string[];
  /** true = la cuenta principal (entra a todo) */
  admin: boolean;
  expira: number;
}

export async function firmarToken(
  nombre: string,
  participanteId: string | null,
  permisos: string[],
  expira: number,
): Promise<string> {
  const cuerpo = `${nombre}|${participanteId || ""}|${expira}|${permisos.join(",")}`;
  const firma = await crypto.subtle.sign(
    "HMAC",
    await claveHMAC(secreto()),
    new TextEncoder().encode(cuerpo),
  );
  return [nombre, participanteId || "", String(expira), aBase64(permisos.join(",")), aHex(firma)].join(".");
}

/** Lee el token y lo verifica. Devuelve null si no corresponde. */
export async function leerToken(
  token: string | undefined | null,
): Promise<Sesion | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 5) return null;
  const [nombre, participanteId, expira, permisosB64, firma] = partes;
  const cuerpo = `${nombre}|${participanteId}|${expira}|${atob(permisosB64)}`;
  const esperada = await crypto.subtle.sign(
    "HMAC",
    await claveHMAC(secreto()),
    new TextEncoder().encode(cuerpo),
  );
  if (aHex(esperada) !== firma) return null;
  if (Number(expira) < Date.now()) return null;

  const permisos = atob(permisosB64) ? atob(permisosB64).split(",").filter(Boolean) : [];
  const admin = nombre === usuarioEsperado();
  return {
    nombre,
    participanteId: participanteId || null,
    permisos,
    admin,
    expira: Number(expira),
  };
}

export async function tokenValido(token: string | undefined | null): Promise<boolean> {
  return (await leerToken(token)) !== null;
}

/** ¿La sesión puede entrar a esa parte? */
export function puedeEntrar(
  sesion: Sesion | null,
  ruta: string,
): boolean {
  if (!sesion) return false;
  const base = "/" + ruta.split("/").filter(Boolean)[0];
  if (sesion.admin) return true;
  if (ruta.startsWith("/usuarios")) return false; // solo la cuenta principal
  // usuarios personales: respetar permisos asignados
  if (sesion.participanteId) {
    const permiso = PERMISO_DE_RUTA[base];
    // rutas sin permiso definido (como /mi-espacio) permiten entrada
    if (!permiso) return true;
    return sesion.permisos.includes(permiso);
  }
  const permiso = PERMISO_DE_RUTA[base];
  if (!permiso) return true;
  return sesion.permisos.includes(permiso);
}

/** La cuenta principal: entra con usuario y clave del entorno. */
export async function credencialesCorrectas(
  usuario: string,
  password: string,
): Promise<boolean> {
  const u = usuarioEsperado();
  const p = passwordEsperado();
  if (usuario.length !== u.length || password.length !== p.length) return false;
  let diff = 0;
  for (let i = 0; i < u.length; i += 1) diff |= u.charCodeAt(i) ^ usuario.charCodeAt(i);
  for (let i = 0; i < p.length; i += 1)
    diff |= p.charCodeAt(i) ^ password.charCodeAt(i);
  return diff === 0;
}