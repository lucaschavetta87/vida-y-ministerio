"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleSlash, Loader2, Save, Trash2, UserPlus, X } from "lucide-react";
import { Boton, Campo, Etiqueta, Panel, Select } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { fechaCorta } from "@/lib/territorios";
import type {
  ReporteTerritorioPersonal,
  Territorio,
  TerritorioPersonal,
} from "@/lib/territorios";
import type { Participante } from "@/lib/tipos";

/**
 * Territorios personales: qué territorio tiene asignado cada
 * publicador y qué se hizo la última vez.
 */
export default function PanelTerritoriosPersonales({
  participantes,
  territorios,
}: {
  participantes: Participante[];
  territorios: Territorio[];
}) {
  const [asignaciones, setAsignaciones] = useState<TerritorioPersonal[]>([]);
  const [reportes, setReportes] = useState<ReporteTerritorioPersonal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [asignando, setAsignando] = useState(false);

  const cargar = useCallback(
    () =>
      Promise.all([
        supabase.from("territorios_personales").select("*").order("territorio_numero"),
        supabase
          .from("territorios_personales_reportes")
          .select("*")
          .order("fecha", { ascending: false }),
      ]).then(([a, r]) => {
        setAsignaciones((a.data as TerritorioPersonal[]) || []);
        setReportes((r.data as ReporteTerritorioPersonal[]) || []);
        setCargando(false);
      }),
    [],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombreDe = useCallback(
    (id: string) => participantes.find((p) => p.id === id)?.nombre_completo || "—",
    [participantes],
  );

  const territorioDe = useCallback(
    (n: number) => territorios.find((t) => t.numero === n),
    [territorios],
  );

  /** El último reporte de cada publicador. */
  const ultimoDe = useMemo(() => {
    const mapa: Record<string, ReporteTerritorioPersonal> = {};
    reportes.forEach((r) => {
      if (!mapa[r.publicador_id]) mapa[r.publicador_id] = r;
    });
    return mapa;
  }, [reportes]);

  const filas = useMemo(
    () =>
      [...asignaciones].sort((a, b) => a.territorio_numero - b.territorio_numero),
    [asignaciones],
  );

  if (cargando)
    return (
      <Panel className="flex items-center justify-center gap-2 p-10 text-sm text-suave">
        <Loader2 size={16} className="animate-spin" /> Cargando territorios personales…
      </Panel>
    );

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">Territorios personales</h2>
            <p className="text-xs text-suave">
              Cada publicador carga el suyo desde{" "}
              <code className="font-mono">/territoriopersonal</code>. Acá se ve qué tiene
              asignado y cómo viene.
            </p>
          </div>
          <Boton variante={asignando ? "secundario" : undefined} onClick={() => setAsignando(!asignando)}>
            <UserPlus size={15} /> Asignar territorio
          </Boton>
        </div>

        {aviso && (
          <p className="mt-3 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
            {aviso}
          </p>
        )}

        {asignando && (
          <FormularioAsignar
            participantes={participantes}
            territorios={territorios}
            asignados={asignaciones.map((a) => a.publicador_id)}
            territoriesOcupados={asignaciones.map((a) => a.territorio_numero)}
            onCerrar={() => setAsignando(false)}
            onGuardar={async (publicadorId, numero) => {
              const { error } = await supabase.from("territorios_personales").upsert(
                {
                  publicador_id: publicadorId,
                  territorio_numero: numero,
                  actualizado_en: new Date().toISOString(),
                },
                { onConflict: "publicador_id" },
              );
              if (error) setAviso(error.message);
              else setAviso("");
              setAsignando(false);
              await cargar();
            }}
          />
        )}
      </Panel>

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-linea text-left text-[11px] tracking-widest text-suave uppercase">
              <th className="px-5 py-2.5 font-bold">Territorio</th>
              <th className="px-5 py-2.5 font-bold">Publicador</th>
              <th className="px-5 py-2.5 font-bold">Última vez</th>
              <th className="px-5 py-2.5 font-bold">Estado</th>
              <th className="px-5 py-2.5 font-bold">Estado de las manzanas</th>
              <th className="px-5 py-2.5 font-bold">Observaciones</th>
              <th className="px-5 py-2.5 text-right font-bold" />
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-suave">
                  Todavía no hay territorios personales asignados. Tocá “Asignar
                  territorio”.
                </td>
              </tr>
            )}
            {filas.map((a) => {
              const ultimo = ultimoDe[a.publicador_id];
              const t = territorioDe(a.territorio_numero);
              return (
                <tr key={a.id} className="border-b border-linea/60">
                  <td className="px-5 py-3">
                    <strong>{a.territorio_numero}</strong>{" "}
                    <span className="text-xs text-suave">
                      {t?.letras.join(" · ") || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">{nombreDe(a.publicador_id)}</td>
                  <td className="px-5 py-3">
                    {ultimo ? fechaCorta(ultimo.fecha) : <span className="text-suave">nunca</span>}
                  </td>
                  <td className="px-5 py-3">
                    {!ultimo ? (
                      <Etiqueta>sin reportes</Etiqueta>
                    ) : ultimo.estado === "COMPLETADO" ? (
                      <Etiqueta tono="verde">completo</Etiqueta>
                    ) : (
                      <Etiqueta tono="neutro">incompleto</Etiqueta>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {!ultimo ? (
                      <span className="text-xs text-suave">—</span>
                    ) : ultimo.estado === "COMPLETADO" ? (
                      <Etiqueta tono="verde">todas hechas</Etiqueta>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(t?.letras || []).map((l) => {
                          const falta = ultimo.manzanas.includes(l);
                          return (
                            <span
                              key={l}
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[10px] font-bold",
                                falta
                                  ? "border-gold2/50 bg-gold2/10 text-gold2"
                                  : "border-verde/40 bg-verde/10 text-verde",
                              )}
                            >
                              {l}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="max-w-[260px] px-5 py-3 text-xs text-suave">
                    {ultimo?.observaciones || t?.observaciones || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={async () => {
                          if (!window.confirm(`¿Quitar el territorio ${a.territorio_numero}?`))
                            return;
                          await supabase
                            .from("territorios_personales")
                            .delete()
                            .eq("publicador_id", a.publicador_id);
                          await cargar();
                        }}
                        className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-rojo hover:text-rojo"
                        title="Quitar la asignación"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Asignar un territorio personal a un publicador                      */
/* ------------------------------------------------------------------ */
function FormularioAsignar({
  participantes,
  territorios,
  asignados,
  territoriesOcupados,
  onCerrar,
  onGuardar,
}: {
  participantes: Participante[];
  territorios: Territorio[];
  asignados: string[];
  territoriesOcupados: number[];
  onCerrar: () => void;
  onGuardar: (publicadorId: string, numero: number) => Promise<void>;
}) {
  const [publicadorId, setPublicadorId] = useState("");
  const [numero, setNumero] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const publicadores = participantes.filter(
    (p) => p.activo && p.es_publicador !== false && !asignados.includes(p.id),
  );
  const libres = territorios.filter((t) => !territoriesOcupados.includes(t.numero));

  return (
    <div className="mt-4 rounded-xl border border-linea bg-tarjeta2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Publicador"
          hint={
            publicadores.length
              ? "Solo los que todavía no tienen territorio"
              : "Todos los publicadores ya tienen uno"
          }
        >
          <Select value={publicadorId} onChange={(e) => setPublicadorId(e.target.value)}>
            <option value="">Elegir…</option>
            {publicadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_completo}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo
          label="Territorio"
          hint={
            libres.length ? "Los que están libres" : "No quedan territorios libres"
          }
        >
          <Select value={numero} onChange={(e) => setNumero(e.target.value)}>
            <option value="">Elegir…</option>
            {libres.map((t) => (
              <option key={t.numero} value={t.numero}>
                {t.numero} — {t.letras.join(" ")}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      {error && (
        <p className="mt-3 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Boton variante="fantasma" onClick={onCerrar}>
          <X size={15} /> Cancelar
        </Boton>
        <Boton
          disabled={guardando || !publicadorId || !numero}
          onClick={async () => {
            setGuardando(true);
            setError("");
            await onGuardar(publicadorId, Number(numero));
            setGuardando(false);
          }}
        >
          {guardando ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          Asignar
        </Boton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Historial de un territorio personal                                 */
/* ------------------------------------------------------------------ */
export function HistorialReportes({
  reportes,
  nombre,
}: {
  reportes: ReporteTerritorioPersonal[];
  nombre: string;
}) {
  if (!reportes.length)
    return (
      <p className="flex items-center gap-2 text-sm text-suave">
        <CircleSlash size={14} /> {nombre} todavía no cargó ningún reporte.
      </p>
    );
  return (
    <ul className="flex flex-col gap-2">
      {reportes.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-linea bg-tarjeta2 px-3 py-2 text-sm"
        >
          <span className="font-bold">{fechaCorta(r.fecha)}</span>
          <span
            className={cn(
              "text-xs font-bold",
              r.estado === "COMPLETADO" ? "text-verde" : "text-suave",
            )}
          >
            {r.estado === "COMPLETADO" ? "completo" : "incompleto"}
          </span>
          {r.estado === "INCOMPLETO" && r.manzanas.length > 0 && (
            <span className="text-xs text-suave">
              faltaron: {r.manzanas.join(", ")}
            </span>
          )}
          {r.observaciones && (
            <span className="text-xs text-suave">{r.observaciones}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Botón de ejemplo para reutilizar: no se usa en la app. */
