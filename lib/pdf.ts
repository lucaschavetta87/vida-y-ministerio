/* ============================================================
   Lector de la "Guía de actividades para la reunión
   Vida y Ministerio Cristianos" (mwb) en PDF.

   El PDF viene en dos columnas con las letras espaciadas
   ("7-1 3 D E SEPTI EMB RE"), así que el trabajo principal es
   dejar el texto prolijo y saber a qué semana y a qué tema
   pertenece cada línea.
   ============================================================ */

export interface LineaPdf {
  /** página del PDF (1 = primera) */
  pagina: number;
  x: number;
  xFin: number;
  y: number;
  yFin: number;
  texto: string;
  /** 0 = columna izquierda, 1 = derecha */
  columna: number;
  /** el texto va en negrita (en la guía, los títulos de los temas) */
  negrita: boolean;
}

export interface ImagenPdf {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** página del PDF de la que sale el recorte */
  pagina: number;
}

export interface PaginaPdf {
  numero: number;
  ancho: number;
  alto: number;
  lineas: LineaPdf[];
  imagenes: ImagenPdf[];
}

export type TipoParteMwb = "item" | "linea" | "cancion";

export interface ParteMwb {
  seccion: string;
  tipo: TipoParteMwb;
  titulo: string;
  duracion: string;
  descripcion: string;
  numero: number | null;
  /** datos de la ilustración que acompaña al tema */
  imagen: ImagenPdf | null;
  imagenDataUrl?: string | null;
}

export interface SemanaMwb {
  fechaInicio: string;
  fechaFin: string;
  titulo: string;
  cita: string;
  partes: ParteMwb[];
}

/* ---------------- texto ---------------- */

const MESES_NUM = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

