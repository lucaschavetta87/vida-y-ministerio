/* ============================================================
   Arma las páginas (texto con posición + imágenes) de la guía
   en PDF usando pdfjs-dist, y después llama al lector puro.

   El pdfjs se importa dinámicamente recién cuando el usuario
   elige el archivo, así no pesa en la página inicial.
   ============================================================ */

import {
  anioDelPdf,
  armarSemanas,
  limpiar,
  recortarImagen,
  type ImagenPdf,
  type LineaPdf,
  type PaginaPdf,
  type Renderizable,
  type SemanaMwb,
  type Viewport,
} from "./pdf";

/* ---------------------------------------------- */
/*  interfaz mínima del pdfjs que usamos           */
/* ---------------------------------------------- */

interface ItemTexto {
  str: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
}

interface PaginaPdfjs extends Renderizable {
  getViewport(p: { scale: number }): Viewport;
  getTextContent(): Promise<{ items: ItemTexto[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  commonObjs?: { get(id: string): { name?: string; loadedName?: string } | null };
  cleanup?(): void;
}

interface DocPdfjs {
  numPages: number;
  getPage(n: number): Promise<PaginaPdfjs>;
  destroy(): Promise<void>;
}

export interface PdfJsMinimo {
  getDocument(src: Record<string, unknown>): { promise: Promise<DocPdfjs> };
  Util: {
    transform(m1: number[], m2: number[]): number[];
    applyTransform(p: number[], m: number[]): number[];
  };
  OPS: Record<string, number>;
}

const TOLERANCIA_LINEA = 2.6;
/** más que esto (en relación al alto de la letra) es un espacio de verdad */
const ESPACIO = 0.19;
/** el acento va hasta 12 pt por encima de la letra que acentúa */
const ALCANCE_ACENTO = 12;
const TOLERANCIA_ACENTO = 6;

type Acento = "agudo" | "grave" | "diéresis" | "tilde" | "circunflejo" | "macron";

const ACENTOS: Record<string, Acento> = {
  "\u00b4": "agudo",
  "\u0060": "grave",
  "\u00a8": "diéresis",
  "\u02dc": "tilde",
  "\u02c6": "circunflejo",
  "\u02d8": "macron",
  "'": "agudo",
};

const VOCALES: Record<string, Partial<Record<Acento, string>>> = {
  a: { agudo: "á", grave: "à", diéresis: "ä", tilde: "ã", circunflejo: "â", macron: "ā" },
  e: { agudo: "é", grave: "è", diéresis: "ë", circunflejo: "ê", macron: "ē" },
  i: { agudo: "í", grave: "ì", diéresis: "ï", circunflejo: "î", macron: "ī" },
  o: { agudo: "ó", grave: "ò", diéresis: "ö", tilde: "õ", circunflejo: "ô", macron: "ō" },
  u: { agudo: "ú", grave: "ù", diéresis: "ü", circunflejo: "û", macron: "ū" },
  n: { agudo: "ń", grave: "ǹ", tilde: "ñ" },
  y: { agudo: "ý", grave: "ỳ", circunflejo: "ŷ" },
  c: { agudo: "ć", circunflejo: "ĉ" },
};

const LETRAS_SIN_PUNTO: Record<string, string> = { "\u0131": "i" };

function acentuar(letra: string, acento: Acento): string {
  const base = LETRAS_SIN_PUNTO[letra] || letra;
  const minuscula = base.toLowerCase();
  const tabla = VOCALES[minuscula];
  if (!tabla) return base;
  const cambiada = tabla[acento];
  if (!cambiada) return base;
  return base === minuscula ? cambiada : cambiada.toUpperCase();
}

interface Caracter {
  ch: string;
  x0: number;
  x1: number;
  xc: number;
  alto: number;
  y: number;
  acento: Acento | null;
  negrita: boolean;
}

interface LineaInterna extends LineaPdf {
  chars: Caracter[];
}

const esNegrita = (chars: Caracter[]) => {
  if (chars.length === 0) return false;
  const conNegrita = chars.filter((c) => c.negrita).length;
  return conNegrita / chars.length >= 0.6;
};

const RE_NEGRITA = /Bold|DemiBold|Medium|Black/i;

function esFuenteNegrita(nombre: string | undefined): boolean {
  if (!nombre) return false;
  return RE_NEGRITA.test(nombre);
}

function extraerLineas(
  items: ItemTexto[],
  pdfjs: PdfJsMinimo,
  transform: number[],
  anchoPagina: number,
  fuentes: Record<string, string>,
): { lineas: LineaInterna[] } {
  const caracteres: Caracter[] = [];
  const acentos: { x: number; y: number; tipo: Acento }[] = [];

  for (const item of items) {
    if (!item.str || item.str.trim() === "") continue;
    // el pdfjs deja el origen arriba a la izquierda y da vuelta la Y
    const m = pdfjs.Util.applyTransform(
      [item.transform[4], item.transform[5]],
      transform,
    );
    const x = m[0];
    const y = m[1];
    const ancho = Math.abs(item.width || 0);
    const altoGlifo = Math.abs(item.height || 8);

    const soloAcento = ACENTOS[item.str];
    if (soloAcento) {
      acentos.push({ x, y, tipo: soloAcento });
      continue;
    }
    if (!/[^\s]/.test(item.str)) continue;
    if (/[\u0000-\u0008\u000b-\u001f\ufffc]/.test(item.str)) {
      // iconos (♪, ▪, líneas de puntos): se descartan
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9¿¡]/.test(item.str)) continue;
    }

    const largo = Math.max(item.str.length, 1);
    for (let k = 0; k < item.str.length; k++) {
      const ch = item.str[k];
      if (ch === " " || ch === "\u00a0") continue;
      const anchoCh = ancho / largo;
      const x0 = x + anchoCh * k;
      const negrita = esFuenteNegrita(fuentes[item.fontName]);
      if (ch === "\u02d9") {
        caracteres.push({
          ch: "•",
          x0,
          x1: x0 + anchoCh,
          xc: x0,
          alto: altoGlifo,
          y,
          acento: null,
          negrita,
        });
        continue;
      }
      caracteres.push({
        ch,
        x0,
        x1: x0 + anchoCh,
        xc: x0 + anchoCh / 2,
        alto: altoGlifo,
        y,
        acento: null,
        negrita,
      });
    }
  }

