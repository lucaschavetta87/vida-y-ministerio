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
    icono: <Gem size={13} className="text-white" />,
  },
  "SEAMOS MEJORES MAESTROS": {
    texto: "text-[#b8770f]",
    barra: "bg-[#b8770f]",
    fondo: "bg-[#fbf0dd]",
    icono: <Wheat size={13} className="text-white" />,
  },
  "NUESTRA VIDA CRISTIANA": {
    texto: "text-[#a03028]",
    barra: "bg-[#a03028]",
    fondo: "bg-[#fbeae8]",
    icono: <HeartHandshake size={13} className="text-white" />,
  },
};

const SECCIONES_PDF = Object.keys(SECCION_ESTILO);

export default function PaginaPdfReunion() {
  const { id } = useParams<{ id: string }>();
  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [partes, setPartes] = useState<ReunionParte[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  /** Id del presidente (de la reunión o, si no hay, de Asignaciones Mecánicas). */
  const [presidenteId, setPresidenteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    const cargar = async () => {
      const [r, p, pt, roles, ram] = await Promise.all([
        supabase.from("reuniones").select("*").eq("id", id).single(),
        supabase
          .from("reunion_partes")
          .select("*")
          .eq("reunion_id", id)
          .order("orden"),
        supabase.from("participantes").select("*"),
        supabase.from("roles").select("id, slug"),
        supabase
          .from("reunion_asignaciones_mecanicas")
          .select("presidente_fin_semana_id")
          .eq("reunion_id", id)
          .maybeSingle(),
      ]);
      if (cancelado) return;
      const fallo = r.error || p.error || pt.error;
      if (fallo) {
        setError(traducirError(fallo.message) || AVISO_SUPABASE);
      } else {
        setReunion(r.data as Reunion);
        setPartes((p.data as ReunionParte[]) || []);
        setParticipantes((pt.data as Participante[]) || []);

        // el presidente es el que se elige arriba en la pantalla de la
        // reunión (rol "Presidente": Palabras de introducción/conclusión)
        const rolPresidente = ((roles.data as { id: string; slug: string }[]) || []).find(
          (x) => x.slug === "presidente",
        );
        const partesReunion = (p.data as ReunionParte[]) || [];
        const deLaReunion = rolPresidente
          ? partesReunion
              .filter((x) => x.role_id === rolPresidente.id)
              .flatMap((x) => x.participante_ids || [])[0]
          : null;

        // si no está, se usa el que quedó cargado en Asignaciones Mecánicas
        setPresidenteId(
          deLaReunion ||
            ((ram.data as { presidente_fin_semana_id?: string | null }) || {})
              .presidente_fin_semana_id ||
            null,
        );
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

  /**
   * Letra grande para que la guía ocupe la hoja A4 entera. Si la reunión
   * tiene muchas partes se achica un poco para que no se corte en dos.
   */
  const TAM = useMemo(() => {
    const muchas = partes.length > 16;
    const media = partes.length > 13;
    if (muchas)
      return {
        titulo: 12,
        nombre: 11.5,
        seccion: 11,
        lector: 11.5,
        separacion: 6,
        hueco: 10,
      };
    if (media)
      return {
        titulo: 13.5,
        nombre: 13,
        seccion: 12,
        lector: 12.5,
        separacion: 8,
        hueco: 12,
      };
    return {
      titulo: 16.5,
      nombre: 16,
      seccion: 15,
      lector: 15.5,
      separacion: 16,
      hueco: 16,
    };
  }, [partes.length]);

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
            <h1 className="text-2xl leading-tight font-black tracking-wide uppercase">
              Guia Vida y Ministerio Cristianos
            </h1>
            <p className="text-lg font-semibold">{reunion.titulo}</p>
          </div>
          <div className="text-right text-sm leading-snug font-semibold">
            <p>{reunion.cita_biblica || ""}</p>
            <p>
              {fechaLarga(reunion.fecha_inicio)} → {fechaLarga(reunion.fecha_fin)}
            </p>
            <p>
              Presidente:{" "}
              <span className="font-bold">
                {presidenteId ? nombres[presidenteId] || "—" : "—"}
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* -------- un tema debajo del otro, como en la guía -------- */}
      <div className="mt-2">
        {bloques.map((bloque, i) => {
          const estilo = bloque.clave ? SECCION_ESTILO[bloque.clave] : null;
          return (
            <Fragment key={`${i}-${bloque.clave}`}>
              {estilo && (
                <div className="mt-6 mb-2 flex items-center gap-2 first:mt-0">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-[2px]",
                      estilo.fondo.replace("bg-", "text-"),
                      estilo.texto,
                    )}
                  >
                    {estilo.icono}
                  </span>
                  <h2
                    style={{ fontSize: TAM.seccion }}
                    className={cn(
                      "font-black tracking-[0.1em] uppercase",
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
                    <p
                      key={p.id}
                      style={{ fontSize: TAM.titulo }}
                      className="leading-snug"
                    >
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
                  <div
                    key={p.id}
                    style={{ marginBottom: TAM.separacion }}
                    className="break-inside-avoid"
                  >
                    <p style={{ fontSize: TAM.titulo }} className="leading-snug">
                      <span className="font-bold">{p.titulo}</span>
                      {p.duracion && (
                        <span className="text-suave"> {p.duracion}</span>
                      )}
                    </p>
                    <div
                      style={{ fontSize: TAM.nombre }}
                      className="mt-0.5 flex flex-wrap items-baseline gap-x-4 pl-4"
                    >
                      {personasDe(p) || (
                        <span
                          style={{ height: TAM.hueco, width: 288 }}
                          className="inline-block border-b border-dashed border-borde"
                        />
                      )}
                      {p.lector_id && (
                        <span style={{ fontSize: TAM.lector }} className="font-bold">
                          Lector: {nombres[p.lector_id] || "—"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>


    </div>
  );
}
