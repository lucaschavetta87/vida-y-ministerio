"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Printer,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  MESES_CORTO,
  claveMes,
  etiquetaMes,
  mesAnterior,
  type Informe,
  type MarcaInforme,
} from "@/lib/informes";
import type { Participante } from "@/lib/tipos";

/** Qué se imprime en la celda de cada mes. */
function celda(inf: Informe | null, marcada: boolean): { texto: string; clase: string } {
  if (inf) {
    if (inf.tipo === "PUBLICADOR") {
      return inf.participo
        ? { texto: "Sí", clase: "text-verde font-bold" }
        : { texto: "No", clase: "text-suave" };
    }
    if (inf.tipo === "AUXILIAR") {
      return {
        texto: `${inf.horas ?? "—"}${inf.horas_meta ? `·${inf.horas_meta}` : ""}`,
        clase: "text-teal font-bold",
      };
    }
    return { texto: String(inf.horas ?? "—"), clase: "text-teal font-bold" };
  }
  if (marcada) return { texto: "✓ otra", clase: "text-verde" };
  return { texto: "—", clase: "text-suave/50" };
}

export default function PdfActividadAnual() {
  const router = useRouter();
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [anios, setAnios] = useState<number[]>([anioActual]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [informes, setInformes] = useState<Informe[]>([]);
  const [marcas, setMarcas] = useState<MarcaInforme[]>([]);
  const [filtro, setFiltro] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    const desde = `${anio}-01`;
    const hasta = `${anio}-12`;
    Promise.all([
      supabase.from("participantes").select("*").order("nombre_completo"),
      supabase.from("informes").select("*").gte("mes", desde).lte("mes", hasta),
      supabase.from("marcas_informe").select("*").gte("mes", desde).lte("mes", hasta),
      supabase.from("informes").select("mes"),
    ]).then(([p, i, m, todos]) => {
      if (cancelado) return;
      if (p.error || i.error) {
        setError(`No se pudo leer la información: ${(p.error || i.error)?.message}`);
        setCargando(false);
        return;
      }
      setParticipantes((p.data as Participante[]) || []);
      setInformes((i.data as Informe[]) || []);
      setMarcas((m.data as MarcaInforme[]) || []);
      const aniosConDatos = new Set<number>([anioActual]);
      ((todos.data as { mes: string }[]) || []).forEach((r) => {
        const a = Number(r.mes.slice(0, 4));
        if (a) aniosConDatos.add(a);
      });
      setAnios([...aniosConDatos].sort((a, b) => b - a));
      setError("");
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [anio, anioActual]);

  const filas = useMemo(() => {
    const infPorMes = new Map<string, Informe>();
    informes.forEach((i) => infPorMes.set(`${i.participante_id}|${i.mes}`, i));
    const marcasPorMes = new Set(marcas.map((m) => `${m.participante_id}|${m.mes}`));
    const ultimo = mesAnterior();
    const conDatos = new Set<string>([...infPorMes.keys()].map((k) => k.split("|")[0]));
    marcas.forEach((m) => conDatos.add(m.participante_id));

    return participantes
      // los que no están tildados como "Es publicador" solo se ven si tienen datos
      .filter((p) => p.es_publicador !== false || conDatos.has(p.id))
      .filter((p) => p.activo || infPorMes.size > 0)
      .filter((p) =>
        filtro ? p.nombre_completo.toLowerCase().includes(filtro.toLowerCase()) : true,
      )
      .map((p) => {
        const celdas = MESES_CORTO.map((corto, indice) => {
          const clave = claveMes(anio, indice);
          return {
            corto,
            clave,
            ...celda(
              infPorMes.get(`${p.id}|${clave}`) || null,
              marcasPorMes.has(`${p.id}|${clave}`),
            ),
          };
        });
        const propios = informes.filter((i) => i.participante_id === p.id);
        return {
          participante: p,
          celdas,
          horas: propios.reduce((s, i) => s + (i.horas ?? 0), 0),
          estudios: propios.reduce((s, i) => s + (i.estudios_biblicos ?? 0), 0),
          informados: celdas.filter((c) => c.texto !== "—").length,
          irregular:
            p.es_publicador !== false &&
            !infPorMes.has(`${p.id}|${ultimo}`) &&
            !marcasPorMes.has(`${p.id}|${ultimo}`),
        };
      });
  }, [participantes, informes, marcas, anio, filtro]);

  const totales = useMemo(
    () => ({
      horas: filas.reduce((s, f) => s + f.horas, 0),
      estudios: filas.reduce((s, f) => s + f.estudios, 0),
      irregulares: filas.filter((f) => f.irregular).length,
    }),
    [filas],
  );

  return (
    <div className="pagina-pdf mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/secretaria"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
        >
          <ChevronLeft size={16} /> Secretaría
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-suave"
            />
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar nombre"
              className="w-56 rounded-xl border border-linea bg-tarjeta2 py-2 pr-3 pl-9 text-sm outline-none focus:border-teal"
            />
          </div>
          <select
            value={anio}
            onChange={(e) => {
              setCargando(true);
              setAnio(Number(e.target.value));
            }}
            className="cursor-pointer rounded-xl border border-linea bg-tarjeta2 px-3 py-2 text-sm outline-none focus:border-teal"
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal2"
          >
            <Printer size={16} /> Imprimir / Guardar como PDF
          </button>
        </div>
      </div>

      <header className="mb-4 border-b-2 border-teal pb-3">
        <h1 className="text-xl font-black tracking-tight">
          Informe de actividad · {anio}
        </h1>
        <p className="text-xs text-suave">
          ESTE LAS HERAS · {filas.length} personas · generado el{" "}
          {new Date().toLocaleDateString("es-AR")}
        </p>
        <p className="mt-1 text-xs text-suave">
          Total de horas: <strong>{totales.horas}</strong> · Total de estudios bíblicos:{" "}
          <strong>{totales.estudios}</strong> · Sin informe de {etiquetaMes(mesAnterior())}:{" "}
          <strong>{totales.irregulares}</strong>
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
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-tarjeta2">
              <th className="border border-linea px-1.5 py-1.5 text-left">Nombre</th>
              {MESES_CORTO.map((m) => (
                <th key={m} className="border border-linea px-1 py-1.5 font-bold">
                  {m}
                </th>
              ))}
              <th className="border border-linea px-1.5 py-1.5">Horas</th>
              <th className="border border-linea px-1.5 py-1.5">Est.</th>
              <th className="border border-linea px-1.5 py-1.5">Meses</th>
              <th className="border border-linea px-1.5 py-1.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ participante, celdas, horas, estudios, informados, irregular }) => (
              <tr key={participante.id} className="break-inside-avoid odd:bg-tarjeta2/40">
                <td className="border border-linea px-1.5 py-1">
                  {participante.nombre_completo}
                  {!participante.activo && (
                    <span className="ml-1 text-[9px] font-bold text-rojo">(inactivo)</span>
                  )}
                </td>
                {celdas.map((c) => (
                  <td
                    key={c.clave}
                    className={`border border-linea px-1 py-1 text-center ${c.clase}`}
                  >
                    {c.texto}
                  </td>
                ))}
                <td className="border border-linea px-1.5 py-1 text-center font-bold">{horas}</td>
                <td className="border border-linea px-1.5 py-1 text-center font-bold">{estudios}</td>
                <td className="border border-linea px-1.5 py-1 text-center">{informados}/12</td>
                <td className="border border-linea px-1.5 py-1 text-center">
                  {irregular ? (
                    <span className="font-bold text-rojo">Irregular</span>
                  ) : (
                    <span className="text-verde">Al día</span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-tarjeta2 font-black">
              <td className="border border-linea px-1.5 py-1.5">TOTALES ({filas.length})</td>
              <td colSpan={12} className="border border-linea" />
              <td className="border border-linea px-1.5 py-1.5 text-center">{totales.horas}</td>
              <td className="border border-linea px-1.5 py-1.5 text-center">{totales.estudios}</td>
              <td className="border border-linea px-1.5 py-1.5" />
              <td className="border border-linea px-1.5 py-1.5 text-center text-rojo">
                {totales.irregulares}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <footer className="mt-4 flex items-center gap-2 border-t border-linea pt-3 text-[10px] text-suave">
        <AlertTriangle size={12} />
        <span>
          <strong>P</strong> horas del precursor · <strong>·15 / ·30</strong> auxiliar (horas
          reales · meta) · <strong>Sí/No</strong> participation · <strong>✓ otra</strong> cargado
          en la otra web · <strong>Irregular</strong> sin informe del mes anterior.
        </span>
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
