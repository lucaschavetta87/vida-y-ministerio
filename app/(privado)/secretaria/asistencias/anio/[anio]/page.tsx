"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  diaSiguienteMes,
  numeroPromedio,
  resumenPorMes,
  type Asistencia,
  type ResumenManual,
  type TipoReunion,
} from "@/lib/asistencia";
import {
  etiquetaAnioServicio,
  mesesDelAnioServicio,
  rangoAnioServicio,
} from "@/lib/anio-servicio";

const TIPOS: { clave: TipoReunion; titulo: string }[] = [
  { clave: "entre-semana", titulo: "Reunión de entre semana" },
  { clave: "fin-de-semana", titulo: "Reunión del fin de semana" },
];

/** Una columna del S-88: un año de servicio completo. */
function Columna({
  anio,
  tipo,
  filas,
  manuales,
}: {
  anio: number;
  tipo: TipoReunion;
  filas: Pick<Asistencia, "fecha" | "total">[];
  manuales: ResumenManual[];
}) {
  const meses = mesesDelAnioServicio(anio);
  const resumen = useMemo(
    () => resumenPorMes(filas, meses.map((m) => ({ clave: m.clave, etiqueta: m.corto })), manuales),
    [filas, meses, manuales],
  );

  const columna: {
    reuniones: "reunionesEntreSemana" | "reunionesFinSemana";
    total: "totalEntreSemana" | "totalFinSemana";
    promedio: "promedioEntreSemana" | "promedioFinSemana";
  } =
    tipo === "entre-semana"
      ? {
          reuniones: "reunionesEntreSemana",
          total: "totalEntreSemana",
          promedio: "promedioEntreSemana",
        }
      : {
          reuniones: "reunionesFinSemana",
          total: "totalFinSemana",
          promedio: "promedioFinSemana",
        };

  const conReunion = resumen.meses.filter((m) => m[columna.reuniones] > 0);
  const promedioAnual = conReunion.length
    ? conReunion.reduce((s, m) => s + m[columna.promedio], 0) / conReunion.length
    : 0;

  return (
    <table className="w-full border-collapse text-[9px]">
      <thead>
        <tr>
          <th className="w-[30%] border border-black px-1 py-1 text-left align-bottom font-bold">
            Año de servicio
            <br />
            <span className="text-[10px]">{etiquetaAnioServicio(anio)}</span>
          </th>
          <th className="w-[20%] border border-black px-1 py-1 text-center align-bottom font-bold">
            Número de
            <br />
            reuniones
          </th>
          <th className="w-[24%] border border-black px-1 py-1 text-center align-bottom font-bold">
            Asistencia
            <br />
            total
          </th>
          <th className="w-[26%] border border-black px-1 py-1 text-center align-bottom font-bold">
            Promedio de
            <br />
            asistencia semanal
          </th>
        </tr>
      </thead>
      <tbody>
        {resumen.meses.map((m) => {
          const reuniones = m[columna.reuniones];
          return (
            <tr key={m.mes}>
              <td className="border border-black px-1 py-[2px]">{m.etiqueta}</td>
              <td className="border border-black px-1 py-[2px] text-center">{reuniones}</td>
              <td className="border border-black px-1 py-[2px] text-center">{m[columna.total]}</td>
              <td className="border border-black px-1 py-[2px] text-center">
                {reuniones === 0 ? "" : numeroPromedio(m[columna.promedio])}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td
            colSpan={3}
            className="border border-black px-1 py-1 text-right font-bold whitespace-nowrap"
          >
            Promedio de asistencia mensual
          </td>
          <td className="border border-black px-1 py-1 text-center font-bold">
            {numeroPromedio(promedioAnual)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * S-88: registro de asistencia a las reuniones, con el año de servicio
 * anterior y el actual lado a lado.
 */
export default function PaginaPdfAsistenciaAnio() {
  const { anio } = useParams<{ anio: string }>();
  const router = useRouter();
  const anioNumero = Number(anio);
  const anioValido = Number.isInteger(anioNumero) && anioNumero >= 2000 && anioNumero <= 2100;
  const anioAnterior = anioValido ? anioNumero - 1 : 0;

  const [filas, setFilas] = useState<Pick<Asistencia, "fecha" | "total">[]>([]);
  const [manuales, setManuales] = useState<ResumenManual[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!anioValido) return;
    let cancelado = false;
    const rango = rangoAnioServicio(anioAnterior);
    const rangoActual = rangoAnioServicio(anioNumero);
    Promise.all([
      supabase
        .from("asistencias")
        .select("fecha, total")
        .gte("fecha", `${rango.desde}-01`)
        .lt("fecha", diaSiguienteMes(rangoActual.hasta))
        .order("fecha", { ascending: true }),
      supabase
        .from("asistencias_resumen")
        .select("*")
        .gte("mes", rango.desde)
        .lte("mes", rangoActual.hasta),
    ]).then(([a, r]) => {
      if (cancelado) return;
      if (a.error && /asistencias_resumen|does not exist/i.test(a.error.message)) {
        setError("Falta la tabla de resúmenes: pegá supabase/migracion_v9.sql en Supabase.");
        setCargando(false);
        return;
      }
      setFilas((a.data as Pick<Asistencia, "fecha" | "total">[]) || []);
      setManuales((r.data as ResumenManual[]) || []);
      setError(r.error?.message || "");
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [anio, anioNumero, anioAnterior, anioValido]);

  const delAnio = (a: number) => {
    const { desde, hasta } = rangoAnioServicio(a);
    return {
      filas: filas.filter((f) => f.fecha.slice(0, 7) >= desde && f.fecha.slice(0, 7) <= hasta),
      manuales: manuales.filter((m) => m.mes >= desde && m.mes <= hasta),
    };
  };

  const previo = delAnio(anioAnterior);
  const actual = delAnio(anioNumero);

  return (
    <div className="pagina-pdf mx-auto w-full max-w-[1100px] px-4 py-6">
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
          <header className="mb-4 text-center">
            <h1 className="text-[15px] font-bold tracking-wide uppercase">
              Registro de asistencia a las reuniones de congregación
            </h1>
            <p className="text-[10px] text-suave">
              ESTE LAS HERAS · generado el {new Date().toLocaleDateString("es-AR")}
            </p>
          </header>

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
            <div className="flex flex-col gap-8">
              {TIPOS.map((tipo) => (
                <section key={tipo.clave}>
                  <h2 className="mb-1 text-[11px] font-bold">{tipo.titulo}</h2>
                  <div className="grid grid-cols-2 gap-6">
                    <Columna
                      anio={anioAnterior}
                      tipo={tipo.clave}
                      filas={previo.filas}
                      manuales={previo.manuales}
                    />
                    <Columna
                      anio={anioNumero}
                      tipo={tipo.clave}
                      filas={actual.filas}
                      manuales={actual.manuales}
                    />
                  </div>
                </section>
              ))}
            </div>
          )}

          <footer className="mt-6 text-[9px] text-suave">
            Promedio de asistencia semanal = asistencia total del mes ÷ número de reuniones del
            mes. Promedio de asistencia mensual = promedio de los promedios semanales de los meses
            con reuniones. Los meses cargados a mano usan el total anotado en la app.
          </footer>
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
;
