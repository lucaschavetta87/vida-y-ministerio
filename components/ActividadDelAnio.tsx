"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  UserCheck,
  UserX,
} from "lucide-react";
import EditorInforme from "@/components/EditorInforme";
import { Boton, Etiqueta, Panel, Select } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  META_PRECURSOR_ANUAL,
  anioServicioActual,
  aniosDeFicha,
  etiquetaAnioServicio,
  mesesDelAnioServicio,
  rangoAnioServicio,
  textoHorasFaltan,
} from "@/lib/anio-servicio";
import {
  etiquetaMes,
  mesAnterior,
  textoTipo,
  type BorradorInforme,
  type Informe,
  type MarcaInforme,
} from "@/lib/informes";
import { tieneClasificacion, type Participante } from "@/lib/tipos";

/** Una fila por mes del año de servicio (septiembre a agosto). */
interface Fila {
  clave: string;
  corto: string;
  informe: Informe | null;
  marcada: boolean;
}

/** Mes que se está editando o cargando, con su informe si ya existía. */
interface Editando {
  clave: string;
  informe: Informe | null;
  marca: boolean;
}

export default function ActividadDelAnio({
  participante,
  onCambiarActivo,
  onCambiarInforme,
  soloLectura = false,
}: {
  participante: Participante;
  onCambiarActivo: (activo: boolean) => Promise<void>;
  /** Se llama al guardar o borrar un informe, para refrescar la pantalla. */
  onCambiarInforme?: () => Promise<void> | void;
  /** true = solo para ver el año de servicio, sin tocar nada. */
  soloLectura?: boolean;
}) {
  const [anioServicio, setAnioServicio] = useState(() => anioServicioActual());
  const [informes, setInformes] = useState<Informe[]>([]);
  const [marcas, setMarcas] = useState<MarcaInforme[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<Editando | null>(null);

  const rango = useMemo(() => rangoAnioServicio(anioServicio), [anioServicio]);

  const recargar = useCallback(
    (conCancelacion?: { cancelado: () => boolean }) => {
      Promise.all([
        supabase
          .from("informes")
          .select("*")
          .eq("participante_id", participante.id)
          .gte("mes", rango.desde)
          .lte("mes", rango.hasta),
        supabase
          .from("marcas_informe")
          .select("*")
          .eq("participante_id", participante.id)
          .gte("mes", rango.desde)
          .lte("mes", rango.hasta),
      ]).then(([i, m]) => {
        if (conCancelacion?.cancelado()) return;
        setInformes((i.data as Informe[]) || []);
        setMarcas((m.data as MarcaInforme[]) || []);
        setAviso(
          i.error
            ? `No se pudo leer la actividad: ${i.error.message}`
            : m.error
              ? "Falta la parte del SQL de marcas (informes_ampliacion.sql): los meses cargados en otra web no se ven todavía."
              : "",
        );
        setCargando(false);
      });
    },
    [participante.id, rango.desde, rango.hasta],
  );

  const cambiarAnio = useCallback((anio: number) => {
    setCargando(true);
    setAnioServicio(anio);
  }, []);

  useEffect(() => {
    let cancelado = false;
    recargar({ cancelado: () => cancelado });
    return () => {
      cancelado = true;
    };
  }, [recargar]);

  /**
   * Años que se pueden ver en esta ficha: el que está en curso, el anterior
   * (siempre está disponible) y los anteriores si la ficha arrancó antes.
   */
  const anios = useMemo(
    () => aniosDeFicha(participante.anio_servicio_inicio),
    [participante.anio_servicio_inicio],
  );

  const meses = useMemo(() => mesesDelAnioServicio(anioServicio), [anioServicio]);

  const filas: Fila[] = useMemo(() => {
    const porMes = new Map(informes.map((i) => [i.mes, i]));
    const marcados = new Set(marcas.map((m) => m.mes));
    return meses.map((mes) => ({
      clave: mes.clave,
      corto: mes.corto,
      informe: porMes.get(mes.clave) || null,
      marcada: marcados.has(mes.clave),
    }));
  }, [meses, informes, marcas]);

  const ultimoMes = mesAnterior();

  /**
   * Irregular = no entregó el informe del mes que se está informando.
   * Solo tiene sentido mirando el año de servicio que incluye ese mes.
   */
  const esPublicador = participante.es_publicador !== false;
  const mesEnElAnio = rango.desde <= ultimoMes && ultimoMes <= rango.hasta;
  const irregular = useMemo(() => {
    if (!mesEnElAnio) return false;
    return (
      !informes.some((i) => i.mes === ultimoMes) &&
      !marcas.some((m) => m.mes === ultimoMes)
    );
  }, [informes, marcas, ultimoMes, mesEnElAnio]);

  const mesesInformados = filas.filter((f) => f.informe || f.marcada).length;

  /** Suma de horas del año de servicio que se está viendo. */
  const horas = useMemo(
    () => informes.reduce((s, i) => s + (i.horas ?? 0), 0),
    [informes],
  );

  /** ¿El mes en curso (el que se está informando) cae en el año que se mira? */
  const mesActualEnEsteAnio = rango.desde <= ultimoMes && ultimoMes <= rango.hasta;
  const fueAuxiliarAhora = mesActualEnEsteAnio
    && filas.some((f) => f.clave === ultimoMes && f.informe?.tipo === "AUXILIAR");

  const resumen = useMemo(() => {
    const horas = informes.reduce((s, i) => s + (i.horas ?? 0), 0);
    const estudios = informes.reduce((s, i) => s + (i.estudios_biblicos ?? 0), 0);
    const precursores = filas.filter((f) => f.informe?.tipo === "PRECURSOR").length;
    const auxiliares = filas.filter((f) => f.informe?.tipo === "AUXILIAR").length;
    return { horas, estudios, meses: mesesInformados, precursores, auxiliares };
  }, [informes, filas, mesesInformados]);

  const guardar = async (borrador: BorradorInforme) => {
    if (!editando) return;
    setGuardando(true);
    const respuesta = await supabase
      .from("informes")
      .upsert(
        {
          participante_id: participante.id,
          mes: editando.clave,
          tipo: borrador.tipo,
          horas: borrador.horas,
          horas_meta: borrador.horas_meta,
          participo: borrador.participo,
          estudios_biblicos: borrador.estudios_biblicos,
          observaciones: borrador.observaciones,
          origen: "secretaria",
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: "participante_id,mes" },
      );
    if (respuesta.error) {
      setGuardando(false);
      setAviso(`No se pudo guardar: ${respuesta.error.message}`);
      return;
    }
    // si el mes estaba marcado como cargado en otra web, la marca ya no aplica
    if (editando.marca || marcas.some((m) => m.mes === editando.clave)) {
      await supabase
        .from("marcas_informe")
        .delete()
        .eq("participante_id", participante.id)
        .eq("mes", editando.clave);
    }
    setGuardando(false);
    setEditando(null);
    setCargando(true);
    recargar();
    if (onCambiarInforme) await onCambiarInforme();
  };

  const eliminar = async () => {
    if (!editando?.informe) return;
    setGuardando(true);
    const respuesta = await supabase
      .from("informes")
      .delete()
      .eq("participante_id", participante.id)
      .eq("mes", editando.informe.mes);
    setGuardando(false);
    if (respuesta.error) {
      setAviso(`No se pudo borrar: ${respuesta.error.message}`);
      return;
    }
    setEditando(null);
    setCargando(true);
    recargar();
    if (onCambiarInforme) await onCambiarInforme();
  };

  const alternarActivo = async () => {
    const nuevo = !participante.activo;
    const mensaje = nuevo
      ? `¿Pasar a INACTIVO a ${participante.nombre_completo}?\n\nVa a dejar de aparecer en los listados de la congregación.`
      : `¿Volver a ACTIVO a ${participante.nombre_completo}?`;
    if (!window.confirm(mensaje)) return;
    setGuardando(true);
    const respuesta = await supabase
      .from("participantes")
      .update({ activo: nuevo })
      .eq("id", participante.id);
    setGuardando(false);
    if (respuesta.error) {
      setAviso(`No se pudo cambiar el estado: ${respuesta.error.message}`);
      return;
    }
    await onCambiarActivo(nuevo);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold">
            Actividad · Año de servicio {etiquetaAnioServicio(anioServicio)}
          </p>
          <p className="text-xs text-suave">
            De septiembre a agosto. Podés cargar a mano los meses que faltaron, aunque el mes esté
            cerrado.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={anioServicio}
            onChange={(e) => cambiarAnio(Number(e.target.value))}
            aria-label="Año de servicio"
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {etiquetaAnioServicio(a)}
                {a === anioServicioActual() ? " (en curso)" : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!esPublicador ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-linea bg-tarjeta2 px-4 py-3 text-sm">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-suave" />
          <p className="text-xs text-suave">
            No está tildado como publicador: no informa y no se le pide el informe.
          </p>
        </div>
      ) : irregular ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <p className="font-bold text-gold">IRREGULAR</p>
            <p className="text-xs text-suave">
              No informó {etiquetaMes(ultimoMes)}. Si son varios meses seguidos, evaluá pasarlo a
              inactivo con el botón de abajo.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-verde/40 bg-verde/5 px-4 py-3 text-sm">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-verde" />
          <p className="text-xs text-suave">
            Informó {etiquetaMes(ultimoMes)}. Está al día.
          </p>
        </div>
      )}

      {tieneClasificacion(participante, "PRECURSOR_REGULAR") && (
        <div
          className={
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 " +
            (horas >= META_PRECURSOR_ANUAL
              ? "border-verde/40 bg-verde/5"
              : "border-gold/40 bg-gold/10")
          }
        >
          <div>
            <p className="text-sm font-bold">
              Horas del año de servicio:{" "}
              <span
                className={
                  horas >= META_PRECURSOR_ANUAL ? "text-verde" : "text-gold"
                }
              >
                {horas} / {META_PRECURSOR_ANUAL}
              </span>
            </p>
            <p className="text-xs text-suave">
              {horas >= META_PRECURSOR_ANUAL
                ? `Cumplió la meta de ${META_PRECURSOR_ANUAL} horas del año de servicio.`
                : `Todavía no llega a las ${META_PRECURSOR_ANUAL} horas del año de servicio.`}
              {fueAuxiliarAhora && (
                <> Reportó {etiquetaMes(ultimoMes)} como precursor auxiliar.</>
              )}
            </p>
          </div>
          <span
            className={
              "text-lg font-black " +
              (horas >= META_PRECURSOR_ANUAL ? "text-verde" : "text-rojo")
            }
          >
            {textoHorasFaltan(horas)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Panel className="p-3 text-center">
          <Clock size={15} className="mx-auto text-teal" />
          <p className="mt-1 text-lg font-black">{resumen.horas}</p>
          <p className="text-[10px] tracking-wider text-suave uppercase">Horas del año</p>
        </Panel>
        <Panel className="p-3 text-center">
          <CalendarCheck size={15} className="mx-auto text-verde" />
          <p className="mt-1 text-lg font-black">{resumen.estudios}</p>
          <p className="text-[10px] tracking-wider text-suave uppercase">Estudios bíblicos</p>
        </Panel>
        <Panel className="p-3 text-center">
          <CalendarCheck size={15} className="mx-auto text-suave" />
          <p className="mt-1 text-lg font-black">
            {resumen.meses}
            <span className="text-sm font-semibold text-suave">/12</span>
          </p>
          <p className="text-[10px] tracking-wider text-suave uppercase">Meses informados</p>
        </Panel>
        <Panel className="p-3 text-center">
          <CalendarCheck size={15} className="mx-auto text-suave" />
          <p className="mt-1 text-lg font-black">
            {resumen.precursores}
            <span className="text-xs font-semibold text-suave">P</span> ·{" "}
            {resumen.auxiliares}
            <span className="text-xs font-semibold text-suave">A</span>
          </p>
          <p className="text-[10px] tracking-wider text-suave uppercase">Precursores · aux.</p>
        </Panel>
      </div>

      {aviso && (
        <p className="rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {aviso}
        </p>
      )}

      {cargando ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-suave">
          <Loader2 size={16} className="animate-spin" /> Cargando actividad...
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-linea text-left text-[11px] tracking-widest text-suave uppercase">
                <th className="px-2 py-2 font-bold">Mes</th>
                <th className="px-2 py-2 font-bold">Situación</th>
                <th className="px-2 py-2 font-bold">Horas</th>
                <th className="px-2 py-2 font-bold">Estudios</th>
                <th className="px-2 py-2 font-bold">Obs.</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const inf = fila.informe;
                return (
                  <tr key={fila.clave} className="border-b border-linea/60 last:border-0">
                    <td className="px-2 py-2 font-semibold whitespace-nowrap">{fila.corto}</td>
                    <td className="px-2 py-2">
                      {inf ? (
                        <Etiqueta tono={inf.tipo === "PUBLICADOR" ? "neutro" : "teal"}>
                          {textoTipo(inf.tipo)}
                        </Etiqueta>
                      ) : fila.marcada ? (
                        <Etiqueta tono="verde">Cargado (otra web)</Etiqueta>
                      ) : (
                        <span className="text-xs text-suave">Sin informar</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {inf ? (
                        inf.tipo === "PUBLICADOR" ? (
                          <Etiqueta tono={inf.participo ? "verde" : "neutro"}>
                            {inf.participo ? "Sí" : "No"}
                          </Etiqueta>
                        ) : (
                          <span className="font-bold text-teal">
                            {inf.horas ?? "—"}
                            {inf.horas_meta ? (
                              <span className="ml-1 text-[10px] font-semibold text-suave">
                                (meta {inf.horas_meta})
                              </span>
                            ) : null}
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2 font-semibold">{inf ? inf.estudios_biblicos : "—"}</td>
                    <td className="max-w-[180px] px-2 py-2 text-xs text-suave">
                      {inf?.observaciones || "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {fila.clave > ultimoMes ? (
                        <span className="text-[11px] text-suave">aún no</span>
                      ) : soloLectura ? (
                        <span className="text-[11px] text-suave">—</span>
                      ) : (
                        <Boton
                          variante="fantasma"
                          className="px-2 py-1 text-xs"
                          onClick={() =>
                            setEditando({ clave: fila.clave, informe: inf, marca: fila.marcada })
                          }
                        >
                          <Pencil size={13} />
                          {inf ? "Editar" : "Cargar"}
                        </Boton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-linea pt-4">
        <Etiqueta tono={participante.activo ? "verde" : "rojo"}>
          {participante.activo ? "ACTIVO" : "INACTIVO"}
        </Etiqueta>
        {soloLectura ? null : (
        <Boton
          variante={participante.activo ? "peligro" : "secundario"}
          onClick={alternarActivo}
          disabled={guardando}
          className="px-3 py-1.5 text-xs"

        >
          {participante.activo ? (
            <>
              <UserX size={14} /> Pasar a inactivo
            </>
          ) : (
            <>
              <UserCheck size={14} /> Volver a activo
            </>
          )}
        </Boton>
        )}
      </div>

      {editando !== null && !soloLectura && (
        <EditorInforme
          participantes={[participante]}
          participanteId={participante.id}
          informe={editando.informe}
          mes={editando.clave}
          mostrarSelector={false}
          onCambiarPersona={() => {}}
          onCancelar={() => setEditando(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
          guardando={guardando}
        />
      )}
    </div>
  );
}