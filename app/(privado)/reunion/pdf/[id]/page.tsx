"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  Gem,
  HeartHandshake,
  Printer,
  Wheat,
} from "lucide-react";
import { Panel } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { Participante, Reunion, ReunionParte } from "@/lib/tipos";
import { fechaLarga } from "@/lib/plantilla";
import { cn } from "@/lib/utils";

const AVISO_SUPABASE =
  "No se pudo leer Supabase. ¿Ejecutaste el script SQL en el panel?";

function traducirError(msg: string): string {
  if (/lector_id/.test(msg || ""))
    return "Falta la migración: pegá supabase/migracion_v3.sql en el SQL Editor de Supabase.";
  if (/participante_ids/.test(msg || ""))
    return "Falta la migración: pegá supabase/migracion_v2.sql en el SQL Editor de Supabase.";
  return msg;
}

/** partes donde van titular y ayudante */
const esDeAPares = (p: ReunionParte) =>
  p.seccion === "SEAMOS MEJORES MAESTROS" ||
  /^3\.\s*Lectura de la Biblia/i.test(p.titulo.replace(/\s+/g, " "));

/** color e ícono de cada subtítulo, como en la guía impresa */
const SECCION_ESTILO: Record<
  string,
  { texto: string; barra: string; fondo: string; icono: ReactNode }
> = {
  "TESOROS DE LA BIBLIA": {
    texto: "text-[#1c7a72]",
    barra: "bg-[#1c7a72]",
    fondo: "bg-[#e6f2f0]",
    icono: <Gem size={11} className="text-white" />,
  },
  "SEAMOS MEJORES MAESTROS": {
    texto: "text-[#b8770f]",
    barra: "bg-[#b8770f]",
    fondo: "bg-[#fbf0dd]",
    icono: <Wheat size={11} className="text-white" />,
  },
  "NUESTRA VIDA CRISTIANA": {
    texto: "text-[#a03028]",
    barra: "bg-[#a03028]",
    fondo: "bg-[#fbeae8]",
    icono: <HeartHandshake size={11} className="text-white" />,
  },
};

const SECCIONES_PDF = Object.keys(SECCION_ESTILO);