  const lineas: { y: number; chars: Caracter[] }[] = [];
  for (const c of caracteres.sort((a, b) => a.y - b.y || a.x0 - b.x0)) {
    const l = lineas.find((l) => Math.abs(l.y - c.y) <= TOLERANCIA_LINEA);
    if (l) l.chars.push(c);
    else lineas.push({ y: c.y, chars: [c] });
  }

  // cada acento se pega a la letra de la línea que tiene justo debajo.
  // se prueban las líneas de cerca hacia lejos porque en las páginas de dos
  // columnas hay renglones de la otra columna más cerca que el correcto.
  for (const a of acentos) {
    const candidatas = lineas
      .filter((l) => a.y < l.y && l.y - a.y <= ALCANCE_ACENTO)
      .sort((l1, l2) => l1.y - l2.y);
    for (const destino of candidatas) {
      let mejor: Caracter | null = null;
      let mejorDiff = TOLERANCIA_ACENTO;
      for (const c of destino.chars) {
        if (c.acento) continue;
        const d = Math.abs(c.xc - a.x);
        if (d < mejorDiff) {
          mejorDiff = d;
          mejor = c;
        }
      }
      if (mejor) {
        mejor.acento = a.tipo;
        break;
      }
    }
  }

  const enDosColumnas = hayDosColumnas(lineas, anchoPagina);
  const umbral = anchoPagina * 0.42;

  // cada renglón se parte donde hay un hueco grande (el final de una columna
  // y el comienzo de la otra, o el separador de la línea de apertura)
  const finales: LineaInterna[] = [];
  for (const l of lineas) {
    const trozos: Caracter[][] = [[]];
    for (const c of [...l.chars].sort((a, b) => a.x0 - b.x0)) {
      const grupo = trozos[trozos.length - 1];
      const previo = grupo[grupo.length - 1];
      if (previo && c.x0 - previo.x1 >= 18) trozos.push([c]);
      else grupo.push(c);
    }
    for (const trozo of trozos) {
      if (trozo.length === 0) continue;
      const texto = textoDeLinea(trozo);
      if (!texto) continue;
      const x0 = Math.min(...trozo.map((p) => p.x0));
      finales.push({
        pagina: 0,
        x: x0,
        xFin: Math.max(...trozo.map((p) => p.x1)),
        y: l.y,
        yFin: Math.max(...trozo.map((p) => p.y + p.alto * 0.25)),
        texto,
        columna: enDosColumnas && x0 >= umbral ? 1 : 0,
        chars: trozo,
        negrita: esNegrita(trozo),
      });
    }
  }

  finales.sort((a, b) => a.columna - b.columna || a.y - b.y || a.x - b.x);
  return { lineas: finales };
}

function textoDeLinea(chars: Caracter[]): string {
  let texto = "";
  let previo: Caracter | null = null;
  for (const c of chars) {
    if (previo) {
      const hueco = c.x0 - previo.x1;
      if (hueco > ESPACIO * Math.max(c.alto, 2)) texto += " ";
    }
    texto += c.acento
      ? acentuar(c.ch, c.acento)
      : LETRAS_SIN_PUNTO[c.ch] || c.ch;
    previo = c;
  }
  return limpiar(texto);
}

/** ¿la página tiene dos columnas? (huecos grandes en la mitad del ancho) */
function hayDosColumnas(
  lineas: { chars: Caracter[] }[],
  ancho: number,
): boolean {
  let count = 0;
  for (const l of lineas) {
    for (let k = 1; k < l.chars.length; k++) {
      const previo = l.chars[k - 1];
      const centro = (l.chars[k].x0 + previo.x1) / 2;
      if (centro < ancho * 0.4 || centro > ancho * 0.62) continue;
      if (l.chars[k].x0 - previo.x1 >= 18) count += 1;
    }
  }
  return count >= 2;
}

