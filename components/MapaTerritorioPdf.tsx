"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minus, Plus } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// Configurar el worker de pdf.js (CDN)
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const PASO = 0.5;

/**
 * Mapa de territorios como PDF (solo lectura). Se puede acercar con la rueda
 * o los botones, arrastrar para recorrerlo y centrarlo con el botón de reset.
 */
export default function MapaTerritorioPdf() {
  const [listo, setListo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [desplazamiento, setDesplazamiento] = useState({ x: 0, y: 0 });
  const [aspectRatio, setAspectRatio] = useState("4 / 3");
  const caja = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const arrastre = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const pdf = await pdfjsLib.getDocument("/mapa-territorio.pdf").promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });

        setAspectRatio(`${viewport.width} / ${viewport.height}`);

        const canvasEl = canvas.current;
        if (!canvasEl) return;
        const ctx = canvasEl.getContext("2d");
        if (!ctx) return;

        canvasEl.width = viewport.width;
        canvasEl.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;
        setListo(true);

        // Centrar al cargar
        const l = limites(1, caja.current, canvasEl);
        setDesplazamiento({ x: l.centroX, y: l.centroY });
      } catch (e) {
        console.error("Error cargando el mapa PDF:", e);
      }
    };
    cargar();
  }, []);

  /* ---------------- zoom y desplazamiento ---------------- */

  const limites = (z: number, cajaEl: HTMLDivElement | null, canvasEl: HTMLCanvasElement | null) => {
    const anchoCaja = cajaEl?.clientWidth || 1;
    const altoCaja = cajaEl?.clientHeight || 1;
    const anchoImg = canvasEl?.clientWidth || anchoCaja;
    const altoImg = canvasEl?.clientHeight || altoCaja;

    const centroX = (anchoCaja - anchoImg * z) / 2;
    const centroY = (altoCaja - altoImg * z) / 2;
    const juegoX = Math.abs(anchoImg * z - anchoCaja) / 2;
    const juegoY = Math.abs(altoImg * z - altoCaja) / 2;

    return {
      centroX,
      centroY,
      minX: centroX - juegoX,
      maxX: centroX + juegoX,
      minY: centroY - juegoY,
      maxY: centroY + juegoY,
    };
  };

  const acotar = (x: number, y: number, z: number) => {
    const l = limites(z, caja.current, canvas.current);
    return {
      x: Math.min(l.maxX, Math.max(l.minX, x)),
      y: Math.min(l.maxY, Math.max(l.minY, y)),
    };
  };

  const cambiarZoom = (nuevo: number, centro?: { x: number; y: number }) => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuevo));
    if (z === zoom) return;
    const ancho = caja.current?.clientWidth || 1;
    const alto = caja.current?.clientHeight || 1;
    const cx = centro ? centro.x : ancho / 2;
    const cy = centro ? centro.y : alto / 2;
    const px = (cx - desplazamiento.x) / zoom;
    const py = (cy - desplazamiento.y) / zoom;
    setZoom(z);
    setDesplazamiento(acotar(cx - px * z, cy - py * z, z));
  };

  const reiniciar = () => {
    setZoom(1);
    const l = limites(1, caja.current, canvas.current);
    setDesplazamiento({ x: l.centroX, y: l.centroY });
  };

  /* ---------------- arrastrar ---------------- */

  const alBajar = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    arrastre.current = {
      x: e.clientX,
      y: e.clientY,
      ox: desplazamiento.x,
      oy: desplazamiento.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    setDesplazamiento(
      acotar(a.ox + e.clientX - a.x, a.oy + e.clientY - a.y, zoom),
    );
  };

  const alSoltar = () => {
    arrastre.current = null;
  };

  const enRueda = (e: React.WheelEvent) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    cambiarZoom(zoom + (e.deltaY < 0 ? PASO : -PASO), {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-linea bg-tarjeta2 p-1">
          <button
            type="button"
            onClick={() => cambiarZoom(zoom + PASO)}
            title="Acercar"
            className="flex cursor-pointer items-center justify-center rounded-lg border border-linea bg-tarjeta px-2 py-1.5 text-suave transition-colors hover:border-suave hover:text-teal"
          >
            <Plus size={15} />
          </button>
          <span className="w-14 text-center text-xs font-bold">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => cambiarZoom(zoom - PASO)}
            title="Alejar"
            className="flex cursor-pointer items-center justify-center rounded-lg border border-linea bg-tarjeta px-2 py-1.5 text-suave transition-colors hover:border-suave hover:text-teal"
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            onClick={reiniciar}
            title="Ver todo el mapa"
            className="flex cursor-pointer items-center justify-center rounded-lg border border-linea bg-tarjeta px-2 py-1.5 text-suave transition-colors hover:border-suave hover:text-teal"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        {zoom > 1 && (
          <p className="text-[11px] text-suave">
            Arrastrá el mapa para recorrerlo
          </p>
        )}
      </div>

      <div
        ref={caja}
        onWheel={enRueda}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        className={`relative w-full overflow-hidden rounded-xl border border-linea bg-tarjeta2 ${
          zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        style={{ aspectRatio }}
      >
        {!listo && (
          <div className="flex items-center justify-center py-20 text-sm text-suave">
            <Loader2 size={16} className="mr-2 animate-spin" /> Cargando el mapa…
          </div>
        )}
        <div
          className="absolute top-0 left-0 w-full origin-top-left"
          style={{
            transform: `translate(${desplazamiento.x}px, ${desplazamiento.y}px) scale(${zoom})`,
          }}
        >
          <canvas
            ref={canvas}
            draggable={false}
            className={`w-full max-w-none select-none ${listo ? "block" : "hidden"}`}
          />
        </div>
      </div>
    </div>
  );
}
