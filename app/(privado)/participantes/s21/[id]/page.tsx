"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, FileDown, Loader2, Printer } from "lucide-react";
import TarjetaS21 from "@/components/TarjetaS21";
import { Campo, Etiqueta, Select } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  anioServicioActual,
  aniosDisponibles,
  etiquetaAnioServicio,
  rangoAnioServicio,
} from "@/lib/anio-servicio";
import type { Informe, MarcaInforme } from "@/lib/informes";
import type { Participante } from "@/lib/tipos";

export default function PaginaS21Individual() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [anioServicio, setAnioServicio] = useState(() => anioServicioActual());
  const [anios, setAnios] = useState<number[]>([anioServicioActual()]);
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [informes, setInformes] = useState<Informe[]>([]);
  const [marcas, setMarcas] = useState<MarcaInforme[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const idValido = typeof id === "string" && id.length > 0;

  useEffect(() => {
    if (!idValido) return;
    let cancelado = false;
    Promise.all([
      supabase.from("participantes").select("*").eq("id", id).maybeSingle(),
      supabase.from("informes").select("mes").eq("participante_id", id),
    ]).then(([p, todos]) => {
      if (cancelado) return;
      if (p.error) {
        setError(p.error.message);
      } else if (!p.data) {
        setError("No se encontró a esa persona.");
      } else {
        setParticipante(p.data as Participante);
      }
      const conDatos = new Set<number>();
      ((todos.data as { mes: string }[]) || []).forEach((fila) => {
        const a = Number(fila.mes.slice(0, 4));
        const mes = Number(fila.mes.slice(5, 7));
        if (a && mes) conDatos.add(mes >= 9 ? a : a - 1);
      });
      setAnios(aniosDisponibles([...conDatos]));
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [id, idValido]);

  useEffect(() => {
    if (!idValido) return;
    let cancelado = false;
    const { desde, hasta } = rangoAnioServicio(anioServicio);
    Promise.all([
      supabase
        .from("informes")
        .select("*")
        .eq("participante_id", id)
        .gte("mes", desde)
        .lte("mes", hasta),
      supabase
        .from("marcas_informe")
        .select("*")
        .eq("participante_id", id)
        .gte("mes", desde)
        .lte("mes", hasta),
    ]).then(([i, m]) => {
      if (cancelado) return;
      setInformes((i.data as Informe[]) || []);
      setMarcas((m.data as MarcaInforme[]) || []);
      setError(i.error?.message || m.error?.message || "");
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [id, idValido, anioServicio]);

  return (
    <div className="pagina-pdf mx-auto w-full max-w-[820px] px-4 py-6">
      <div className="no-print mb-6 flex flex-wrap items-end gap-3">
        <Link
          href="/participantes"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
        >
          <ChevronLeft size={16} /> Personas de la congregación
        </Link>
        <div className="w-full sm:w-56">
          <Campo label="Año de servicio">
            <Select
              value={anioServicio}
              onChange={(e) => setAnioServicio(Number(e.target.value))}
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {etiquetaAnioServicio(a)}
                  {a === anioServicioActual() ? " (en curso)" : ""}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <Etiqueta tono="neutro">
          <FileDown size={12} /> Ficha S-21
        </Etiqueta>
        <button
          onClick={() => window.print()}
          className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal2"
        >
          <Printer size={16} /> Imprimir / Guardar como PDF
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-suave">
          <Loader2 size={16} className="animate-spin" /> Cargando...
        </p>
      ) : participante ? (
        <TarjetaS21
          participante={participante}
          informes={informes}
          marcas={marcas}
          anioServicio={anioServicio}
        />
      ) : null}

      <div className="no-print mt-6 flex justify-end">
        <button
          onClick={() => router.push("/participantes")}
          className="cursor-pointer text-sm font-semibold text-suave hover:text-texto"
        >
          Volver
        </button>
      </div>
    </div>
  );
}

