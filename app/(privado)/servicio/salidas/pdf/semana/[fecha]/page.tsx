"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CONFIG_POR_DEFECTO,
  type ConfigSalidas,
  type SalidaMinisterio,
} from "@/lib/territorios";
import {
  diasDeSemana,
  fechaTabla,
  inicioDeSemana,
  moverDias,
  planillaDeSemana,
  rangoDeSemana,
} from "@/lib/planilla";
import type { Participante } from "@/lib/tipos";

/** La planilla de una semana: portada + tabla, como la de salidas.jpeg. */
export default function PdfSalidasSemana() {
  const { fecha } = useParams<{ fecha: string }>();
  const router = useRouter();
  const clave = typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : "";

  const [salidas, setSalidas] = useState<SalidaMinisterio[]>([]);
  const [config, setConfig] = useState<ConfigSalidas>(CONFIG_POR_DEFECTO);
  const [conductores, setConductores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clave) return;
    let cancelado = false;
    const dias = diasDeSemana(clave);
    Promise.all([
      supabase
        .from("salidas_ministerio")
        .select("*")
        .gte("fecha", dias[0])
        .lte("fecha", dias[6])
        .order("fecha", { ascending: true }),
      supabase
        .from("salidas_ministerio_config")
        .select("*")
        .eq("id", true)
        .maybeSingle(),
      supabase.from("participantes").select("id, nombre_completo"),
    ]).then(([s, c, p]) => {
      if (cancelado) return;
      setSalidas((s.data as SalidaMinisterio[]) || []);
      if (c.data) setConfig(c.data as ConfigSalidas);
      const mapa: Record<string, string> = {};
      ((p.data as Participante[]) || []).forEach((x) => {
        mapa[x.id] = x.nombre_completo;
      });
      setConductores(mapa);
      setError(s.error?.message || c.error?.message || "");
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [clave]);

  /** Los 7 días de la semana; solo los que tienen algo cargado se imprimen. */
  const dias = useMemo(
    () =>
      planillaDeSemana(salidas, clave).filter(
        (d) => d.notas.length > 0 || d.salidas.length > 0,
      ),
    [salidas, clave],
  );

  const nombreDe = (fila: SalidaMinisterio) => {
    if (fila.conductor_texto) return fila.conductor_texto;
    if (fila.conductor_id) return conductores[fila.conductor_id] || "—";
    return "—";
  };

  const enMayusculas = (texto: string | null | undefined) => (texto || "").toUpperCase();

  if (!clave)
    return (
      <div className="p-6 text-rojo">Semana inválida.</div>
    );

  const rango = config.rango?.trim() || rangoDeSemana(clave);

  return (
    <div className="pagina-pdf mx-auto w-full max-w-[1100px]">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/servicio"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
        >
          <ChevronLeft size={16} /> Servicio
        </Link>
        <a
          href={`/servicio/salidas/pdf/semana/${moverDias(inicioDeSemana(clave), -7)}`}
          target="_blank"
          className="text-sm font-semibold text-suave hover:text-teal"
        >
          Semana anterior
        </a>
        <a
          href={`/servicio/salidas/pdf/semana/${moverDias(inicioDeSemana(clave), 7)}`}
          target="_blank"
          className="text-sm font-semibold text-suave hover:text-teal"
        >
          Semana siguiente
        </a>
        <button
          onClick={() => window.print()}
          className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal2"
        >
          <Printer size={16} /> Imprimir / Guardar como PDF
        </button>
      </div>

      {cargando ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-suave">
          <Loader2 size={16} className="animate-spin" /> Cargando...
        </p>
      ) : (
        <article className="mx-auto max-w-[1000px]">
          {/* -------- portada -------- */}
          <header className="px-6 py-7 text-white" style={{ background: config.color_fondo }}>
            <div className="flex items-center gap-6">
              <div className="flex-1 text-center">
                {config.titulo && (
                  <p
                    className="text-xl font-light tracking-wide opacity-95 italic"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    {config.titulo}
                  </p>
                )}
                <h1
                  className="text-5xl leading-tight font-light tracking-wide"
                  style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
                >
                  {config.subtitulo}
                </h1>
                <p className="mt-1 text-lg font-semibold tracking-wide uppercase">{rango}</p>
              </div>
              {config.encabezado_imagen && (
                <img
                  src={config.encabezado_imagen}
                  alt=""
                  className="max-h-36 shrink-0 object-contain"
                />
              )}
            </div>
          </header>

          {/* -------- tabla -------- */}
          {error && (
            <p className="mt-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
              {error}
            </p>
          )}

          {dias.length === 0 ? (
            <p className="py-10 text-center text-sm text-suave">
              No hay salidas cargadas en esta semana.
            </p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-white" style={{ background: config.color_tabla }}>
                  <th className="w-[14%] px-3 py-2 text-left font-bold tracking-wide uppercase">
                    Fecha
                  </th>
                  <th className="w-[10%] px-3 py-2 text-left font-bold tracking-wide uppercase">
                    Hora
                  </th>
                  <th className="w-[32%] px-3 py-2 text-center font-bold tracking-wide uppercase">
                    Ubicación
                  </th>
                  <th className="w-[20%] px-3 py-2 text-center font-bold tracking-wide uppercase">
                    Conductor
                  </th>
                  <th className="w-[24%] px-3 py-2 text-center font-bold tracking-wide uppercase">
                    Territorio
                  </th>
                </tr>
              </thead>
              <tbody>
                {dias.map((dia, i) => (
                  <Fragment key={dia.fecha}>
                    {dia.notas.map((nota) => (
                      <tr
                        key={nota.id}
                        className="border-b border-linea"
                        style={{ background: i % 2 ? config.color_fila_b : config.color_fila_a }}
                      >
                        <td
                          colSpan={5}
                          className="px-3 py-2.5 text-center text-[15px] font-bold tracking-wide uppercase"
                        >
                          {enMayusculas(nota.notas) || "—"}
                        </td>
                      </tr>
                    ))}

                    {dia.salidas.map((fila, j) => (
                      <tr
                        key={fila.id}
                        className="border-b border-linea"
                        style={{ background: i % 2 ? config.color_fila_b : config.color_fila_a }}
                      >
                        {j === 0 && (
                          <td
                            rowSpan={dia.salidas.length}
                            className="px-3 py-2 align-middle font-bold tracking-wide whitespace-nowrap uppercase"
                          >
                            {fechaTabla(dia.fecha)}
                          </td>
                        )}
                        <td className="px-3 py-2 font-bold whitespace-nowrap">{fila.hora || "—"}</td>
                        <td className="px-3 py-2 text-center font-bold uppercase">
                          {enMayusculas(fila.ubicacion)}
                        </td>
                        <td className="px-3 py-2 text-center font-bold whitespace-nowrap uppercase">
                          {nombreDe(fila)}
                        </td>
                        <td className="px-3 py-2 text-center font-bold whitespace-nowrap">
                          {fila.tipo === "TELEFONICA" ? (
                            <span className="tracking-wide uppercase">Telefónica</span>
                          ) : (
                            fila.territorios || "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          <footer className="mt-3 text-[10px] text-suave">
            Planilla de la semana del {rango.toLowerCase()} · generado el{" "}
            {new Date().toLocaleDateString("es-AR")}
          </footer>
        </article>
      )}

      <div className="no-print mt-6 flex justify-end">
        <button
          onClick={() => router.push("/servicio")}
          className="cursor-pointer text-sm font-semibold text-suave hover:text-texto"
        >
          Volver a Servicio
        </button>
      </div>
    </div>
  );
}