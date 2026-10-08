import fs from "node:fs";

const CSV =
  "/home/controlcel/Downloads/Registros-de-personas-__-Personas-de-la-congregación-__-JW-Hub.csv";

function norm(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const NOMBRES_F = new Set(
  (
    "paula janet maria rosa norma elisabeth denise melisa barbara jessica daniela loreta jeanet " +
    "giselle mariana mariel monica claudia rosa alejandra carolina vanesa eliana griselda camila " +
    "agustina mercedes cristina noemi gloria cecilia adriana lara gabriela micaela antonella " +
    "yaquelin soledad isabel julieta beatriz pamela abigail candela debora irma giuliana sandra " +
    "lucia belen carina virginia marlene leandra inocencia evangelina natalia yesica amalia " +
    "rosana tamara yamila ana laura veronica silvana jacqueline estefania yeni miriam ester " +
    "guadalupe fabiana priscila anabella trinidad ermelinda olga nelva josefina ludmila marisol " +
    "johana rocio dora luz marta teresa carmen pilar yolanda silvia mireya zulema gladys rita " +
    "maribel zunilda valeria violeta yamila norma irma"
  ).split(/\s+/),
);

const NOMBRES_M = new Set(
  (
    "emmanuel eduardo nicolas edgar ernesto lucas hector marcelo marcos walter ian isaac matias " +
    "benjamin dario oscar bryan manuel joel german ruben daniel alfredo rodolfo franco alejandro " +
    "adrian sebastian juan jose luis carlos roberto ricardo fernando gabriel emiliano bautista " +
    "gonzalo martin miguel tomas diego mauricio cristian facundo maximiliano ramon " +
    "hernando guillermo fabian ricardo ezequiel"
  ).split(/\s+/),
);

function adivinarGenero(nombre) {
  const palabras = norm(nombre)
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let f = 0;
  let m = 0;
  for (const p of palabras) {
    if (NOMBRES_F.has(p)) f++;
    if (NOMBRES_M.has(p)) m++;
  }
  if (f > m) return "MUJER";
  if (m > f) return "HOMBRE";
  return "MUJER";
}

function clasificar(texto) {
  const t = texto.toUpperCase();
  if (t.includes("ANCIANO")) return "ANCIANO";
  if (t.includes("SIERVO")) return "SIERVO_MINISTERIAL";
  if (t.includes("PRECURSOR")) return "PRECURSOR_REGULAR";
  return null;
}

export function calcularFechaNacimiento(edadDecimal, hoy = new Date()) {
  if (edadDecimal === null || edadDecimal === undefined || Number.isNaN(edadDecimal)) return null;
  let anios = Math.floor(edadDecimal);
  let meses = Math.round((edadDecimal - anios) * 12);
  if (meses >= 12) {
    anios += 1;
    meses -= 12;
  }
  const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  f.setMonth(f.getMonth() - meses);
  f.setFullYear(f.getFullYear() - anios);
  const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(
    f.getDate(),
  ).padStart(2, "0")}`;
  return iso;
}

function limpiarEtiquetas(texto) {
  let t = texto;
  t = t.replace(/\bMiembro del Comit[ée] de Asamblea\b/gi, " ");
  t = t.replace(/\bde asamblea\b/gi, " ");
  t = t.replace(/\bSecretario\b/gi, " ");
  t = t.replace(/\bSiervo ministerial\b/gi, " ");
  t = t.replace(/\bministerial\b/gi, " ");
  t = t.replace(/\bSiervo\b/gi, " ");
  t = t.replace(/\bPrecursora\b/gi, " ");
  t = t.replace(/\bPrecursor\b/gi, " ");
  t = t.replace(/\bAnciano\b/gi, " ");
  return t.replace(/\s+/g, " ").trim();
}

export function parsearCsv(ruta = CSV) {
  const lineas = fs.readFileSync(ruta, "utf8").split(/\r?\n/);
  const inicio = lineas.findIndex((l) => l.startsWith("Aballay,"));
  const cuerpo = lineas.slice(inicio);

  const bloques = [];
  let actual = [];
  for (const l of cuerpo) {
    actual.push(l);
    if (l.startsWith("Años bautizado")) {
      bloques.push(actual);
      actual = [];
    }
  }

  const personas = [];
  for (const bloque of bloques) {
    const llenas = bloque.filter((l) => l.trim() !== "");
    if (!llenas.length) continue;

    const lineaEdad = llenas.find((l) => l.startsWith("Edad")) || "";
    const lineaBaut = llenas.find((l) => l.startsWith("Años")) || "";
    const cabecera = llenas
      .filter((l) => !l.startsWith("Edad") && !l.startsWith("Años"))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const mEdad = lineaEdad.match(/Edad\s*([\d,.]+)/);
    const edadDecimal = mEdad ? parseFloat(mEdad[1].replace(",", ".")) : null;
    const mBaut = lineaBaut.match(/Años\s*bautizado\s*([\d,.]+)/);
    const aniosBautismo = mBaut ? parseFloat(mBaut[1].replace(",", ".")) : null;

    const esSecretario = /\bSecretario\b/i.test(cabecera);
    const esMiembro = /Miembro del Comit[ée] de Asamblea/i.test(cabecera);

    const sobra = lineaEdad.replace(/^Edad\s*[\d,.]+\s*/, "").trim();
    const sobra2 = lineaBaut.replace(/^Años\s*bautizado\s*[\d,.]+\s*/, "").trim();
    const colaDerecha = [sobra, sobra2].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const cola = limpiarEtiquetas(colaDerecha);

    let conyuge = null;
    let propio = cabecera;

    const mCon = propio.match(/\s+C[óo]nyuge\s+(.+)$/);
    if (mCon && mCon[1].trim()) {
      const resto = mCon[1];
      const corte = resto.search(/\b(Precursor|Anciano|Siervo|Secretario|Miembro del Comit)/i);
      if (corte > 0) {
        conyuge = limpiarEtiquetas(resto.slice(0, corte));
        propio = propio.slice(0, mCon.index) + " " + resto.slice(corte);
      } else {
        conyuge = limpiarEtiquetas(resto);
        propio = propio.slice(0, mCon.index);
      }
    } else if (/\s+C[óo]nyuge\s*$/.test(propio)) {
      propio = propio.replace(/\s+C[óo]nyuge\s*$/, " ");
    }

    let nombre = limpiarEtiquetas(propio);
    if (!nombre) continue;

    if (cola) {
      if (nombre.endsWith(",")) {
        nombre = limpiarEtiquetas(nombre + " " + cola);
      } else if (!conyuge) {
        conyuge = limpiarEtiquetas(cola) || null;
      }
    }

    personas.push({
      nombre_completo: nombre,
      genero: adivinarGenero(nombre),
      clasificacion: clasificar(cabecera),
      edad: edadDecimal === null ? null : Math.floor(edadDecimal),
      fecha_nacimiento: calcularFechaNacimiento(edadDecimal),
      anios_bautizado: aniosBautismo,
      es_secretario: esSecretario,
      miembro_comite_asamblea: esMiembro,
      conyuge_nombre: conyuge,
      activo: true,
    });
  }

  return personas;
}

function clave(nombre) {
  return norm(nombre)
    .replace(/[^a-zñ ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bde\b/g, " ")
    .trim();
}

export function buscarConyuges(personas) {
  const porClave = new Map();
  for (const p of personas) {
    const k = clave(p.nombre_completo);
    if (!porClave.has(k)) porClave.set(k, p);
  }
  return personas.map((p) => ({
    ...p,
    conyuge_clave: p.conyuge_nombre ? (porClave.get(clave(p.conyuge_nombre)) || null) : null,
  }));
}

export function cargarEnv() {
  const env = fs.readFileSync(
    new URL("../.env.local", import.meta.url),
    "utf8",
  );
  const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1];
  return { url: get("NEXT_PUBLIC_SUPABASE_URL"), key: get("NEXT_PUBLIC_SUPABASE_ANON_KEY") };
}

export { clave, norm, limpiarEtiquetas };

const esMain = process.argv[1] && process.argv[1].endsWith("importar-personas.mjs");
if (esMain) {
  const personas = buscarConyuges(parsearCsv());
  console.log("total parseado:", personas.length);
  personas.forEach((p, i) => {
    console.log(
      [
        String(i + 1).padStart(2, "0"),
        p.nombre_completo,
        p.genero,
        p.clasificacion ?? "-",
        `edad=${p.edad}`,
        `fn=${p.fecha_nacimiento}`,
        `baut=${p.anios_bautizado}`,
        `cony=${p.conyuge_nombre ?? "-"}`,
        p.conyuge_clave ? "" : p.conyuge_nombre ? "  <== CONYUGE NO ENCONTRADO" : "",
        p.es_secretario ? "SECRETARIO" : "",
        p.miembro_comite_asamblea ? "MIEMBRO_COMITE" : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );
  });
  const noEncontrados = personas.filter((p) => p.conyuge_nombre && !p.conyuge_clave);
  console.log("\nconyuges no encontrados:", noEncontrados.map((p) => `${p.nombre_completo} -> ${p.conyuge_nombre}`));
}
