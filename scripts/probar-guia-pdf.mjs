/* Prueba del lector de la guía en PDF con el archivo real.
   Uso: npm run probar:guia -- [ruta.pdf]                     */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const raiz = new URL("..", import.meta.url).pathname;

const pdfjs = await import(
  require.resolve("pdfjs-dist/legacy/build/pdf.mjs", { paths: [raiz] })
);

const { extraerPaginas } = await import(
  new URL("../lib/leer-pdf.ts", import.meta.url).href
).catch(async (e) => {
  console.error("No se pudo importar lib/leer-pdf.ts:", e.message);
  process.exit(1);
});
const { anioDelPdf, armarSemanas } = await import(
  new URL("../lib/pdf.ts", import.meta.url).href
);

const archivo = process.argv[2] || `${raiz}../mwb_S_202609.pdf`;
const datos = new Uint8Array(readFileSync(archivo));

const doc = await pdfjs.getDocument({ data: datos, useSystemFonts: false }).promise;
const paginas = await extraerPaginas(doc, pdfjs, true);
const anio = anioDelPdf(paginas, new Date().getFullYear());
console.log("archivo:", archivo);
console.log("páginas:", paginas.length, "año:", anio);

const semanas = armarSemanas(paginas, anio);
console.log("semanas detectadas:", semanas.length);

for (const s of semanas) {
  console.log(`\n=========== ${s.fechaInicio} → ${s.fechaFin} | ${s.titulo} | ${s.cita}`);
  for (const p of s.partes) {
    const img = p.imagen
      ? ` [img p${p.imagen.pagina} ${Math.round(p.imagen.ancho)}x${Math.round(p.imagen.alto)} @${Math.round(p.imagen.x)},${Math.round(p.imagen.y)}]`
      : "";
    console.log(`  ${p.seccion.padEnd(26)} ${p.tipo.padEnd(6)} ${p.titulo} ${p.duracion}${img}`);
    if (p.descripcion) {
      for (const l of p.descripcion.split("\n")) console.log(`        · ${l}`);
    }
  }
}