/** quita los glifos de icono (♪, ▪, saltos del PDF) */
export function limpiar(txt: string): string {
  return txt
    .replace(/[\u0000-\u001f\ufffc\u00ad]/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const sinEspacios = (txt: string) => limpiar(txt).replace(/\s+/g, "");

/** "7-13 DE SEPTIEMBRE JEREMÍAS 32, 33" → partes separadas */
function leerEncabezado(linea: string) {
  const plano = sinEspacios(linea).toUpperCase();
  if (!/^\d{1,2}(-\d{1,2})?DE/.test(plano)) return null;

  // primer nombre de mes del encabezado
  let mes = "";
  let posMes = -1;
  for (const m of MESES_NUM) {
    const p = plano.indexOf(m);
    if (p >= 0 && (posMes < 0 || p < posMes)) {
      posMes = p;
      mes = m;
    }
  }
  if (posMes < 0) return null;

  const antes = plano.slice(0, posMes);
  const m1 = antes.match(/^(\d{1,2})(?:-(\d{1,2}))?D/);
  if (!m1) return null;
  const dia1 = Number(m1[1]);
  const dia2 = m1[2] ? Number(m1[2]) : null;

  let resto = plano.slice(posMes + mes.length);
  let diaFin = dia2;
  let mesFin = mes;

  // "28 DE SEPTIEMBRE A 4 DE OCTUBRE"
  const mA = resto.match(/^A(\d{1,2})D/);
  if (mA) {
    diaFin = Number(mA[1]);
    let posFin = -1;
    for (const m of MESES_NUM) {
      const p = resto.indexOf(m, mA[0].length);
      if (p >= 0 && (posFin < 0 || p < posFin)) {
        posFin = p;
        mesFin = m;
      }
    }
    resto = posFin >= 0 ? resto.slice(posFin + mesFin.length) : "";
  }

  return { dia1, diaFin, mes, mesFin, cita: leerCita(resto) };
}

function leerCita(resto: string): string {
  const m = resto.match(/^([A-ZÁÉÍÓÚÑ]{3,})(\d[\d]*)(?:[,·](\d[\d]*))?/);
  if (!m) return "";
  let titulo = m[1];
  let nums = m[2];
  if (m[3]) nums += `, ${m[3]}`;
  titulo = titulo.charAt(0) + titulo.slice(1).toLowerCase();
  return `${titulo} ${nums}`;
}

const iso = (anio: number, mes: string, dia: number) =>
  `${anio}-${String(MESES_NUM.indexOf(mes) + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export function tituloSemanaMwb(fechaInicio: string): string {
  const inicio = new Date(`${fechaInicio}T12:00:00Z`);
  const fin = new Date(`${sumarDias(fechaInicio, 6)}T12:00:00Z`);
  const mi = inicio.toLocaleString("es", { month: "long", timeZone: "UTC" });
  const mf = fin.toLocaleString("es", { month: "long", timeZone: "UTC" });
  if (mi === mf) return `${inicio.getUTCDate()} de ${mi}`;
  return `${inicio.getUTCDate()} de ${mi} a ${fin.getUTCDate()} de ${mf}`;
}

/* ---------------- recorrido del PDF ---------------- */

const SECCION_TESOROS = "TESOROS DE LA BIBLIA";
const SECCION_SEAMOS = "SEAMOS MEJORES MAESTROS";
const SECCION_VIDA = "NUESTRA VIDA CRISTIANA";
const APERTURA = "APERTURA";
const CIERRE = "CIERRE";

const RE_NUMERO = /^(\d{1,2})\.\s*(.*)$/;
const RE_DURACION = /\(\s*(\d{1,2})\s*(?:min|mins?\.?)\s*\)/i;
const RE_SOLO_DURACION = /^\(\s*\d{1,2}\s*(?:min|mins?\.?)\s*\)$/i;
const RE_CANCION = /^Canci[oó]n\s+(\d+)/;
const RE_PALABRAS = /^Palabras de (introducci[oó]n|conclusi[oó]n)/;
const RE_PIE =
  /Christian Congregation|publicaci[oó]n de Testigos|Hecho en Espa|a publication|Minist[eè]rio Cristianos es|Torrej|Ctra\./i;

interface Bloque {
  pagina: number;
  seccion: string;
  tipo: TipoParteMwb;
  titulo: string;
  duracion: string;
  cuerpo: string[];
  numero: number | null;
  columna: number;
  x: number;
  y: number;
  xFin: number;
  yFin: number;
}

/** primera línea útil de la columna, para detectar la semana */
function weekDePagina(paginas: PaginaPdf[], desde: number) {
  for (let i = desde; i < paginas.length; i++) {
    // el encabezado de la semana ("7-13 DE SEPTIEMBRE · JEREMÍAS 32, 33")
    // puede venir partido en varios renglones: se prueban juntos
    const lineas = paginas[i].lineas
      .filter((l) => !/^\d{1,3}$/.test(l.texto))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    for (let k = 0; k < Math.min(lineas.length, 6); k++) {
      const cab = lineas
        .slice(0, k + 3)
        .map((l) => l.texto)
        .join(" ");
      const leido = leerEncabezado(cab);
      if (leido) return { pagina: i, leido };
    }
  }
  return null;
}

export function anioDelPdf(paginas: PaginaPdf[], porDefecto: number): number {
  const tapa = paginas[0]?.lineas.map((l) => l.texto).join(" ") || "";
  const plano = sinEspacios(tapa).toUpperCase();
  const m = plano.match(/DE(\d{4})$/) || plano.match(/DE(\d{4})/);
  return m ? Number(m[1]) : porDefecto;
}

export function armarSemanas(paginas: PaginaPdf[], anio: number): SemanaMwb[] {
  const semanas: SemanaMwb[] = [];
  let i = 0;
  while (i < paginas.length) {
    const arranque = weekDePagina(paginas, i);
    if (!arranque) {
      i += 1;
      continue;
    }
    const siguiente = weekDePagina(paginas, arranque.pagina + 1);
    const finPagina = (siguiente ? siguiente.pagina : paginas.length) - 1;
    const { leido } = arranque;

    const fechaInicio = iso(anio, leido.mes, leido.dia1);
    const fechaFin = iso(
      anio,
      leido.mesFin,
      leido.diaFin ?? leido.dia1 + 6,
    );

    const bloques = leerSemana(paginas, arranque.pagina, finPagina);

    // las ilustraciones se reparten entre los temas (una sola vez cada una);
    // la de la semana, si sobra, va con el primer tema numerado
    const usadas = new Set<ImagenPdf>();
    const ordenados = bloques
      .map((b) => ({
        seccion: b.seccion,
        tipo: b.tipo,
        titulo: b.titulo,
        duracion: b.duracion,
        descripcion: b.cuerpo.join("\n"),
        numero: b.numero,
        imagen: null as ImagenPdf | null,
      }))
      .sort((a, b) => ordenDe(a) - ordenDe(b));

    const conTema = ordenados.filter(
      (p) => p.tipo === "item" && p.numero !== null,
    );
    for (const p of conTema) {
      const bloque = bloques.find((b) => b.titulo === p.titulo);
      if (!bloque) continue;
      p.imagen = imagenDe(bloque, paginas, arranque.pagina, finPagina, usadas);
      if (p.imagen) usadas.add(p.imagen);
    }
    if (conTema[0] && !conTema[0].imagen) {
      const todas = paginas
        .slice(arranque.pagina, finPagina + 1)
        .flatMap((p) => p.imagenes)
        .filter((i) => i.x >= 2 && i.y >= 2 && !usadas.has(i));
      if (todas.length) {
        const grande = [...todas].sort(
          (a, b) => b.ancho * b.alto - a.ancho * a.alto,
        )[0];
        conTema[0].imagen = grande;
        usadas.add(grande);
      }
    }

    semanas.push({
      fechaInicio,
      fechaFin: fechaFin < fechaInicio ? sumarDias(fechaInicio, 6) : fechaFin,
      titulo: tituloSemanaMwb(fechaInicio),
      cita: leido.cita,
      partes: ordenados,
    });
    i = finPagina + 1;
  }
  return semanas;
}

const ORDEN_TIPO = { linea: 0, cancion: 1, item: 5 } as const;

function ordenDe(p: ParteMwb): number {
  const base = ORDEN_BASE[p.seccion] ?? 400;
  if (p.seccion === CIERRE) {
    // el cierre va: primero las palabras de conclusión, después la
    // canción y la oración (al final de todo)
    if (p.tipo === "item") return base + 10;
    return base + 20 + ORDEN_TIPO[p.tipo];
  }
  if (p.tipo !== "item") {
    if (p.seccion === APERTURA) return 10 + ORDEN_TIPO[p.tipo];
    return base + 5 + ORDEN_TIPO[p.tipo];
  }
  return base + (p.numero ?? 5) * 10;
}

function imagenDe(
  bloque: Bloque,
  paginas: PaginaPdf[],
  desde: number,
  hasta: number,
  usadas: Set<ImagenPdf>,
): ImagenPdf | null {
  let mejor: ImagenPdf | null = null;
  let mejorArea = 0;
  for (let n = desde; n <= hasta; n++) {
    const pagina = paginas[n];
    if (!pagina) continue;
    for (const img of pagina.imagenes) {
      if (usadas.has(img)) continue;
      // las ilustraciones sangran fuera de la página: no nos sirven
      if (img.x < 2 || img.y < 2) continue;
      if (img.x + img.ancho > pagina.ancho - 2) continue;
      if (img.y + img.alto > pagina.alto - 2) continue;
      if (Math.abs(img.x - bloque.x) > 140) continue;
      const solapa = Math.min(img.y + img.alto, bloque.yFin) - Math.max(img.y, bloque.y);
      const distancia = solapa >= 0 ? 0 : Math.min(
        Math.abs(img.y - bloque.yFin),
        Math.abs(bloque.y - (img.y + img.alto)),
      );
      if (distancia > 26) continue;
      const area = img.ancho * img.alto;
      if (area > mejorArea) {
        mejorArea = area;
        mejor = img;
      }
    }
  }
  return mejor;
}

/* ---------------- construcción de las partes ---------------- */

const ORDEN_BASE: Record<string, number> = {
  [APERTURA]: 0,
  [SECCION_TESOROS]: 100,
  [SECCION_SEAMOS]: 200,
  [SECCION_VIDA]: 300,
  [CIERRE]: 900,
};

function leerSemana(paginas: PaginaPdf[], desde: number, hasta: number): Bloque[] {
  const bloques: Bloque[] = [];
  let seccion = APERTURA;

  for (let p = desde; p <= hasta; p++) {
    const pagina = paginas[p];
    const columnas = partirColumnas(pagina);
    for (let c = 0; c < columnas.length; c++) {
      const lineas = columnas[c];
      for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        const texto = l.texto;

        if (!texto) continue;
        if (RE_PIE.test(texto)) continue;
        if (/^_+$/.test(texto.replace(/\s/g, ""))) continue;
        if (/^\d{1,3}$/.test(texto) && l.y < 46) continue;

        if (/^TESOROS\b/.test(texto) || /^DE LA BIBLIA$/.test(texto)) {
          seccion = SECCION_TESOROS;
          continue;
        }
        if (/^SEAMOS$/.test(texto) || /^MEJORES MAESTROS$/.test(texto)) {
          seccion = SECCION_SEAMOS;
          continue;
        }
        if (/^NUESTRA$/.test(texto) || /^VIDA CRISTIANA$/.test(texto)) {
          seccion = SECCION_VIDA;
          continue;
        }

        // (1 min.) o (3 mins.) que quedó en la otra columna
        const soloDur = texto.match(RE_SOLO_DURACION);
        if (soloDur) {
          const anterior = bloques[bloques.length - 1];
          if (anterior) {
            anterior.duracion = normalizarDuracion(texto);
            anterior.yFin = Math.max(anterior.yFin, l.yFin);
          }
          continue;
        }

        // "Canción 1 y oración · Palabras de introducción"
        const aperturaDoble = texto.match(
          /^(Canci[oó]n\s+\d+\s+y\s+oraci[oó]n)\s+Palabras de introducci[oó]n\s*(\(\s*\d+\s*mins?\.?\s*\))?/,
        );
        if (aperturaDoble) {
          bloques.push(nueva(APERTURA, "linea", aperturaDoble[1], "", [], null, c, l));
          bloques.push(
            nueva(
              APERTURA,
              "item",
              "Palabras de introducción",
              aperturaDoble[2] ? normalizarDuracion(aperturaDoble[2]) : "",
              [],
              null,
              c,
              l,
            ),
          );
          continue;
        }

        const cierre = texto.match(
          /^Palabras de conclusi[oó]n\s*(\(\s*\d+\s*mins?\.?\s*\))?\s*(.*)$/,
        );
        if (cierre) {
          const resto = limpiar(cierre[2]);
          const conCancion = resto.match(/^(Canci[oó]n\s+\d+\s+y\s+oraci[oó]n)/);
          bloques.push(
            nueva(
              CIERRE,
              "item",
              "Palabras de conclusión",
              cierre[1] ? normalizarDuracion(cierre[1]) : "",
              [],
              null,
              c,
              l,
            ),
          );
          if (conCancion) {
            bloques.push(nueva(CIERRE, "linea", conCancion[1], "", [], null, c, l));
          }
          continue;
        }

        const palabras = texto.match(
          /^Palabras de (introducci[oó]n|conclusi[oó]n)\s*(\(\s*\d+\s*mins?\.?\s*\))?/,
        );
        if (palabras) {
          const conCancion = texto.match(
            /(Canci[oó]n\s+\d+\s+y\s+oraci[oó]n)\s*$/,
          );
          bloques.push(
            nueva(
              APERTURA,
              "item",
              "Palabras de introducción",
              palabras[2] ? normalizarDuracion(palabras[2]) : "",
              [],
              null,
              c,
              l,
            ),
          );
          if (conCancion) {
            bloques.push(
              nueva(CIERRE, "linea", conCancion[1], "", [], null, c, l),
            );
          }
          continue;
        }

        const cancion = texto.match(RE_CANCION);
        if (cancion) {
          const esOracion = /oraci[oó]n/.test(texto);
          const seccionCancion =
            esOracion && seccion === APERTURA
              ? APERTURA
              : seccion === CIERRE || esOracion
                ? CIERRE
                : seccion;
          bloques.push(
            nueva(
              seccionCancion,
              "linea",
              limpiar(texto),
              "",
              [],
              null,
              c,
              l,
            ),
          );
          continue;
        }

        const numero = texto.match(RE_NUMERO);
        if (numero) {
          const bloque = leerItem(lineas, i, c, seccion);
          i = bloque.salto;
          bloques.push(bloque.bloque);
          continue;
        }

        // texto suelto: va al cuerpo del tema anterior
        const anterior = bloques[bloques.length - 1];
        if (anterior && seccion === anterior.seccion && anterior.tipo === "item") {
          anterior.cuerpo.push(texto);
          anterior.yFin = Math.max(anterior.yFin, l.yFin ?? l.y);
        }
      }
    }
  }
  return bloques;
}

/** "(10 mins.)" → "10 mins." (la app pone los paréntesis al mostrar) */
function normalizarDuracion(txt: string): string {
  const m = txt.match(RE_DURACION);
  if (!m) return "";
  const n = m[1];
  return n === "1" ? "1 min." : `${n} mins.`;
}

function nueva(
  seccion: string,
  tipo: TipoParteMwb,
  titulo: string,
  duracion: string,
  cuerpo: string[],
  numero: number | null,
  columna: number,
  l: { x: number; xFin: number; y: number; yFin?: number; pagina: number },
): Bloque {
  return {
    pagina: l.pagina,
    seccion,
    tipo,
    titulo,
    duracion,
    cuerpo,
    numero,
    columna,
    x: l.x,
    y: l.y,
    xFin: l.xFin,
    yFin: l.yFin ?? l.y,
  };
}

function leerItem(
  lineas: LineaPdf[],
  inicio: number,
  columna: number,
  seccion: string,
): { bloque: Bloque; salto: number } {
  const primera = lineas[inicio];
  const m = primera.texto.match(RE_NUMERO);
  const numero = m ? Number(m[1]) : null;

  let titulo = m ? limpiar(m[2]) : primera.texto;
  let duracion = "";
  const cuerpo: string[] = [];
  const x = primera.x;
  let xFin = primera.xFin;
  let yFin = primera.yFin;
  let renglonesDeTitulo = 0;
  let yAnterior = primera.y;

  const durDeTitulo = titulo.match(RE_DURACION);
  if (durDeTitulo) {
    titulo = limpiar(titulo.replace(durDeTitulo[0], ""));
    duracion = normalizarDuracion(durDeTitulo[0]);
  }

  let k = inicio + 1;
  while (k < lineas.length) {
    const l = lineas[k];
    const texto = l.texto;
    if (!texto) {
      k += 1;
      continue;
    }
    if (RE_PIE.test(texto) || /^_+$/.test(texto.replace(/\s/g, ""))) {
      k += 1;
      continue;
    }
    if (RE_NUMERO.test(texto) || esCabecera(texto) || RE_CANCION.test(texto)) break;

    // en la guía el título va en negrita y termina con la duración; si la
    // duración ya salió, el renglón sigue siendo título cuando va pegado
    // al anterior (en el cuerpo los renglones van más separados)
    const pegado = l.y - yAnterior <= 13.5;
    const sigueElTitulo =
      cuerpo.length === 0 &&
      (l.negrita ||
        (!duracion && renglonesDeTitulo < 2) ||
        (duracion && renglonesDeTitulo < 2 && pegado));
    if (sigueElTitulo) {
      renglonesDeTitulo += 1;
      const dur = texto.match(RE_DURACION);
      if (!duracion && dur) {
        duracion = normalizarDuracion(dur[0]);
        const resto = limpiar(texto.replace(dur[0], ""));
        if (resto) titulo = juntarTitulo(titulo, resto);
      } else {
        titulo = juntarTitulo(titulo, texto);
      }
      xFin = Math.max(xFin, l.xFin);
      yFin = Math.max(yFin, l.yFin);
      yAnterior = l.y;
      k += 1;
      continue;
    }

    cuerpo.push(texto);
    xFin = Math.max(xFin, l.xFin);
    yFin = Math.max(yFin, l.yFin);
    yAnterior = l.y;
    k += 1;
  }

  return {
    bloque: {
      pagina: primera.pagina,
      seccion,
      tipo: "item",
      titulo: `${numero !== null ? `${numero}. ` : ""}${limpiar(titulo)}`,
      duracion,
      cuerpo: unirParrafos(cuerpo),
      numero,
      columna,
      x,
      y: primera.y,
      xFin,
      yFin,
    },
    salto: k - 1,
  };
}

/** pega el renglón siguiente del título (repara palabras cortadas) */
function juntarTitulo(actual: string, nuevo: string): string {
  if (!actual) return nuevo;
  if (actual.endsWith("-")) return `${actual.slice(0, -1)}${nuevo}`;
  return `${actual} ${nuevo}`;
}

function esCabecera(texto: string): boolean {
  return (
    /^TESOROS\b/.test(texto) ||
    /^DE LA BIBLIA$/.test(texto) ||
    /^SEAMOS$/.test(texto) ||
    /^MEJORES MAESTROS$/.test(texto) ||
    /^NUESTRA$/.test(texto) ||
    /^VIDA CRISTIANA$/.test(texto) ||
    RE_PALABRAS.test(texto)
  );
}

/** junta renglones en párrafos y repara palabras cortadas */
export function unirParrafos(lineas: string[]): string[] {
  const salida: string[] = [];
  for (const linea of lineas) {
    const t = limpiar(linea);
    if (!t) continue;
    const anterior = salida[salida.length - 1];
    if (anterior && continuar(anterior, t)) {
      salida[salida.length - 1] = anterior.endsWith("-")
        ? `${anterior.slice(0, -1)}${t}`
        : `${anterior} ${t}`;
      continue;
    }
    salida.push(t);
  }
  return salida;
}

const TERMINA_PUNTO = /[.!?:;”)\]]$/;

function continuar(anterior: string, nuevo: string): boolean {
  if (anterior.endsWith("-")) return true;
  // "…no tendría sucesor?" + "(it “Jehoiaquim” párr. 9)." es un solo párrafo
  if (/^\s*[([]/.test(nuevo)) return true;
  if (TERMINA_PUNTO.test(anterior)) return false;
  if (
    /^(PREGÚNTESE|PARA MEDITAR|SUGERENCIA|DE CASA EN CASA|PREDICACIÓN)/i.test(
      nuevo,
    )
  ) {
    return false;
  }
  return true;
}

/* ---------------- columnas ---------------- */

export function partirColumnas(pagina: PaginaPdf): LineaPdf[][] {
  const izquierda: LineaPdf[] = [];
  const derecha: LineaPdf[] = [];
  for (const l of pagina.lineas) {
    (l.columna === 0 ? izquierda : derecha).push(l);
  }
  for (const c of [izquierda, derecha]) c.sort((a, b) => a.y - b.y || a.x - b.x);
  return [izquierda, derecha];
}

/* ---------------- imágenes ---------------- */

export interface Viewport {
  width: number;
  height: number;
  transform: number[];
}

export interface Renderizable {
  getViewport(p: { scale: number }): Viewport;
  render(p: {
    canvasContext: unknown;
    viewport: unknown;
    canvas?: unknown;
  }): { promise: Promise<void> };
}

/**
 * Recorta de la página el rectángulo de la ilustración (que viene en las
 * coordenadas de la página) y lo devuelve como imagen. Si algo falla,
 * devuelve null y el tema queda sin imagen.
 */
export async function recortarImagen(
  paginaRender: Renderizable,
  img: ImagenPdf,
  escala = 2,
): Promise<string | null> {
  try {
    if (typeof document === "undefined") return null;
    const anchoReal = img.ancho * escala;
    const altoReal = img.alto * escala;
    if (anchoReal < 6 || altoReal < 6) return null;

    const ancho = Math.min(Math.round(anchoReal), 880);
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = Math.round((altoReal * ancho) / anchoReal);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.translate(-img.x * escala, -img.y * escala);
    await paginaRender
      .render({
        canvasContext: ctx,
        viewport: paginaRender.getViewport({ scale: escala }),
        canvas,
      })
      .promise;
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch (e) {
    console.warn("No se pudo recortar la imagen:", (e as Error).message);
    return null;
  }
}
