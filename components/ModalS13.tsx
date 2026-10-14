"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, RotateCcw, Save, X } from "lucide-react";
import { Boton } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { anioServicioActual } from "@/lib/anio-servicio";
import {
  armarS13,
  type AjusteS13,
  type CicloS13,
  type FilaS13,
} from "@/lib/s13";
import type { SalidaConDetalle, Territorio } from "@/lib/territorios";
import type { Participante } from "@/lib/tipos";

/**
 * Modal del S-13: muestra cómo se va llenando el registro de
 * asignación de territorio y permite corregir a mano cualquier
 * fecha o conductor.
 */
export default function ModalS13({
  territorios,
  salidas,
  participantes,
  onCerrar,
}: {
  territorios: Territorio[];
  salidas: SalidaConDetalle[];
  participantes: Participante[];
  onCerrar: () => void;
}) {
  const [ajustes, setAjustes] = useState<AjusteS13[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [soloConDatos, setSoloConDatos] = useState(true);

  const nombreDe = useCallback(
    (id: string | null | undefined) =>
      participantes.find((p) => p.id === id)?.nombre_completo || null,
    [participantes],
  );

  const cargarAjustes = useCallback(
    () =>
      supabase
        .from("s13_ajustes")
        .select("*")
        .then((r) => {
          setAjustes((r.data as AjusteS13[]) || []);
          setCargando(false);
        }),
    [],
  );

  useEffect(() => {
    void cargarAjustes();
  }, [cargarAjustes]);

  const filas = useMemo(
    () => armarS13({ territorios, salidas, ajustes, nombreDe }),
    [territorios, salidas, ajustes, nombreDe],
  );

  const visibles = useMemo(
    () => (soloConDatos ? filas.filter((f) => f.total > 0) : filas),
    [filas, soloConDatos],
  );

  const conDatos = filas.filter((f) => f.total > 0).length;

  /** Guarda (o borra) la corrección de un ciclo. */
  const guardarCiclo = async (
    territorio: number,
    ciclo: CicloS13,
    cambios: Partial<AjusteS13>,
  ) => {
    setGuardando(territorio);
    const anterior = ajustes.find(
      (a) => a.territorio_numero === territorio && a.ciclo === ciclo.indice,
    );
    const nuevo: AjusteS13 = {
      territorio_numero: territorio,
      ciclo: ciclo.indice,
      fecha_asignado:
        "fecha_asignado" in cambios
          ? (cambios.fecha_asignado ?? null)
          : (ciclo.fechaAsignado ?? null),
      fecha_completo:
        "fecha_completo" in cambios
          ? (cambios.fecha_completo ?? null)
          : (ciclo.fechaCompletado ?? null),
      conductor_id: anterior?.conductor_id ?? null,
      conductor_texto:
        "conductor_texto" in cambios
          ? (cambios.conductor_texto ?? null)
          : (anterior?.conductor_texto ?? null),
      borrado: anterior?.borrado ?? false,
    };
    // si no se cambió nada respecto de lo automático, no hay qué guardar
    const sinCambios =
      !nuevo.borrado &&
      nuevo.fecha_asignado === ciclo.fechaAsignado &&
      nuevo.fecha_completo === ciclo.fechaCompletado &&
      (nuevo.conductor_texto || null) === (ciclo.conductor || null) &&
      !ciclo.manual;
    if (sinCambios) {
      setAjustes(ajustes.filter((a) => a !== anterior));
      if (anterior) await supabase.from("s13_ajustes").delete().match({ territorio_numero: territorio, ciclo: ciclo.indice });
    } else {
      const { error } = await supabase.from("s13_ajustes").upsert(nuevo);
      if (error) console.error(error);
      setAjustes([
        ...ajustes.filter(
          (a) => !(a.territorio_numero === territorio && a.ciclo === ciclo.indice),
        ),
        nuevo,
      ]);
    }
    setGuardando(null);
  };

  const restablecer = async (territorio: number) => {
    setGuardando(territorio);
    await supabase.from("s13_ajustes").delete().eq("territorio_numero", territorio);
    setAjustes(ajustes.filter((a) => a.territorio_numero !== territorio));
    setGuardando(null);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-6xl rounded-2xl border border-linea bg-tarjeta shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------- encabezado ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linea px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black">
              <FileText size={18} /> Registro de asignación de territorio (S-13-S)
            </h2>
            <p className="text-xs text-suave">
              Año de servicio {anioServicioActual()} · se llena solo con las salidas ·{" "}
              {conDatos} de {filas.length} territorios con visitas
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-suave">
              <input
                type="checkbox"
                checked={soloConDatos}
                onChange={(e) => setSoloConDatos(e.target.checked)}
                className="accent-teal"
              />
              Solo los que ya se hicieron
            </label>
            <a
              href="/servicio/s13"
              target="_blank"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-3 py-2 text-xs font-semibold transition-colors hover:border-suave hover:text-teal"
            >
              <Download size={14} /> Descargar S-13
            </a>
            <button onClick={onCerrar} className="cursor-pointer text-suave hover:text-texto">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ---------- tabla ---------- */}
        {cargando ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-suave">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </p>
        ) : (
          <div className="max-h-[65vh] overflow-auto px-5 py-4">
            {visibles.length === 0 ? (
              <p className="py-10 text-center text-sm text-suave">
                Todavía no hay territorios con visitas. Cuando carguen una salida desde{" "}
                <code className="font-mono">/territorios</code>, van a aparecer solos acá.
              </p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-tarjeta">
                  <tr>
                    <th className="w-[5%] border border-linea px-2 py-1.5 text-left font-bold">
                      Terr.
                    </th>
                    <th className="w-[10%] border border-linea px-2 py-1.5 text-left font-bold">
                      Última vez completo
                    </th>
                    <th className="border border-linea px-2 py-1.5 text-left font-bold">
                      Ciclos (fecha en que se asignó / se completó / conductor)
                    </th>
                    <th className="w-[8%] border border-linea px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((fila) => (
                    <tr key={fila.numero} className="align-top">
                      <td className="border border-linea px-2 py-2 font-bold">
                        {fila.numero}
                        <span className="block text-[10px] font-normal text-suave">
                          {fila.letras.join(" ")}
                        </span>
                      </td>
                      <td className="border border-linea px-2 py-2">
                        {fila.ultimaCompleto || "—"}
                      </td>
                      <td className="border border-linea">
                        <div className="flex flex-col gap-1 p-1">
                          {fila.ciclos.map((ciclo) => (
                            <CicloEditable
                              key={ciclo.indice}
                              fila={fila}
                              ciclo={ciclo}
                              participantes={participantes}
                              guardando={guardando === fila.numero}
                              onGuardar={(cambios) => guardarCiclo(fila.numero, ciclo, cambios)}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="border border-linea px-1 py-1 text-center">
                        {fila.ciclos.some((c) => c.manual) && (
                          <button
                            onClick={() => restablecer(fila.numero)}
                            title="Volver a lo automático"
                            className="cursor-pointer rounded border border-linea p-1 text-suave transition-colors hover:border-teal hover:text-teal"
                          >
                            <RotateCcw size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea px-5 py-3">
          <p className="text-[11px] text-suave">
            Lo que corrijas acá tiene prioridad sobre lo automático. Con la flechita{" "}
            <RotateCcw size={11} className="inline" /> volvés un territorio a lo automático.
          </p>
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Un ciclo: fecha asignó, fecha completó y conductor                   */
/* ------------------------------------------------------------------ */
function CicloEditable({
  fila,
  ciclo,
  participantes,
  guardando,
  onGuardar,
}: {
  fila: FilaS13;
  ciclo: CicloS13;
  participantes: Participante[];
  guardando: boolean;
  onGuardar: (cambios: Partial<AjusteS13>) => void;
}) {
  const vacio = !ciclo.fechaAsignado && !ciclo.fechaCompletado && !ciclo.conductor;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1",
        ciclo.manual ? "border-teal/50 bg-teal/5" : "border-transparent",
        vacio && "opacity-50",
      )}
    >
      <span className="w-4 text-[10px] font-bold text-suave">{ciclo.indice}.</span>
      <input
        type="date"
        value={ciclo.fechaAsignado || ""}
        onChange={(e) => onGuardar({ fecha_asignado: e.target.value || null })}
        className="w-[7.5rem] rounded border border-linea bg-tarjeta px-1.5 py-1 text-[11px] outline-none focus:border-teal"
        title="Fecha en que se asignó"
      />
      <span className="text-[10px] text-suave">/</span>
      <input
        type="date"
        value={ciclo.fechaCompletado || ""}
        onChange={(e) => onGuardar({ fecha_completo: e.target.value || null })}
        className="w-[7.5rem] rounded border border-linea bg-tarjeta px-1.5 py-1 text-[11px] outline-none focus:border-teal"
        title="Fecha en que se completó"
      />
      <input
        list={`conductores-s13-${fila.numero}`}
        value={ciclo.conductor || ""}
        onChange={(e) => onGuardar({ conductor_texto: e.target.value || null })}
        placeholder="Conductor"
        className="w-40 rounded border border-linea bg-tarjeta px-1.5 py-1 text-[11px] uppercase outline-none focus:border-teal"
        title="Conductor"
      />
      <datalist id={`conductores-s13-${fila.numero}`}>
        {participantes
          .filter((p) => p.activo && p.genero === "HOMBRE")
          .map((p) => (
            <option key={p.id} value={p.nombre_completo} />
          ))}
      </datalist>
      {guardando && <Save size={11} className="animate-pulse text-teal" />}
    </div>
  );
}