export default function PaginaPdfReunion() {
  const { id } = useParams<{ id: string }>();
  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [partes, setPartes] = useState<ReunionParte[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    const cargar = async () => {
      const [r, p, pt] = await Promise.all([
        supabase.from("reuniones").select("*").eq("id", id).single(),
        supabase
          .from("reunion_partes")
          .select("*")
          .eq("reunion_id", id)
          .order("orden"),
        supabase.from("participantes").select("*"),
      ]);
      if (cancelado) return;
      const fallo = r.error || p.error || pt.error;
      if (fallo) {
        setError(traducirError(fallo.message) || AVISO_SUPABASE);
      } else {
        setReunion(r.data as Reunion);
        setPartes((p.data as ReunionParte[]) || []);
        setParticipantes((pt.data as Participante[]) || []);
      }
      setCargando(false);
    };
    cargar().catch(() => {
      if (!cancelado) {
        setError("No se pudo cargar la reunión.");
        setCargando(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [id]);

  const nombres = useMemo(() => {
    const mapa: Record<string, string> = {};
    participantes.forEach((p) => (mapa[p.id] = p.nombre_completo));
    return mapa;
  }, [participantes]);

  const asignadas = partes.filter((p) => (p.participante_ids || []).length > 0)
    .length;

  const nombreDe = (id: string | null | undefined) =>
    id ? nombres[id] || "—" : null;

  /** titular / ayudante / resto, o el nombre simple */
  const personasDe = (p: ReunionParte) => {
    const ids = p.participante_ids || [];
    if (!ids.length) return null;
    if (!esDeAPares(p)) {
      return <span className="font-semibold">{nombreDe(ids[0])}</span>;
    }
    return (
      <span className="flex flex-col gap-0.5">
        <span>
          <span className="text-[9px] font-black tracking-[0.1em] text-suave uppercase">
            Titular:{" "}
          </span>
          <span className="font-semibold">{nombreDe(ids[0])}</span>
        </span>
        {ids[1] && (
          <span>
            <span className="text-[9px] font-black tracking-[0.1em] text-suave uppercase">
            Ayudante:{" "}
          </span>
            <span className="font-semibold">{nombreDe(ids[1])}</span>
          </span>
        )}
        {ids[2] && (
          <span>
            <span className="text-[9px] font-black tracking-[0.1em] text-suave uppercase">
              Otro:{" "}
            </span>
            <span className="font-semibold">{nombreDe(ids[2])}</span>
          </span>
        )}
      </span>
    );
  };

  const bloques = useMemo(() => {
    const salida: {
      clave: string;
      titulo: string;
      items: ReunionParte[];
    }[] = [];
    for (const p of partes) {
      const clave = SECCIONES_PDF.includes(p.seccion) ? p.seccion : "";
      const ultima = salida[salida.length - 1];
      if (ultima && ultima.clave === clave) ultima.items.push(p);
      else salida.push({ clave, titulo: p.seccion, items: [p] });
    }
    return salida;
  }, [partes]);

  if (cargando) {
    return (
      <Panel className="p-10 text-center text-sm text-suave">
        Cargando la guía…
      </Panel>
    );
  }

  if (error || !reunion) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {error || "No se encontró la reunión."}
        </p>
        <Link
          href="/reunion"
          className="flex items-center gap-1 text-sm font-semibold text-teal hover:underline"
        >
          <ChevronLeft size={15} /> Volver a Vida y Ministerio
        </Link>
      </div>
    );
  }

  return (
    <div className="pagina-pdf mx-auto max-w-4xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/reunion"
          className="flex items-center gap-1 text-sm font-semibold text-suave transition-colors hover:text-teal"
        >
          <ChevronLeft size={15} /> Volver a Vida y Ministerio
        </Link>
        <button
          onClick={() => window.print()}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal2"
        >
          <Printer size={15} /> Guardar como PDF
        </button>
      </div>

      {/* -------- encabezado -------- */}
      <header className="mb-3 border-b-2 border-texto pb-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-lg leading-tight font-black tracking-wide uppercase">
              Guia Vida y Ministerio Cristianos
            </h1>
            <p className="text-sm font-semibold">{reunion.titulo}</p>
          </div>
          <p className="text-xs font-semibold text-suave">
            {reunion.cita_biblica || ""}
          </p>
        </div>
      </header>

      {/* -------- un tema debajo del otro, como en la guía -------- */}
      <div className="mt-2">
        {bloques.map((bloque, i) => {
          const estilo = bloque.clave ? SECCION_ESTILO[bloque.clave] : null;
          return (
            <Fragment key={`${i}-${bloque.clave}`}>
              {estilo && (
                <div className="mt-4 mb-1.5 flex items-center gap-2 first:mt-0">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-[2px]",
                      estilo.fondo.replace("bg-", "text-"),
                      estilo.texto,
                    )}
                  >
                    {estilo.icono}
                  </span>
                  <h2
                    className={cn(
                      "text-[11px] font-black tracking-[0.1em] uppercase",
                      estilo.texto,
                    )}
                  >
                    {bloque.titulo}
                  </h2>
                  <span
                    className={cn("h-px flex-1", estilo.barra)}
                  />
                </div>
              )}
              {bloque.items.map((p) => {
                if (p.tipo !== "item") {
                  return (
                    <p key={p.id} className="mb-1 text-[11px] leading-snug">
                      <span className="font-semibold">♪ {p.titulo}</span>
                      {p.duracion && (
                        <span className="text-suave"> {p.duracion}</span>
                      )}
                      {personasDe(p) && (
                        <span className="ml-1 text-suave">— {personasDe(p)}</span>
                      )}
                    </p>
                  );
                }
                return (
                  <div key={p.id} className="mb-1.5 break-inside-avoid">
                    <p className="text-[11.5px] leading-snug">
                      <span className="font-semibold">{p.titulo}</span>
                      {p.duracion && (
                        <span className="text-suave"> {p.duracion}</span>
                      )}
                      {p.lector_id && (
                        <span className="ml-1 text-[10px] text-suave">
                          Lector: {nombres[p.lector_id] || "—"}
                        </span>
                      )}
                    </p>
                    <div className="mt-0.5 pl-4 text-[11px]">
                      {personasDe(p) || (
                        <span className="inline-block h-2.5 w-44 border-b border-dashed border-borde" />
                      )}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-suave">
        {asignadas} de {partes.length} partes con participante asignado ·{" "}
        {fechaLarga(reunion.fecha_inicio)} → {fechaLarga(reunion.fecha_fin)}
      </p>
    </div>
  );
}
