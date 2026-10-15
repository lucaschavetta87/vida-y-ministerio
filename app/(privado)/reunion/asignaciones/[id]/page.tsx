"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  Download,
  ImageDown,
  Loader2,
  Printer,
} from "lucide-react";
import { Boton, Etiqueta, Panel } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { dibujarAsignacion, nombreArchivoAsignacion } from "@/lib/dibujar-asignacion";
import {
  armarAsignaciones,
  esTemaDeAsignacion,
  fechaDeReunion,
  nombreComoFigura,
  temasSinGente,
  type AsignacionImagen,
} from "@/lib/asignaciones";
import type { Participante, Reunion, ReunionParte } from "@/lib/tipos";

/* ------------------------------------------------------------------ */
/*  Pantalla                                                            */
/* ------------------------------------------------------------------ */

export default function PaginaAsignaciones() {
  const { id } = useParams<{ id: string }>();
  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [partes, setPartes] = useState<ReunionParte[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [imagenes, setImagenes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    Promise.all([
      supabase.from("reuniones").select("*").eq("id", id).single(),
      supabase.from("reunion_partes").select("*").eq("reunion_id", id).order("orden"),
      supabase.from("participantes").select("*"),
    ]).then(([r, p, pa]) => {
      if (cancelado) return;
      if (r.error || p.error) setError(r.error?.message || p.error?.message || "");
      setReunion((r.data as Reunion) || null);
      setPartes((p.data as ReunionParte[]) || []);
      setParticipantes((pa.data as Participante[]) || []);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [id]);

  const asignaciones = useMemo(() => {
    if (!reunion) return [];
    return armarAsignaciones({
      partes,
      participantes,
      fecha: fechaDeReunion(
        reunion.fecha_inicio,
        reunion.dia_reunion_entresemana,
      ),
    });
  }, [reunion, partes, participantes]);

  const sinGente = useMemo(() => temasSinGente(partes), [partes]);

  /**
   * Se dibuja cada una una vez y se guardan como imagen para ver y bajar.
   * El dibujo usa el canvas, así que se hace recién en el navegador.
   */
  useEffect(() => {
    const t = setTimeout(() => {
      const nuevas: Record<string, string> = {};
      for (const a of asignaciones) {
        nuevas[a.clave] = dibujarAsignacion(a).toDataURL("image/png");
      }
      setImagenes(nuevas);
    }, 0);
    return () => clearTimeout(t);
  }, [asignaciones]);

  const descargarUna = useCallback(
    (a: AsignacionImagen) => {
      const href = imagenes[a.clave];
      if (!href) return;
      const enlace = document.createElement("a");
      enlace.download = nombreArchivoAsignacion(a);
      enlace.href = href;
      enlace.click();
    },
    [imagenes],
  );

  const descargarTodas = useCallback(() => {
    asignaciones.forEach((a, i) =>
      setTimeout(() => descargarUna(a), i * 350),
    );
  }, [asignaciones, descargarUna]);

  if (cargando)
    return (
      <Panel className="flex items-center justify-center gap-2 p-10 text-sm text-suave">
        <Loader2 size={16} className="animate-spin" /> Generando las asignaciones…
      </Panel>
    );

  if (error || !reunion)
    return (
      <div className="mx-auto max-w-xl">
        <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {error || "No se encontró la reunión."}
        </p>
        <Link href="/reunion" className="text-sm font-semibold text-teal hover:underline">
          Volver a Vida y Ministerio
        </Link>
      </div>
    );

  return (
    <div className="pagina-pdf mx-auto max-w-5xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/reunion?reunion=${reunion.id}`}
          className="flex items-center gap-1.5 text-sm font-semibold text-suave transition-colors hover:text-teal"
        >
          <ChevronLeft size={16} /> Volver a la reunión
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta tono="teal">
            {asignaciones.length} asignacion{asignaciones.length === 1 ? "" : "es"}
          </Etiqueta>
          <Boton variante="secundario" onClick={descargarTodas} disabled={!asignaciones.length}>
            <ImageDown size={15} /> Descargar todas
          </Boton>
          <Boton onClick={() => window.print()} disabled={!asignaciones.length}>
            <Printer size={15} /> Imprimir / Guardar PDF
          </Boton>
        </div>
      </div>

      <header className="no-print mb-5">
        <h1 className="text-2xl font-black tracking-tight">
          Asignaciones · {reunion.titulo}
        </h1>
        <p className="mt-1 text-sm text-suave">
          Se generó una imagen por persona para la Lectura de la Biblia y para cada tema de
          Seamos mejores maestros. Bajalas y mandalas por WhatsApp, o imprimilas.
        </p>
      </header>

      {sinGente.length > 0 && (
        <p className="no-print mb-5 rounded-xl border border-gold2/50 bg-gold2/10 px-3 py-2 text-sm text-gold2">
          <strong>Faltan personas en:</strong> {sinGente.join(" · ")}
        </p>
      )}

      {asignaciones.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-suave">
          Todavía no hay temas con personas asignadas. Asigná las personas en la reunión y
          volvé a generar.
        </Panel>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {asignaciones.map((a) => {
            const imagen = imagenes[a.clave];
            return (
              <div key={a.clave} className="flex flex-col gap-2">
                <div className="overflow-hidden rounded-xl border border-linea bg-white">
                  {imagen ? (
                    <img
                      src={imagen}
                      alt={`Asignación de ${nombreComoFigura(a.nombre)}`}
                      className="w-full"
                    />
                  ) : (
                    <div className="flex aspect-[860/900] items-center justify-center text-xs text-suave">
                      dibujando…
                    </div>
                  )}
                </div>
                <div className="no-print flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">
                    {nombreComoFigura(a.nombre)}
                  </span>
                  <button
                    onClick={() => descargarUna(a)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-linea px-3 py-1.5 text-xs font-semibold text-suave transition-colors hover:border-teal hover:text-teal"
                  >
                    <Download size={13} /> Descargar PNG
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="no-print mt-8 text-[11px] text-suave">
        Los temas que generan asignación son la Lectura de la Biblia y los de Seamos
        mejores maestros. {partes.filter(esTemaDeAsignacion).length} temas en total en esta
        semana.
      </p>
    </div>
  );
}