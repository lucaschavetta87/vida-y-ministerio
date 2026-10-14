"use client";

import {
  CICLOS_POR_TERRITORIO,
  type CicloS13,
  type FilaS13,
  fechaCortaS13,
} from "@/lib/s13";

/**
 * La tabla del S-13, tal cual el formulario original:
 * cada territorio ocupa dos filas — arriba las fechas de los 4
 * ciclos, abajo el conductor de cada uno.
 *
 * `editable` la usa el modal (fechas y conductores corregibles);
 * en la hoja imprimible es solo lectura.
 */
export default function TablaS13({
  filas,
  anioServicio,
  className = "",
}: {
  filas: FilaS13[];
  anioServicio?: number;
  className?: string;
}) {
  return (
    <table className={`w-full border-collapse text-[10px] ${className}`}>
      <thead>
        <tr>
          <th
            rowSpan={2}
            className="w-[8%] border-2 border-texto px-1 py-1 font-bold"
          >
            Núm. de terr.
          </th>
          <th
            rowSpan={2}
            className="w-[11%] border-2 border-texto px-1 py-1 font-bold"
          >
            Última fecha en que se completó*
          </th>
          {Array.from({ length: CICLOS_POR_TERRITORIO }, (_, i) => (
            <th key={i} colSpan={2} className="border-2 border-texto px-1 py-1 font-bold">
              Asignado a
            </th>
          ))}
        </tr>
        <tr>
          {Array.from({ length: CICLOS_POR_TERRITORIO }, (_, i) => (
            <FragmentCeldas key={i} />
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <Fila key={fila.numero} fila={fila} anioServicio={anioServicio} />
        ))}
      </tbody>
    </table>
  );
}

/** las dos sub-columnas de un ciclo */
function FragmentCeldas() {
  return (
    <>
      <th className="w-[10.1%] border-2 border-texto px-1 py-1 font-normal leading-tight">
        Fecha en que se asignó
      </th>
      <th className="w-[10.1%] border-2 border-texto px-1 py-1 font-normal leading-tight">
        Fecha en que se completó
      </th>
    </>
  );
}

function Fila({
  fila,
  anioServicio,
}: {
  fila: FilaS13;
  anioServicio?: number;
}) {
  return (
    <>
      {/* fila de fechas */}
      <tr>
        <td
          rowSpan={2}
          className="border-2 border-texto px-1 py-1 text-center align-middle font-bold"
        >
          {fila.numero}
        </td>
        <td
          rowSpan={2}
          className="border-2 border-texto px-1 py-1 text-center align-middle"
        >
          {fechaCortaS13(fila.ultimaCompleto, anioServicio)}
        </td>
        {fila.ciclos.map((ciclo) => (
          <Celda key={`a${ciclo.indice}`} ciclo={ciclo} tipo="asignado" anioServicio={anioServicio} />
        ))}
      </tr>
      {/* fila del conductor */}
      <tr>
        {fila.ciclos.map((ciclo) => (
          <Celda key={`c${ciclo.indice}`} ciclo={ciclo} tipo="conductor" anioServicio={anioServicio} />
        ))}
      </tr>
    </>
  );
}

function Celda({
  ciclo,
  tipo,
  anioServicio,
}: {
  ciclo: CicloS13;
  tipo: "asignado" | "conductor";
  anioServicio?: number;
}) {
  return (
    <td colSpan={2} className="border-2 border-texto px-1 py-1 text-center align-middle">
      {tipo === "asignado" ? (
        <span className="flex items-center justify-center gap-1">
          {fechaCortaS13(ciclo.fechaAsignado, anioServicio) || "—"}
          <span className="text-suave">/</span>
          {fechaCortaS13(ciclo.fechaCompletado, anioServicio) || "—"}
        </span>
      ) : (
        <span className="text-[9px] leading-tight">
          {ciclo.conductor || ""}
          {ciclo.manual && <span className="ml-1 text-teal">•</span>}
        </span>
      )}
    </td>
  );
}