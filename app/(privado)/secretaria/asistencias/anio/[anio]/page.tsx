"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import TablaAsistenciaAnio from "@/components/TablaAsistenciaAnio";
import { supabase } from "@/lib/supabase";
import { etiquetaAnioServicio, rangoFechasAnioServicio } from "@/lib/anio-servicio";
import type { Asistencia } from "@/lib/asistencia";

export default function PaginaPdfAsistenciaAnio() {
  const { anio } = useParams<{ anio: string }>();
  const router = useRouter();
  const anioNumero = Number(anio);
  const anioValido = Number.isInteger(anioNumero) && anioNumero >= 2000 && anioNumero <= 2100;

  const [filas, setFilas] = useState<Asistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!anioValido) return;
    let cancelado = false;
    const { desde, hasta } = rangoFechasAnioServicio(anioNumero);
    supabase
      .from("asistencias")
      .select("fecha, total")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelado) return;
        if (err) {
          setError(
            `${err.message}. ¿Pegaste supabase/migracion_v4.sql en el SQL Editor de Supabase?`,
          );
        } else {
          setFilas((data as Asistencia[]) || []);
          setError("");
        }
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [anio, anioNumero, anioValido]);

  return (
    <div className="pagina-pdf mx-auto w-full max-w-[1000px] px-4 py-6">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/secretaria"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
        >
          <ChevronLeft size={16} /> Secretaría
        </Link>
        <button
          onClick={() => window.print()}
          className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal2"
        >
          <Printer size={16} /> Imprimir / Guardar como PDF
        </button>
      </div>

      {!anioValido ? (
        <p className="rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          Año de servicio inválido.
        </p>
      ) : (
        <>
          <h1 className="mb-4 text-lg font-black tracking-tight">
            Asistencia · Año de servicio {etiquetaAnioServicio(anioNumero)}
          </h1>

          {error && (
            <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
              {error}
            </p>
          )}

          {cargando ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-suave">
              <Loader2 size={16} className="animate-spin" /> Cargando...
            </p>
          ) : (
            <TablaAsistenciaAnio filas={filas} anio={anioNumero} paraImprimir />
          )}
        </>
      )}

      <div className="no-print mt-6 flex justify-end">
        <button
          onClick={() => router.push("/secretaria")}
          className="cursor-pointer text-sm font-semibold text-suave hover:text-texto"
        >
          Volver a Secretaría
        </button>
      </div>
    </div>
  );
}