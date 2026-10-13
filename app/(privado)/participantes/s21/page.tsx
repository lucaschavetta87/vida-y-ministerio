"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Printer, Search } from "lucide-react";
import TarjetaS21 from "@/components/TarjetaS21";
import { Boton, Campo, Etiqueta, Input, Select } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  anioServicioActual,
  aniosDisponibles,
  etiquetaAnioServicio,
  rangoAnioServicio,
} from "@/lib/anio-servicio";
import type { Informe, MarcaInforme } from "@/lib/informes";
import type { Participante } from "@/lib/tipos";

/** Todas las fichas S-21 de la congregación, una por hoja. */
export default function PaginaS21Todas() {
  const router = useRouter();
  const [anioServicio, setAnioServicio] = useState(() => anioServicioActual());
  const [anios, setAnios] = useState<number[]>([anioServicioActual()]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [informes, setInformes] = useState<Informe[]>([]);
  const [marcas, setMarcas] = useState<MarcaInforme[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloPublicadores, setSoloPublicadores] = useState(true);

  useEffect(() => {
    supabase.from("informes").select("mes").then(({ data }) => {
      const conDatos = new Set<number>();
      ((data as { mes: string }[]) || []).forEach((fila) => {
        const a = Number(fila.mes.slice(0, 4));
        const mes = Number(fila.mes.slice(5, 7));
        if (a && mes) conDatos.add(mes >= 9 ? a : a - 1);
      });
      setAnios(aniosDisponibles([...conDatos]));
    });
  }, []);

  useEffect(() => {
    let cancelado = false;
    const { desde, hasta } = rangoAnioServicio(anioServicio);
    Promise.all([
      supabase.from("participantes").select("*").order("nombre_completo"),
      supabase.from("informes").select("*").gte("mes", desde).lte("mes", hasta),
      supabase.from("marcas_informe").select("*").gte("mes", desde).lte("mes", hasta),
    ]).then(([p, i, m]) => {
      if (cancelado) return;
      if (p.error) setError(p.error.message);
      setParticipantes((p.data as Participante[]) || []);
      setInformes((i.data as Informe[]) || []);
      setMarcas((m.data as MarcaInforme[]) || []);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [anioServicio]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return participantes.filter((p) => {
      if (!p.activo) return false;
      if (soloPublicadores && p.es_publicador === false) return false;
      if (!q) return true;
      return p.nombre_completo.toLowerCase().includes(q);
    });
  }, [participantes, busqueda, soloPublicadores]);

  const informesPorPersona = useMemo(() => {
    const mapa = new Map<string, Informe[]>();
    informes.forEach((i) => {
      const lista = mapa.get(i.participante_id) || [];
      lista.push(i);
      mapa.set(i.participante_id, lista);
    });
    return mapa;
  }, [informes]);

  const marcasPorPersona = useMemo(() => {
    const mapa = new Map<string, MarcaInforme[]>();
    marcas.forEach((m) => {
      const lista = mapa.get(m.participante_id) || [];
      lista.push(m);
      mapa.set(m.participante_id, lista);
    });
    return mapa;
  }, [marcas]);

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
        <div className="relative w-full sm:w-56">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-suave"
          />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="pl-9"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={soloPublicadores}
            onChange={(e) => setSoloPublicadores(e.target.checked)}
          />
          Solo publicadores
        </label>
        <Etiqueta tono="neutro">{visibles.length} fichas</Etiqueta>
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
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-suave">
          No hay fichas para imprimir con esos filtros.
        </p>
      ) : (
        visibles.map((p) => (
          <TarjetaS21
            key={p.id}
            participante={p}
            informes={informesPorPersona.get(p.id) || []}
            marcas={marcasPorPersona.get(p.id) || []}
            anioServicio={anioServicio}
          />
        ))
      )}

      <div className="no-print mt-6 flex justify-end gap-2">
        <Boton variante="secundario" onClick={() => router.push("/participantes")}>
          Volver
        </Boton>
      </div>
    </div>
  );
}