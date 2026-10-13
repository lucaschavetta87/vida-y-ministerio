"use client";

import { useMemo } from "react";
import { CalendarDays, Sun } from "lucide-react";
import { Etiqueta } from "@/components/ui";
import {
  numeroPromedio,
  resumenPorMes,
  type Asistencia,
  type ResumenAnioServicio,
  type TipoReunion,
} from "@/lib/asistencia";
import {
  etiquetaAnioServicio,
  mesesDelAnioServicio,
  rangoLegible,
} from "@/lib/anio-servicio";

type Tono = "neutro" | "teal" | "verde";

/** Los datos de un solo tipo de reunión, mes a mes. */
interface DatosTipo {
  clave: TipoReunion;
  titulo: string;
  meetings: "reunionesEntreSemana" | "reunionesFinSemana";
  total: "totalEntreSemana" | "totalFinSemana";
  promedio: "promedioEntreSemana" | "promedioFinSemana";
  tono: Tono;
}

const TIPOS: DatosTipo[] = [
  {
    clave: "entre-semana",
    titulo: "Reuniones de entre semana",
    meetings: "reunionesEntreSemana",
    total: "totalEntreSemana",
    promedio: "promedioEntreSemana",
    tono: "teal",
  },
  {
    clave: "fin-de-semana",
    titulo: "Reuniones de fin de semana",
    meetings: "reunionesFinSemana",
    total: "totalFinSemana",
    promedio: "promedioFinSemana",
    tono: "verde",
  },
];

/**
 * Lista de asistencia de un año de servicio (septiembre a agosto), en dos
 * cuadros: entre semana y fin de semana. Solo números: la asistencia no se
 * vincula a ninguna persona de la congregación.
 */
