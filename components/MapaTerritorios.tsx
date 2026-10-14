"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minus, Plus } from "lucide-react";
import { COLOR_ESTADO, type Territorio } from "@/lib/territorios";

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const PASO = 0.5;

/**
 * El mapa de la congregación con un punto de color por territorio:
 * verde = completado este mes, amarillo = a medias, gris = disponible.
 * Se puede acercar con la rueda o los botones y arrastrar para ver
 * las calles y las manzanas.
 */
export default function MapaTerritorios({
  territorios,
  colores,
  onElegir,
  seleccionado,
}: {
  territorios: Territorio[];
  colores: Record<number, { estado: string; ultima: string | null; letrasHechas: string[] }>;
  onElegir?: (territorio: Territorio) => void;
  seleccionado?: number | null;
}) {
  const [listo, setListo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [desplazamiento, setDesplazamiento] = useState({ x: 0, y: 0 });
  const caja = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLImageElement>(null);
  const arrastre = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setListo(true);
    img.src = "/mapa-territorios.png";
  }, []);

  /* ---------------- zoom y desplazamiento ---------------- */

  /**
   * Con el tamaño real de la imagen (no de la caja) se calcula hasta
   * dónde se puede arrastrar, para poder ver siempre el mapa entero.
   */
  const limites = (z: number) => {
    const anchoCaja = caja.current?.clientWidth || 1;
    const altoCaja = caja.current?.clientHeight || 1;
    const anchoImg = imagen.current?.clientWidth || anchoCaja;
    const altoImg = imagen.current?.clientHeight || altoCaja;

    // cómo queda centrado el mapa
    const centroX = (anchoCaja - anchoImg * z) / 2;
    const centroY = (altoCaja - altoImg * z) / 2;
    // hasta dónde se puede mover desde el centro
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
    const l = limites(z);
    return {
      x: Math.min(l.maxX, Math.max(l.minX, x)),
      y: Math.min(l.maxY, Math.max(l.minY, y)),
    };
  };

  /* ---------------- zoom ---------------- */

  const cambiarZoom = (nuevo: number, centro?: { x: number; y: number }) => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuevo));
    if (z === zoom) return;
    const ancho = caja.current?.clientWidth || 1;
    const alto = caja.current?.clientHeight || 1;
    // el punto del mapa que queda bajo el cursor se mantiene ahí
    const cx = centro ? centro.x : ancho / 2;
    const cy = centro ? centro.y : alto / 2;
    const px = (cx - desplazamiento.x) / zoom;
    const py = (cy - desplazamiento.y) / zoom;
    setZoom(z);
    setDesplazamiento(acotar(cx - px * z, cy - py * z, z));
  };

  const reiniciar = () => {
    setZoom(1);
    const l = limites(1);
    setDesplazamiento(acotar(l.centroX, l.centroY, 1));
  };

  /** Cuando la imagen carga, se centra en la caja. */
  const centrar = () => {
    const l = limites(1);
    setDesplazamiento(acotar(l.centroX, l.centroY, 1));
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
          <BotonMapa onClick={() => cambiarZoom(zoom + PASO)} titulo="Acercar">
            <Plus size={15} />
          </BotonMapa>
          <span className="w-14 text-center text-xs font-bold">{Math.round(zoom * 100)}%</span>
          <BotonMapa onClick={() => cambiarZoom(zoom - PASO)} titulo="Alejar">
            <Minus size={15} />
          </BotonMapa>
          <BotonMapa onClick={reiniciar} titulo="Ver todo el mapa">
            <Maximize2 size={14} />
          </BotonMapa>
        </div>
        {zoom > 1 && (
          <p className="text-[11px] text-suave">
            Arrastrá el mapa para recorrerlo · tocá un territorio para ver cuándo se hizo
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
        // la caja tiene la misma proporción que el mapa: al 100% se ve entero
        style={{ aspectRatio: "2441 / 1654" }}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imagen}
            onLoad={centrar}
            src="/mapa-territorios.png"
            alt="Mapa de territorios de la congregación"
            draggable={false}
            className={`w-full max-w-none select-none ${listo ? "block" : "hidden"}`}
          />
          {territorios.map((t) => {
            if (t.mapa_x === null || t.mapa_y === null || !t.activo) return null;
            const estado = colores[t.numero]?.estado || "DISPONIBLE";
            const esSeleccionado = seleccionado === t.numero;
            return (
              <button
                key={t.numero}
                type="button"
                onClick={() => onElegir?.(t)}
                title={`Territorio ${t.numero} · ${t.letras.join(" ")}${
                  estado === "PENDIENTE" ? " · quedó pendiente" : ""
                }`}
                className={
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 font-bold text-white transition-transform hover:scale-125 " +
                  (esSeleccionado ? "z-10 scale-125 ring-2 ring-white" : "z-0") +
                  (onElegir ? " cursor-pointer" : " cursor-default")
                }
                style={{
                  left: `${t.mapa_x}%`,
                  top: `${t.mapa_y}%`,
                  width: "clamp(18px, 2.6%, 34px)",
                  height: "clamp(18px, 2.6%, 34px)",
                  fontSize: "clamp(9px, 1.5%, 16px)",
                  background: COLOR_ESTADO[estado as keyof typeof COLOR_ESTADO],
                  borderColor: "#fff",
                  boxShadow: "0 0 0 1px rgba(0,0,0,.35)",
                }}
              >
                {t.numero}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BotonMapa({
  children,
  onClick,
  titulo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  titulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className="flex cursor-pointer items-center justify-center rounded-lg border border-linea bg-tarjeta px-2 py-1.5 text-suave transition-colors hover:border-suave hover:text-teal"
    >
      {children}
    </button>
  );
}

/** Leyenda de colores del mapa. */
export function LeyendaMapa() {
  const textos: [keyof typeof COLOR_ESTADO, string][] = [
    ["COMPLETADO", "Completado este mes"],
    ["PENDIENTE", "Quedó a medias"],
    ["DISPONIBLE", "Disponible"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-suave">
      {textos.map(([clave, texto]) => (
        <span key={clave} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-full border border-white"
            style={{
              background: COLOR_ESTADO[clave],
              boxShadow: "0 0 0 1px rgba(0,0,0,.35)",
            }}
          />
          {texto}
        </span>
      ))}
    </div>
  );
}