/** mapa "g_d0_f7" → "WtKnollTextDemiBold..." para saber qué va en negrita */
function nombresDeFuentes(
  ops: { fnArray: number[]; argsArray: unknown[][] },
  pdfjs: PdfJsMinimo,
  page: { commonObjs?: { get(id: string): { name?: string; loadedName?: string } | null } },
): Record<string, string> {
  const mapa: Record<string, string> = {};
  const P = pdfjs.OPS;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== P.setFont) continue;
    const ref = ops.argsArray[i]?.[0];
    if (typeof ref !== "string" || mapa[ref]) continue;
    try {
      const fuente = page.commonObjs?.get(ref);
      if (fuente?.name) mapa[ref] = fuente.name;
      else if (fuente?.loadedName) mapa[fuente.loadedName] = fuente.loadedName;
    } catch {
      /* si no se puede leer la fuente, seguimos sin negritas */
    }
  }
  return mapa;
}

const multiplicar = (a: number[], b: number[]) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

function extraerImagenes(
  ops: { fnArray: number[]; argsArray: unknown[][] },
  pdfjs: PdfJsMinimo,
  transform: number[],
  numero: number,
): ImagenPdf[] {
  const P = pdfjs.OPS;
  const salida: ImagenPdf[] = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const pila: number[][] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] || [];
    if (fn === P.save) pila.push(ctm);
    else if (fn === P.restore) ctm = pila.pop() || ctm;
    else if (fn === P.transform) ctm = multiplicar(args as number[], ctm);
    else if (
      fn === P.paintImageXObject ||
      fn === P.paintJpegXObject ||
      fn === P.paintImageXObjectRepeat ||
      fn === P.paintInlineImageXObject
    ) {
      const ancho = Math.abs(ctm[0]);
      const altoImg = Math.abs(ctm[3]);
      if (ancho < 40 || altoImg < 40) continue;
      // la imagen se pinta sobre el cuadrado unitario,(transformado por la ctm)
      const esquinas: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      const puntos = esquinas.map(([u, v]) =>
        pdfjs.Util.applyTransform(
          [ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5]],
          transform,
        ),
      );
      const xs = puntos.map((p) => p[0]);
      const ys = puntos.map((p) => p[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      salida.push({
        x: x0,
        y: y0,
        ancho: Math.max(...xs) - x0,
        alto: Math.max(...ys) - y0,
        pagina: numero,
      });
    }
  }
  return salida.sort((a, b) => a.y - b.y || a.x - b.x);
}

export async function extraerPaginas(
  doc: DocPdfjs,
  pdfjs: PdfJsMinimo,
  conImagenes: boolean,
): Promise<PaginaPdf[]> {
  const paginas: PaginaPdf[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();

    let ops: { fnArray: number[]; argsArray: unknown[][] } | null = null;
    try {
      ops = await page.getOperatorList();
    } catch {
      ops = null;
    }
    const fuentes = ops ? nombresDeFuentes(ops, pdfjs, page) : {};

    const { lineas } = extraerLineas(
      tc.items,
      pdfjs,
      vp.transform,
      vp.width,
      fuentes,
    );
    let imagenes: ImagenPdf[] = [];
    if (conImagenes && ops) {
      imagenes = extraerImagenes(ops, pdfjs, vp.transform, n);
    }
    paginas.push({
      numero: n,
      ancho: vp.width,
      alto: vp.height,
      lineas: lineas.map((l) => ({ ...l, pagina: n })),
      imagenes,
    });
    page.cleanup?.();
  }
  return paginas;
}

/* ---------------------------------------------- */
/*  entrada desde el navegador                    */
/* ---------------------------------------------- */

let cachePdfjs: PdfJsMinimo | null = null;

export async function cargarPdfjs(): Promise<PdfJsMinimo> {
  if (cachePdfjs) return cachePdfjs;
  const pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsMinimo & {
    GlobalWorkerOptions: { workerSrc: string };
  };
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  cachePdfjs = pdfjs;
  return pdfjs;
}

export interface ResultadoLectura {
  semanas: SemanaMwb[];
  anio: number;
  nombreArchivo: string;
}

export async function leerGuiaMwb(
  archivo: File,
  opciones: { imagenes?: boolean; alProgresar?: (n: number, total: number) => void } = {},
): Promise<ResultadoLectura> {
  const conImagenes = opciones.imagenes !== false;
  const pdfjs = await cargarPdfjs();
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: datos }).promise;

  const paginas = await extraerPaginas(doc, pdfjs, conImagenes);
  opciones.alProgresar?.(doc.numPages, doc.numPages);

  const anio = anioDelPdf(paginas, new Date().getFullYear());
  const semanas = armarSemanas(paginas, anio);

  if (conImagenes) {
    for (const semana of semanas) {
      for (const parte of semana.partes) {
        if (!parte.imagen) continue;
        try {
          const page = await doc.getPage(parte.imagen.pagina);
          parte.imagenDataUrl = await recortarImagen(page, parte.imagen);
        } catch {
          parte.imagenDataUrl = null;
        }
      }
    }
  }

  await doc.destroy?.();

  return { semanas, anio, nombreArchivo: archivo.name };
}