export default function TablaAsistenciaAnio({
  filas,
  anio,
  paraImprimir = false,
}: {
  /** Cargas de asistencia del año de servicio. */
  filas: Pick<Asistencia, "fecha" | "total">[];
  anio: number;
  /** Versión para el PDF: sin tarjetas ni bordes redondeados. */
  paraImprimir?: boolean;
}) {
  const meses = useMemo(() => mesesDelAnioServicio(anio), [anio]);
  const resumen: ResumenAnioServicio = useMemo(
    () => resumenPorMes(filas, meses.map((m) => ({ clave: m.clave, etiqueta: m.corto }))),
    [filas, meses],
  );

  /** Un cuadro por tipo de reunión. */
  const cuadro = (tipo: DatosTipo) => {
    const totalReuniones = resumen[tipo.meetings] as number;
    const totalAsistencia = resumen[tipo.total] as number;
    const promedioAnual =
      tipo.clave === "entre-semana"
        ? resumen.promedioAnualEntreSemana
        : resumen.promedioAnualFinSemana;

    return (
      <section key={tipo.clave} className={paraImprimir ? "break-inside-avoid" : ""}>
        <div
          className={
            paraImprimir
              ? "mb-2 flex items-center justify-between border-b border-teal pb-1"
              : "mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-linea pb-2"
          }
        >
          <h3 className="text-sm font-black tracking-tight">{tipo.titulo}</h3>
          {!paraImprimir && (
            <div className="flex flex-wrap items-center gap-2">
              <Etiqueta tono={tipo.tono}>Reuniones: {totalReuniones}</Etiqueta>
              <Etiqueta tono="neutro">Asistencia total: {totalAsistencia}</Etiqueta>
              <Etiqueta tono="neutro">
                Promedio del año: {numeroPromedio(promedioAnual)}
              </Etiqueta>
            </div>
          )}
          {paraImprimir && (
            <p className="text-[11px] text-suave">
              <strong>{totalReuniones}</strong> reuniones · asistencia total{" "}
              <strong>{totalAsistencia}</strong> · promedio del año (promedio de los promedios
              mensuales) <strong>{numeroPromedio(promedioAnual)}</strong>
            </p>
          )}
        </div>
        <table
          className={
            paraImprimir
              ? "w-full border-collapse text-[11px]"
              : "w-full min-w-[560px] text-sm"
          }
        >
          <thead>
            <tr className="border-b border-linea text-left text-[11px] tracking-widest text-suave uppercase">
              <th className="px-4 py-2.5 font-bold">Mes</th>
              <th className="px-4 py-2.5 text-right font-bold">Nº de reuniones</th>
              <th className="px-4 py-2.5 text-right font-bold">Asistencia total</th>
              <th className="px-4 py-2.5 text-right font-bold">Promedio por reunión</th>
            </tr>
          </thead>
          <tbody>
            {resumen.meses.map((m) => {
              const reuniones = m[tipo.meetings] as number;
              const total = m[tipo.total] as number;
              const promedio = m[tipo.promedio] as number;
              return (
                <tr
                  key={m.mes}
                  className={
                    "border-b border-linea/60 last:border-0 " +
                    (paraImprimir ? "odd:bg-tarjeta2/40" : "") +
                    (reuniones === 0 ? "opacity-45" : "")
                  }
                >
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap capitalize">
                    {m.etiqueta}
                  </td>
                  <td className="px-4 py-2.5 text-right">{reuniones}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{total}</td>
                  <td className="px-4 py-2.5 text-right font-black text-teal">
                    {reuniones === 0 ? "—" : numeroPromedio(promedio)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-linea font-black">
              <td className="px-4 py-3 uppercase tracking-widest text-suave">Año de servicio</td>
              <td className="px-4 py-3 text-right">{totalReuniones}</td>
              <td className="px-4 py-3 text-right text-teal">{totalAsistencia}</td>
              <td className="px-4 py-3 text-right text-teal">{numeroPromedio(promedioAnual)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    );
  };

  if (paraImprimir) {
    return (
      <>
        <header className="mb-4 border-b-2 border-teal pb-3">
          <h1 className="text-xl font-black tracking-tight">
            Asistencia · Año de servicio {etiquetaAnioServicio(anio)}
          </h1>
          <p className="text-xs text-suave">
            ESTE LAS HERAS · {rangoLegible(anio)} · generado el{" "}
            {new Date().toLocaleDateString("es-AR")}
          </p>
          <p className="mt-1 text-xs text-suave">
            Todas las reuniones: <strong>{resumen.totalReuniones}</strong> · Asistencia total:{" "}
            <strong>{resumen.totalAsistencia}</strong> · Promedio del año:{" "}
            <strong>{numeroPromedio(resumen.promedioAnual)}</strong>
          </p>
        </header>
        <div className="flex flex-col gap-6">
          {TIPOS.map(cuadro)}
        </div>
        <footer className="mt-4 border-t border-linea pt-3 text-[10px] text-suave">
          Asistencia total = asistentes en auditorio + asistentes por Zoom (no se discrimina el
          medio). Promedio por reunión = asistencia total del mes ÷ número de reuniones de ese tipo
          de reunión en el mes. Promedio del año = promedio de los promedios de cada mes con
          reuniones.
        </footer>
      </>
    );
  }

  const totalTipo = (tipo: DatosTipo) => resumen[tipo.meetings] as number;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black tracking-tight">
            Asistencia · Año de servicio {etiquetaAnioServicio(anio)}
          </h2>
          <p className="text-xs text-suave">{rangoLegible(anio)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta tono="neutro">
            <CalendarDays size={12} /> Reuniones: {resumen.totalReuniones}
          </Etiqueta>
          <Etiqueta tono="verde">Asistencia total: {resumen.totalAsistencia}</Etiqueta>
          <Etiqueta tono="neutro">
            Promedio del año: {numeroPromedio(resumen.promedioAnual)}
          </Etiqueta>
        </div>
      </div>
      <p className="mb-4 text-xs text-suave">
        Entre semana y fin de semana van por separado. El promedio del año es el promedio de los
        promedios de cada mes. Se actualiza solo con cada carga de asistencia, no hay que esperar a
        fin de mes.
      </p>
      <div className="flex flex-col gap-6">
        {TIPOS.map((tipo) => (
          <div key={tipo.clave}>
            <div className="mb-1 flex items-center gap-2 text-suave">
              {tipo.clave === "entre-semana" ? (
                <CalendarDays size={14} />
              ) : (
                <Sun size={14} />
              )}
              <span className="text-[11px] tracking-widest uppercase">
                {tipo.clave === "entre-semana"
                  ? "Lunes a sábado"
                  : "Domingos"}
                {totalTipo(tipo) === 0 ? " · sin reuniones cargadas" : ""}
              </span>
            </div>
            <div className="overflow-x-auto">{cuadro(tipo)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}