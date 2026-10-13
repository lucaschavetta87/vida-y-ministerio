"use client";

import {
  mesesDelAnioServicio,
  etiquetaAnioServicio,
} from "@/lib/anio-servicio";
import type { Informe } from "@/lib/informes";
import { tieneClasificacion, type Participante } from "@/lib/tipos";

/** Casilla marcada o sin marcar, como en el S-21 impreso. */
function Casilla({ marcada }: { marcada: boolean }) {
  return (
    <span
      aria-hidden
      className={
        "inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center border border-black text-[11px] leading-none " +
        (marcada ? "bg-black" : "bg-white")
      }
    >
      {marcada && <span className="text-[9px] font-bold text-white">✓</span>}
    </span>
  );
}

function fechaLarga(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR");
}

/**
 * Ficha S-21 (Registro de Publicador de la Congregación) de una persona,
 * con los datos cargados del año de servicio elegido.
 */
export default function TarjetaS21({
  participante,
  informes,
  marcas,
  anioServicio,
}: {
  participante: Participante;
  /** Informes de los 12 meses del año de servicio. */
  informes: Informe[];
  /** Meses cargados en otra web (se marcan igual que un informe). */
  marcas: { mes: string }[];
  anioServicio: number;
}) {
  const meses = mesesDelAnioServicio(anioServicio);
  const porMes = new Map(informes.map((i) => [i.mes, i]));
  const marcados = new Set(marcas.map((m) => m.mes));

  const filas = meses.map((mes) => {
    const inf = porMes.get(mes.clave) || null;
    const participo = Boolean(inf) || marcados.has(mes.clave);
    return {
      clave: mes.clave,
      nombre: mes.corto === "Ago" ? "Agosto" : mes.etiqueta.split(" ")[0],
      participo,
      cursos: inf ? inf.estudios_biblicos : null,
      auxiliar: inf?.tipo === "AUXILIAR",
      horas: inf?.horas ?? null,
      notas: inf?.observaciones || "",
    };
  });

  const totalHoras = filas.reduce((s, f) => s + (f.horas ?? 0), 0);
  const ungido = participante.tipo_bautizado === "UNGIDO";

  return (
    <article className="s21 mx-auto w-full max-w-[780px] bg-white p-2 text-black">
      <header className="mb-3 text-center">
        <h1 className="text-[15px] font-bold tracking-wide uppercase">
          Registro de publicador de la congregación
        </h1>
      </header>

      <section className="mb-1 space-y-1 text-[11px]">
        <p className="flex gap-2">
          <span className="font-bold">Nombre:</span>
          <span className="border-b border-black/70 px-1">
            {participante.nombre_completo}
          </span>
        </p>
        <p className="flex items-center gap-3">
          <span className="font-bold">Fecha de nacimiento:</span>
          <span className="border-b border-black/70 px-1">
            {fechaLarga(participante.fecha_nacimiento)}
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Casilla marcada={participante.genero === "HOMBRE"} /> Hombre
            </span>
            <span className="flex items-center gap-1">
              <Casilla marcada={participante.genero === "MUJER"} /> Mujer
            </span>
          </span>
        </p>
        <p className="flex items-center gap-3">
          <span className="font-bold">Fecha de bautismo:</span>
          <span className="border-b border-black/70 px-1">
            {fechaLarga(participante.fecha_bautismo)}
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Casilla marcada={!ungido} /> Otras ovejas
            </span>
            <span className="flex items-center gap-1">
              <Casilla marcada={ungido} /> Ungido
            </span>
          </span>
        </p>
      </section>

      <section className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="flex items-center gap-1">
          <Casilla marcada={tieneClasificacion(participante, "ANCIANO")} /> Anciano
        </span>
        <span className="flex items-center gap-1">
          <Casilla marcada={tieneClasificacion(participante, "SIERVO_MINISTERIAL")} />
          Siervo ministerial
        </span>
        <span className="flex items-center gap-1">
          <Casilla marcada={tieneClasificacion(participante, "PRECURSOR_REGULAR")} />
          Precursor regular
        </span>
        <span className="flex items-center gap-1">
          <Casilla marcada={tieneClasificacion(participante, "PRECURSOR_ESPECIAL")} />
          Precursor especial
        </span>
        <span className="flex items-center gap-1">
          <Casilla marcada={false} /> Misionero que sirve en el campo
        </span>
      </section>

      <section className="mb-1 flex flex-wrap items-baseline gap-x-3 text-[11px]">
        <span className="font-bold">Contacto de emergencia:</span>
        <span className="border-b border-black/70 px-1">
          {participante.contacto_emergencia_nombre || "—"}
        </span>
        <span className="font-bold">Contacto:</span>
        <span className="border-b border-black/70 px-1">
          {participante.contacto_emergencia_telefono || "—"}
        </span>
      </section>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="w-[22%] border border-black px-2 py-1.5 text-left align-bottom font-bold">
              Año de servicio
              <br />
              <span className="text-[13px]">{etiquetaAnioServicio(anioServicio)}</span>
            </th>
            <th className="w-[16%] border border-black px-2 py-1.5 text-center align-bottom font-bold">
              Participación
              <br />
              en el ministerio
            </th>
            <th className="w-[12%] border border-black px-2 py-1.5 text-center align-bottom font-bold">
              Cursos
              <br />
              bíblicos
            </th>
            <th className="w-[13%] border border-black px-2 py-1.5 text-center align-bottom font-bold">
              Precursor
              <br />
              auxiliar
            </th>
            <th className="w-[16%] border border-black px-2 py-1.5 text-center align-bottom font-bold">
              Horas
              <br />
              <span className="font-normal normal-case">
                (si es precursor o misionero que sirve en el campo)
              </span>
            </th>
            <th className="w-[21%] border border-black px-2 py-1.5 text-left align-bottom font-bold">
              Notas
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave} className="odd:bg-black/[0.03]">
              <td className="border border-black px-2 py-[3px]">{f.nombre}</td>
              <td className="border border-black px-2 py-[3px] text-center">
                <Casilla marcada={f.participo} />
              </td>
              <td className="border border-black px-2 py-[3px] text-center">
                {f.cursos === null || f.cursos === 0 ? "" : f.cursos}
              </td>
              <td className="border border-black px-2 py-[3px] text-center">
                <Casilla marcada={f.auxiliar} />
              </td>
              <td className="border border-black px-2 py-[3px] text-center">
                {f.horas === null ? "" : f.horas}
              </td>
              <td className="border border-black px-2 py-[3px] text-[10px]">{f.notas}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="border border-black px-2 py-1 text-right font-bold">
              Total
            </td>
            <td className="border border-black px-2 py-1 text-center font-bold">{totalHoras}</td>
            <td className="border border-black" />
          </tr>
        </tbody>
      </table>

      <footer className="mt-6 text-[9px] text-black/70">S-21 11/23</footer>
    </article>
  );
}