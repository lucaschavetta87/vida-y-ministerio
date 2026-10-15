import {
  NOTA_ESTUDIANTE,
  TITULO_ASIGNACION,
  fechaLargaAsignacion,
  nombreComoFigura,
  type AsignacionImagen,
} from "./asignaciones";

/* ============================================================
   Dibujo de la asignación (canvas del navegador).
   Sale exactamente con la forma de "asignacion.jpeg".
   ============================================================ */

/** medidas del lienzo (se dibuja al doble para que se vea nítido) */
export const ANCHO_ASIGNACION = 860;
const ESCALA = 2;
const MARGEN_INFERIOR = 46;

const NEGRO = "#111111";
const GRIS = "#555555";
const FUENTE = "Helvetica, Arial, sans-serif";

export function medir(texto: string, px: number, negrita = false): number {
  if (typeof document === "undefined") return texto.length * (px * 0.52);
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return texto.length * (px * 0.52);
  c.font = `${negrita ? "bold" : "normal"} ${px}px ${FUENTE}`;
  return c.measureText(texto).width;
}

/** parte el texto en renglones que entran en el ancho dado */
export function ajustar(texto: string, ancho: number, px: number): string[] {
  return texto.split(" ").reduce((lineas: string[], palabra) => {
    const probar = lineas.length ? `${lineas[lineas.length - 1]} ${palabra}` : palabra;
    if (lineas.length && medir(probar, px) > ancho) lineas.push(palabra);
    else if (lineas.length) lineas[lineas.length - 1] = probar;
    else lineas.push(palabra);
    return lineas;
  }, []);
}

/**
 * Dibuja la asignación y devuelve el canvas. La imagen queda justa:
 * primero se arma el texto para saber cuánto alto hace falta.
 */
export function dibujarAsignacion(a: AsignacionImagen): HTMLCanvasElement {
  const alto = altoNecesario(a);
  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO_ASIGNACION * ESCALA;
  lienzo.height = alto * ESCALA;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return lienzo;
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ANCHO_ASIGNACION, alto);

  const M = 54;
  const anchoUtil = ANCHO_ASIGNACION - M * 2;
  let y = 76;

  /* ---- título ---- */
  ctx.fillStyle = NEGRO;
  ctx.textAlign = "center";
  ctx.font = `bold 30px ${FUENTE}`;
  TITULO_ASIGNACION.forEach((linea, i) => ctx.fillText(linea, ANCHO_ASIGNACION / 2, y + i * 36));
  y += TITULO_ASIGNACION.length * 36 + 18;
  ctx.textAlign = "left";

  /* ---- datos ---- */
  const fila = (etiqueta: string, valor: string) => {
    ctx.fillStyle = NEGRO;
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText(etiqueta, M, y);
    ctx.font = `normal 22px ${FUENTE}`;
    ctx.fillText(valor, M + 190, y);
    y += 42;
  };

  fila("Nombre:", nombreComoFigura(a.nombre));
  if (a.ayudante) fila("Ayudante:", nombreComoFigura(a.ayudante, true));
  fila("Fecha:", fechaLargaAsignacion(a.fecha));

  ctx.fillStyle = NEGRO;
  ctx.font = `bold 22px ${FUENTE}`;
  ctx.fillText("Intervención núm.:", M, y);
  y += 34;
  ctx.font = `normal 22px ${FUENTE}`;
  ajustar(a.intervencion, anchoUtil, 22).forEach((r) => {
    ctx.fillText(r, M, y);
    y += 30;
  });
  y += 22;

  /* ---- salas ---- */
  ctx.fillStyle = NEGRO;
  ctx.font = `bold 22px ${FUENTE}`;
  ctx.fillText("Se presentará en:", M, y);
  y += 36;

  const casilla = (texto: string, marcado: boolean) => {
    const c = 18;
    const t = y - 13;
    ctx.strokeStyle = NEGRO;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(M, t, c, c);
    if (marcado) {
      ctx.beginPath();
      ctx.moveTo(M + 4, t + 9);
      ctx.lineTo(M + 8, t + 14);
      ctx.lineTo(M + 15, t + 4);
      ctx.stroke();
    }
    ctx.fillStyle = NEGRO;
    ctx.font = `normal 21px ${FUENTE}`;
    ctx.fillText(texto, M + 30, y);
    y += 34;
  };
  casilla("Sala principal", true);
  casilla("Sala Auxiliar 1", false);
  casilla("Sala Auxiliar 2", false);
  y += 26;

  /* ---- nota al estudiante ---- */
  ctx.fillStyle = GRIS;
  ctx.font = `normal 19px ${FUENTE}`;
  ajustar(NOTA_ESTUDIANTE, anchoUtil, 19).forEach((r) => {
    ctx.fillText(r, M, y);
    y += 27;
  });

  return lienzo;
}

/** Alto que necesita el texto de esta asignación. */
function altoNecesario(a: AsignacionImagen): number {
  const M = 54;
  const anchoUtil = ANCHO_ASIGNACION - M * 2;
  let y = 76 + 2 * 36 + 18;
  y += 42; // Nombre
  if (a.ayudante) y += 42; // Ayudante
  y += 42; // Fecha
  y += 34;
  y += ajustar(a.intervencion, anchoUtil, 22).length * 30;
  y += 22;
  y += 36; // "Se presentará en:"
  y += 34 * 3; // las tres salas
  y += 26;
  y += ajustar(NOTA_ESTUDIANTE, anchoUtil, 19).length * 27;
  return Math.round(y + MARGEN_INFERIOR);
}

/** "Nahiara Chavetta" → "asignacion-nahiara-chavetta.png" */
export function nombreArchivoAsignacion(a: AsignacionImagen): string {
  const base = nombreComoFigura(a.nombre)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `asignacion-${base}.png`;
}