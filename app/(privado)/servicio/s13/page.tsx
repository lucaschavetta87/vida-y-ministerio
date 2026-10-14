"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { anioServicioActual, etiquetaAnioServicio } from "@/lib/anio-servicio";
import { armarS13, type AjusteS13 } from "@/lib/s13";
import type {
  SalidaConDetalle,
  SalidaTerritorioDetalle,
  Territorio,
} from "@/lib/territorios";
import type { Participante } from "@/lib/tipos";
import TablaS13 from "@/components/TablaS13";

/**
 * S-13-S · Registro de asignación de territorio, en la misma forma
 * del formulario: una hoja por cada grupo de territorios, con el
 * encabezado repetido al cortar página.
 */
export default function PaginaS13() {
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [salidas, setSalidas] = useState<SalidaConDetalle[]>([]);
  const [ajustes, setAjustes] = useState<AjusteS13[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [anio, setAnio] = useState(anioServicioActual());

  useEffect(() => {
    let cancelado = false;

    (async () => {
      const [t, cabeceras, a, p] = await Promise.all([
        supabase.from("territorios").select("*").order("numero"),
        supabase.from("territorios_salidas").select("*").order("fecha", { ascending: false }),
        supabase.from("s13_ajustes").select("*"),
        supabase.from("participantes").select("*"),
      ]);

      if (cancelado) return;

      const lista = (cabeceras.data || []) as SalidaConDetalle[];
      let conDetalle = lista;
      if (lista.length) {
        const { data: detalles } = await supabase
          .from("territorios_salidas_detalle")
          .select("*")
          .in(
            "salida_id",
            lista.map((s) => s.id),
          );
        if (cancelado) return;
        const porSalida = new Map<string, SalidaTerritorioDetalle[]>();
        ((detalles || []) as SalidaTerritorioDetalle[]).forEach((d) => {
          porSalida.set(d.salida_id, [...(porSalida.get(d.salida_id) || []), d]);
        });
        conDetalle = lista.map((s) => ({
          ...s,
          detalle: (porSalida.get(s.id) || []).sort(
            (a, b) => a.territorio_numero - b.territorio_numero,
          ),
        }));
      }

      setTerritorios((t.data as Territorio[]) || []);
      setSalidas(conDetalle);
      setAjustes((a.data as AjusteS13[]) || []);
      setParticipantes((p.data as Participante[]) || []);
      setCargando(false);
      if (t.error) setError(t.error.message);
      if (a.error) setError(a.error.message);
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  const filas = useMemo(
    () =>
      armarS13({
        territorios,
        salidas,
        ajustes,
        nombreDe: (id) =>
          participantes.find((p) => p.id === id)?.nombre_completo || null,
      }),
    [territorios, salidas, ajustes, participantes],
  );

  const conDatos = filas.filter((f) => f.total > 0).length;

  return (
    <div className="pagina-pdf mx-auto w-full max-w-[1100px]">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/servicio"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
        >
          <ChevronLeft size={16} /> Servicio
        </Link>
        <label className="flex items-center gap-2 text-sm text-suave">
          Año de servicio
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value) || anioServicioActual())}
            className="w-24 rounded-xl border border-linea px-2 py-1.5 text-sm outline-none focus:border-teal"
          />
        </label>
        <span className="text-xs text-suave">
          {conDatos} de {filas.length} territorios con visitas registradas
        </span>
        <button
          onClick={() => window.print()}
          className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal2"
        >
          <Printer size={16} /> Imprimir / Guardar como PDF
        </button>
      </div>

      {cargando ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-suave">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </p>
      ) : (
        <article className="mx-auto max-w-[980px]">
          <h1 className="mb-1 text-center text-lg font-black tracking-wide uppercase">
            Registro de asignación de territorio
          </h1>
          <p className="mb-3 text-sm font-semibold">
            Año de servicio: <span className="underline">{etiquetaAnioServicio(anio)}</span>
          </p>

          {error && (
            <p className="mb-3 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
              {error}
            </p>
          )}

          <TablaS13 filas={filas} anioServicio={anio} />

          <p className="mt-2 text-[10px] leading-snug">
            *Cuando comience una nueva página, anote en esta columna la última fecha en
            que los territorios se completaron.
          </p>
          <p className="mt-1 text-[10px]">S-13-S</p>
        </article>
      )}
    </div>
  );
}