"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  diaDeSemana,
  diaSiguienteMes,
  fechaCorta,
  fechaLarga,
  resumenPorDia,
  type Asistencia,
} from "@/lib/asistencia";
import { esClaveMes, etiquetaMes } from "@/lib/informes";

export default function PaginaPdfAsistencias() {
  const { mes } = useParams<{ mes: string }>();
  const router = useRouter();
  const [filas, setFilas] = useState<Asistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const mesValido = esClaveMes(mes);
  const errorMostrar = mesValido ? error : "Mes inválido.";

  useEffect(() => {
    if (!mesValido) return;
    let cancelado = false;
    supabase
      .from("asistencias")
      .select("*")
      .gte("fecha", `${mes}-01`)
      .lt("fecha", diaSiguienteMes(mes))
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
  }, [mes, mesValido]);

  const resumen = useMemo(() => resumenPorDia(filas), [filas]);
  const promedio = resumen.diasConReunion
    ? Math.round(resumen.totalMes / resumen.diasConReunion)
    : 0;

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

      <header className="mb-4 border-b-2 border-teal pb-3">
        <h1 className="text-xl font-black tracking-tight">
          Asistencias a las reuniones · {etiquetaMes(mes)}
        </h1>
        <p className="text-xs text-suave">
          ESTE LAS HERAS · {resumen.diasConReunion}{" "}
          {resumen.diasConReunion === 1 ? "reunión" : "reuniones"} · generado el{" "}
          {new Date().toLocaleDateString("es-AR")}
        </p>
        <p className="mt-1 text-xs text-suave">
          Total de asistentes: <strong>{resumen.totalMes}</strong> · Auditorio:{" "}
          <strong>{resumen.totalAuditorio}</strong> · Zoom: <strong>{resumen.totalZoom}</strong> ·
          Promedio por reunión: <strong>{promedio}</strong>
          {resumen.mejorDia && (
            <>
              {" "}
              · Día con más asistencia:{" "}
              <strong>
                {fechaCorta(resumen.mejorDia.fecha)} ({resumen.mejorDia.total})
              </strong>
            </>
          )}
        </p>
      </header>

      {errorMostrar && (
        <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {errorMostrar}
        </p>
      )}

      {!errorMostrar &&
        (cargando ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-suave">
            <Loader2 size={16} className="animate-spin" /> Cargando...
          </p>
        ) : resumen.dias.length === 0 ? (
          <p className="py-10 text-center text-sm text-suave">
            No hay asistencias cargadas para {etiquetaMes(mes)}.
          </p>
        ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-tarjeta2">
              <th className="border border-linea px-2 py-2 text-left">Día</th>
              <th className="border border-linea px-2 py-2 text-left">Fecha</th>
              <th className="border border-linea px-2 py-2">Auditorio</th>
              <th className="border border-linea px-2 py-2">Zoom</th>
              <th className="border border-linea px-2 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {resumen.dias.map((d) => (
              <tr key={d.fecha} className="break-inside-avoid odd:bg-tarjeta2/40">
                <td className="border border-linea px-2 py-1.5 capitalize">
                  {diaDeSemana(d.fecha)}
                </td>
                <td className="border border-linea px-2 py-1.5">{fechaLarga(d.fecha)}</td>
                <td className="border border-linea px-2 py-1.5 text-center">{d.auditorio}</td>
                <td className="border border-linea px-2 py-1.5 text-center">{d.zoom}</td>
                <td className="border border-linea px-2 py-1.5 text-center font-black">
                  {d.total}
                </td>
              </tr>
            ))}
            <tr className="bg-tarjeta2 font-black">
              <td className="border border-linea px-2 py-2" colSpan={2}>
                TOTALES ({resumen.diasConReunion}{" "}
                {resumen.diasConReunion === 1 ? "reunión" : "reuniones"})
              </td>
              <td className="border border-linea px-2 py-2 text-center">
                {resumen.totalAuditorio}
              </td>
              <td className="border border-linea px-2 py-2 text-center">{resumen.totalZoom}</td>
              <td className="border border-linea px-2 py-2 text-center">
                {resumen.totalMes}
              </td>
            </tr>
          </tbody>
        </table>
        ))}

      <footer className="mt-4 border-t border-linea pt-3 text-[10px] text-suave">
        Total del día = asistentes en auditorio + asistentes por Zoom. Si un mismo día hubo más de
        una carga, los números de ese día están sumados.
      </footer>

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
