"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  FileDown,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { Boton, Campo, Etiqueta, Input, Panel, Select } from "@/components/ui";
import TablaAsistenciaAnio from "@/components/TablaAsistenciaAnio";
import { supabase } from "@/lib/supabase";
import {
  diaDeSemana,
  fechaCorta,
  hoyClave,
  resumenPorDia,
  validarAsistencia,
  type AsistenciaFila,
  type AsistenciaMesCerrado,
  type DatosAsistencia,
  type ErroresAsistencia,
} from "@/lib/asistencia";
import {
  anioServicioActual,
  aniosDisponibles,
  etiquetaAnioServicio,
  rangoFechasAnioServicio,
} from "@/lib/anio-servicio";
import { etiquetaMes, mesActual, ultimosMeses } from "@/lib/informes";

const VACIO: DatosAsistencia = { fecha: hoyClave(), auditorio: null, zoom: null };

interface Resultado {
  filas: AsistenciaFila[];
  mesCerrado: AsistenciaMesCerrado | null;
  errorCarga: string;
  aviso: string;
}

export default function SecretariaAsistencias() {
  const router = useRouter();
  const [mes, setMes] = useState(() => mesActual());
  const [anioServicio, setAnioServicio] = useState(() => anioServicioActual());
  const [filas, setFilas] = useState<AsistenciaFila[]>([]);
  const [filasAnio, setFilasAnio] = useState<AsistenciaFila[]>([]);
  const [anios, setAnios] = useState<number[]>([anioServicioActual()]);
  const [mesCerrado, setMesCerrado] = useState<AsistenciaMesCerrado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [aviso, setAviso] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<DatosAsistencia>(VACIO);
  const [errores, setErrores] = useState<ErroresAsistencia>({});

  /** Toda la carga del año de servicio (de una sola vez), para el resumen. */
  const traerAnio = useCallback(async (anio: number): Promise<AsistenciaFila[]> => {
    const { desde, hasta } = rangoFechasAnioServicio(anio);
    const { data } = await supabase
      .from("asistencias")
      .select("fecha, total")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true });
    return (data as AsistenciaFila[]) || [];
  }, []);

  /** Todos los años de servicio que tienen asistencias cargadas. */
  const traerAnios = useCallback(async (): Promise<number[]> => {
    const { data } = await supabase.from("asistencias").select("fecha");
    const set = new Set<number>();
    for (const fila of (data as { fecha: string }[]) || []) {
      if (!fila.fecha) continue;
      const anio = Number(fila.fecha.slice(0, 4));
      const mes = Number(fila.fecha.slice(5, 7));
      if (!anio || !mes) continue;
      set.add(mes >= 9 ? anio : anio - 1);
    }
    return aniosDisponibles([...set]);
  }, []);

  const traer = useCallback(async (mesElegido: string): Promise<Resultado> => {
    const [a, c] = await Promise.all([
      supabase
        .from("asistencias")
        .select("*, registrado:participantes!registrado_por(nombre_completo)")
        .gte("fecha", `${mesElegido}-01`)
        .lte("fecha", `${mesElegido}-31`)
        .order("fecha", { ascending: true }),
      supabase.from("asistencias_meses").select("*").eq("mes", mesElegido).maybeSingle(),
    ]);

    if (a.error) {
      return { filas: [], mesCerrado: null, errorCarga: a.error.message, aviso: "" };
    }

    return {
      filas: (a.data as AsistenciaFila[]) || [],
      mesCerrado: (c.data as AsistenciaMesCerrado) || null,
      errorCarga: "",
      aviso: c.error ? "Falta una parte del SQL (cierre de mes de asistencias)." : "",
    };
  }, []);

  const aplicar = useCallback((r: Resultado) => {
    setFilas(r.filas);
    setMesCerrado(r.mesCerrado);
    setErrorCarga(r.errorCarga);
    setAviso(r.aviso);
    setCargando(false);
  }, []);

  const cargar = useCallback(
    async (mesElegido: string) => {
      setCargando(true);
      aplicar(await traer(mesElegido));
    },
    [aplicar, traer],
  );

  useEffect(() => {
    let cancelado = false;
    traer(mes).then((r) => {
      if (!cancelado) aplicar(r);
    });
    return () => {
      cancelado = true;
    };
  }, [traer, aplicar, mes]);

  /** El resumen del año de servicio se mantiene al día con cada carga. */
  const recargarResumen = useCallback(async () => {
    const [delAnio, conDatos] = await Promise.all([
      traerAnio(anioServicio),
      traerAnios(),
    ]);
    setFilasAnio(delAnio);
    setAnios(conDatos);
  }, [anioServicio, traerAnio, traerAnios]);

  useEffect(() => {
    let cancelado = false;
    Promise.all([traerAnio(anioServicio), traerAnios()]).then(([delAnio, conDatos]) => {
      if (cancelado) return;
      setFilasAnio(delAnio);
      setAnios(conDatos);
    });
    return () => {
      cancelado = true;
    };
  }, [anioServicio, traerAnio, traerAnios]);

  const resumen = useMemo(() => resumenPorDia(filas), [filas]);
  const promedio = resumen.diasConReunion
    ? Math.round(resumen.totalMes / resumen.diasConReunion)
    : 0;

  const reiniciarForm = () => {
    setEditandoId(null);
    setForm({ ...VACIO, fecha: hoyClave() });
    setErrores({});
  };

  const editar = (fila: AsistenciaFila) => {
    setEditandoId(fila.id);
    setForm({ fecha: fila.fecha, auditorio: fila.auditorio, zoom: fila.zoom });
    setErrores({});
    setAviso("");
  };

  const guardar = async () => {
    const validado = validarAsistencia(form);
    if ("errores" in validado) {
      setErrores(validado.errores);
      return;
    }
    setErrores({});
    setGuardando(true);
    const respuesta = editandoId
      ? await supabase.from("asistencias").update(validado.datos).eq("id", editandoId)
      : await supabase.from("asistencias").insert({
          ...validado.datos,
          registrado_por: null,
        });
    setGuardando(false);

    if (respuesta.error) {
      setAviso(`No se pudo guardar: ${respuesta.error.message}`);
      return;
    }
    reiniciarForm();
    await cargar(mes);
    await recargarResumen();
  };

  const eliminar = async (id: string) => {
    if (!window.confirm("¿Borrar esta carga de asistencia?")) return;
    setGuardando(true);
    const respuesta = await supabase.from("asistencias").delete().eq("id", id);
    setGuardando(false);
    if (respuesta.error) {
      setAviso(`No se pudo borrar: ${respuesta.error.message}`);
      return;
    }
    if (editandoId === id) reiniciarForm();
    await cargar(mes);
    await recargarResumen();
  };

  const cerrarMes = async () => {
    if (
      !window.confirm(
        `¿Cerrar las asistencias de ${etiquetaMes(mes)}?\n\nNo se borra nada: quedan guardadas y se genera el PDF del mes.`,
      )
    )
      return;
    setGuardando(true);
    const respuesta = await supabase
      .from("asistencias_meses")
      .upsert({ mes, cerrado_en: new Date().toISOString() });
    setGuardando(false);
    if (respuesta.error) {
      setAviso(
        `No se pudo cerrar el mes: ${respuesta.error.message}. ¿Pegaste supabase/migracion_v4.sql?`,
      );
      return;
    }
    router.push(`/secretaria/asistencias/pdf/${mes}`);
  };

  const reabrirMes = async () => {
    setGuardando(true);
    const respuesta = await supabase.from("asistencias_meses").delete().eq("mes", mes);
    setGuardando(false);
    if (respuesta.error) {
      setAviso(`No se pudo reabrir: ${respuesta.error.message}`);
      return;
    }
    await cargar(mes);
  };

  const cambioDeMes = (nuevo: string) => {
    setMes(nuevo);
    reiniciarForm();
    setAviso("");
  };

  const totalForm =
    (Number(form.auditorio) || 0) + (Number(form.zoom) || 0);

  if (errorCarga) {
    return (
      <Panel className="p-6 text-sm">
        <p className="font-semibold text-rojo">No se pudieron leer las asistencias.</p>
        <p className="mt-1 text-suave">{errorCarga}</p>
        <p className="mt-3 text-suave">
          Si todavía no pegaste el script, corré{" "}
          <code className="font-mono">supabase/migracion_v4.sql</code> en Supabase.
        </p>
      </Panel>
    );
  }

  return (
    <div>
      <Panel className="mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-linea pb-4">
          <div className="w-full sm:w-64">
            <Campo label="Año de servicio (septiembre a agosto)">
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
          <Link
            href={`/secretaria/asistencias/anio/${anioServicio}`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-suave"
          >
            <FileDown size={15} /> PDF del año de servicio
          </Link>
        </div>
        <TablaAsistenciaAnio filas={filasAnio} anio={anioServicio} />
      </Panel>

      <Panel className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <Campo label="Mes de las asistencias" className="w-full sm:w-64">
            <Select value={mes} onChange={(e) => cambioDeMes(e.target.value)}>
              {ultimosMeses(24).map((m) => (
                <option key={m} value={m}>
                  {etiquetaMes(m)}
                  {m === mesActual() ? " (mes en curso)" : ""}
                </option>
              ))}
            </Select>
          </Campo>
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta tono="teal">
              <CalendarDays size={12} /> Reuniones: {resumen.diasConReunion}
            </Etiqueta>
            <Etiqueta tono="verde">Total del mes: {resumen.totalMes}</Etiqueta>
            <Etiqueta tono="neutro">
              <Building2 size={12} /> Auditorio: {resumen.totalAuditorio}
            </Etiqueta>
            <Etiqueta tono="neutro">
              <Video size={12} /> Zoom: {resumen.totalZoom}
            </Etiqueta>
            {resumen.mejorDia && (
              <Etiqueta tono="teal">
                Día con más asistencia: {fechaCorta(resumen.mejorDia.fecha)} ({resumen.mejorDia.total})
              </Etiqueta>
            )}
            {resumen.diasConReunion > 0 && (
              <Etiqueta tono="neutro">Promedio por reunión: {promedio}</Etiqueta>
            )}
          </div>
          <p className="w-full text-xs text-suave sm:ml-auto sm:w-auto">
            <CalendarDays size={12} className="mr-1 inline" />
            {etiquetaMes(mes)} · lo cargan los acomodadores desde{" "}
            <code className="font-mono">/asistencia</code>.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-linea pt-4">
          {mesCerrado ? (
            <>
              <Etiqueta tono="verde">
                <Lock size={12} /> Mes cerrado
              </Etiqueta>
              <span className="text-xs text-suave">
                Cerrado el{" "}
                {new Date(mesCerrado.cerrado_en).toLocaleDateString("es-AR")}. Nada se borró.
              </span>
              <Boton
                variante="secundario"
                className="ml-auto"
                onClick={reabrirMes}
                disabled={guardando}
              >
                <LockOpen size={15} /> Reabrir mes
              </Boton>
            </>
          ) : (
            <Boton variante="secundario" onClick={cerrarMes} disabled={guardando}>
              <Lock size={15} /> Cerrar mes y generar el PDF
            </Boton>
          )}
          <Link
            href={`/secretaria/asistencias/pdf/${mes}`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-suave"
          >
            <FileDown size={15} /> PDF del mes
          </Link>
          <Link
            href="/asistencia"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-suave"
          >
            Formulario de acomodadores (/asistencia)
          </Link>
        </div>
      </Panel>

      {aviso && (
        <div className="mb-5 rounded-xl border border-rojo/30 bg-rojo/5 px-4 py-3 text-sm font-semibold text-rojo">
          {aviso}
        </div>
      )}

      {!mesCerrado && (
        <Panel className="mb-6 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-black tracking-tight">
              <Plus size={16} className="text-teal" />
              {editandoId ? "Corregir una carga" : "Cargar asistencia de un día"}
            </h2>
            {editandoId && (
              <button
                onClick={reiniciarForm}
                className="cursor-pointer text-xs font-semibold text-teal hover:underline"
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Día de la reunión" hint="Día, mes y año">
              <Input
                type="date"
                value={form.fecha}
                min="2020-01-01"
                max={hoyClave()}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </Campo>
            <Campo label="Asistentes en auditorio">
              <Input
                type="number"
                min={0}
                value={form.auditorio ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    auditorio: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </Campo>
            <Campo label="Asistentes por Zoom">
              <Input
                type="number"
                min={0}
                value={form.zoom ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    zoom: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </Campo>
          </div>

          {(errores.fecha || errores.auditorio || errores.zoom) && (
            <div className="mt-3 space-y-1 text-xs text-rojo">
              {errores.fecha && <p>{errores.fecha}</p>}
              {errores.auditorio && <p>Auditorio: {errores.auditorio}</p>}
              {errores.zoom && <p>Zoom: {errores.zoom}</p>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-4">
            <p className="text-sm">
              Total de asistentes:{" "}
              <strong className="text-lg text-teal">{totalForm}</strong>{" "}
              <span className="text-xs text-suave">(se suma solo)</span>
            </p>
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              {editandoId ? "Guardar cambios" : "Guardar asistencia"}
            </Boton>
          </div>
        </Panel>
      )}

      {cargando ? (
        <Panel className="flex items-center justify-center gap-2 p-10 text-sm text-suave">
          <Loader2 size={18} className="animate-spin" /> Cargando asistencias...
        </Panel>
      ) : filas.length === 0 ? (
        <Panel className="p-10 text-center">
          <CalendarDays size={30} className="mx-auto mb-3 text-suave" />
          <p className="text-sm text-suave">
            Todavía no hay asistencias cargadas para {etiquetaMes(mes)}.
          </p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-linea text-[11px] tracking-widest text-suave uppercase">
                <th className="px-5 py-3 font-bold">Día</th>
                <th className="px-5 py-3 font-bold">Auditorio</th>
                <th className="px-5 py-3 font-bold">Zoom</th>
                <th className="px-5 py-3 font-bold">Total</th>
                <th className="px-5 py-3 font-bold">Cargó</th>
                {!mesCerrado && <th className="px-5 py-3 text-right font-bold">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr
                  key={fila.id}
                  className={
                    "border-b border-linea/60 last:border-0 " +
                    (editandoId === fila.id ? "bg-teal/5" : "")
                  }
                >
                  <td className="px-5 py-3">
                    <span className="font-bold capitalize">{diaDeSemana(fila.fecha)}</span>{" "}
                    <span className="text-suave">{fechaCorta(fila.fecha)}</span>
                  </td>
                  <td className="px-5 py-3">{fila.auditorio}</td>
                  <td className="px-5 py-3">{fila.zoom}</td>
                  <td className="px-5 py-3 font-black text-teal">{fila.total}</td>
                  <td className="px-5 py-3 text-xs text-suave">
                    {fila.registrado?.nombre_completo || "Secretaría"}
                  </td>
                  {!mesCerrado && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => editar(fila)}
                          disabled={guardando}
                          className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-teal hover:text-teal"
                          title="Corregir"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => eliminar(fila.id)}
                          disabled={guardando}
                          className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-rojo hover:text-rojo"
                          title="Borrar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-linea bg-tarjeta2 text-xs font-bold">
                <td className="px-5 py-3 uppercase tracking-widest text-suave">
                  {filas.length} {filas.length === 1 ? "carga" : "cargas"}
                </td>
                <td className="px-5 py-3">{resumen.totalAuditorio}</td>
                <td className="px-5 py-3">{resumen.totalZoom}</td>
                <td className="px-5 py-3 text-teal">{resumen.totalMes}</td>
                <td className="px-5 py-3" />
                {!mesCerrado && <td className="px-5 py-3" />}
              </tr>
            </tfoot>
          </table>
        </Panel>
      )}

      {!cargando && !errorCarga && filas.length > 0 && !mesCerrado && (
        <p className="mt-4 flex items-start gap-2 text-xs text-suave">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          Si dos acomodadores cargan el mismo día, ambas cargas se suman en el total del día.
        </p>
      )}
    </div>
  );
}
