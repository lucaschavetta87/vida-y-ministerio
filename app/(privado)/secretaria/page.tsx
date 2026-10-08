"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  FileDown,
  FilePlus2,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Search,
  Users,
} from "lucide-react";
import EditorInforme from "@/components/EditorInforme";
import SecretariaAsistencias from "@/components/SecretariaAsistencias";
import { Boton, Campo, Etiqueta, Input, Panel, Select, Titulo } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  etiquetaMes,
  mesAnterior,
  ultimosMeses,
  type BorradorInforme,
  type Informe,
  type MarcaInforme,
  type MesCerrado,
  type TipoInforme,
} from "@/lib/informes";
import type { Participante } from "@/lib/tipos";

const AVISO_SUPABASE = "No se pudo leer Supabase. Revisá la conexión.";

const SECCIONES: { tipo: TipoInforme; titulo: string; detalle: string }[] = [
  {
    tipo: "PRECURSOR",
    titulo: "Precursores",
    detalle: "Horas, estudios bíblicos y observaciones",
  },
  {
    tipo: "AUXILIAR",
    titulo: "Precursores auxiliares",
    detalle: "Meta (15 o 30), horas reales, estudios y observaciones",
  },
  {
    tipo: "PUBLICADOR",
    titulo: "Publicadores",
    detalle: "Participación, estudios bíblicos y observaciones",
  },
];

interface Editando {
  participanteId: string;
  informeId: string | null;
}

interface Datos {
  participantes: Participante[];
  informes: Informe[];
  marcas: MarcaInforme[];
  mesCerrado: MesCerrado | null;
  error: string;
  errorOpcional: string;
}

async function traerDatos(mes: string): Promise<Datos> {
  const [p, i, m, c] = await Promise.all([
    supabase
      .from("participantes")
      .select("*")
      .eq("activo", true)
      .order("nombre_completo"),
    supabase.from("informes").select("*").eq("mes", mes),
    supabase.from("marcas_informe").select("*").eq("mes", mes),
    supabase.from("informes_meses").select("*").eq("mes", mes).maybeSingle(),
  ]);
  return {
    participantes: (p.data as Participante[]) || [],
    informes: (i.data as Informe[]) || [],
    marcas: (m.data as MarcaInforme[]) || [],
    mesCerrado: (c.data as MesCerrado) || null,
    // las marcas y el cierre son opcionales: si falta el SQL, la página sigue andando
    error: p.error?.message || i.error?.message || "",
    errorOpcional: m.error?.message || c.error?.message || "",
  };
}

export default function PaginaSecretaria() {
  const [mes, setMes] = useState(mesAnterior());
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [informes, setInformes] = useState<Informe[]>([]);
  const [marcas, setMarcas] = useState<MarcaInforme[]>([]);
  const [mesCerrado, setMesCerrado] = useState<MesCerrado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [editando, setEditando] = useState<Editando | null>(null);
  const [filtro, setFiltro] = useState("");
  const [pestana, setPestana] = useState<"informes" | "asistencias">("informes");

  const meses = useMemo(() => ultimosMeses(24), []);

  const aplicar = useCallback((datos: Datos) => {
    if (datos.error) {
      setErrorCarga(`${AVISO_SUPABASE} ${datos.error}`);
      setCargando(false);
      return;
    }
    setParticipantes(datos.participantes);
    setInformes(datos.informes);
    setMarcas(datos.marcas);
    setMesCerrado(datos.mesCerrado);
    setAviso(datos.errorOpcional ? "Falta una parte del SQL (marcas/cierre de mes)." : "");
    setErrorCarga("");
    setCargando(false);
  }, []);

  const cargar = useCallback(
    (mesElegido: string) => {
      setCargando(true);
      return traerDatos(mesElegido).then(aplicar);
    },
    [aplicar],
  );

  useEffect(() => {
    let cancelado = false;
    traerDatos(mes).then((datos) => {
      if (!cancelado) aplicar(datos);
    });
    return () => {
      cancelado = true;
    };
  }, [aplicar, mes]);

  const porId = useMemo(() => {
    const mapa = new Map<string, Informe>();
    informes.forEach((inf) => mapa.set(inf.participante_id, inf));
    return mapa;
  }, [informes]);

  const marcados = useMemo(() => {
    const mapa = new Map<string, MarcaInforme>();
    marcas.forEach((m) => mapa.set(m.participante_id, m));
    return mapa;
  }, [marcas]);

  const nombreDe = useCallback(
    (id: string) => participantes.find((p) => p.id === id)?.nombre_completo || "(desconocido)",
    [participantes],
  );

  // sin informe y sin marca en verde = todavía no entregó
  // (solo los tildados como "Es publicador" informan)
  const faltan = useMemo(
    () =>
      participantes.filter(
        (p) => p.es_publicador !== false && !porId.has(p.id) && !marcados.has(p.id),
      ),
    [participantes, porId, marcados],
  );

  const faltanFiltrados = useMemo(() => {
    const objetivo = filtro.trim().toLowerCase();
    if (!objetivo) return faltan;
    return faltan.filter((p) => p.nombre_completo.toLowerCase().includes(objetivo));
  }, [faltan, filtro]);

  const enSeccion = useCallback(
    (tipo: TipoInforme) =>
      informes
        .filter((i) => i.tipo === tipo)
        .sort((a, b) =>
          nombreDe(a.participante_id).localeCompare(nombreDe(b.participante_id), "es"),
        ),
    [informes, nombreDe],
  );

  const guardar = async (borrador: BorradorInforme) => {
    if (!editando) return;
    setGuardando(true);
    const ahora = new Date().toISOString();
    const base = {
      mes,
      tipo: borrador.tipo,
      horas: borrador.horas,
      horas_meta: borrador.horas_meta,
      participo: borrador.participo,
      estudios_biblicos: borrador.estudios_biblicos,
      observaciones: borrador.observaciones,
      origen: "secretaria",
      actualizado_en: ahora,
    };

    const respuesta = editando.informeId
      ? await supabase
          .from("informes")
          .update(base)
          .eq("id", editando.informeId)
          .select()
          .maybeSingle()
      : await supabase
          .from("informes")
          .insert({ ...base, participante_id: editando.participanteId })
          .select()
          .maybeSingle();

    setGuardando(false);
    if (respuesta.error || !respuesta.data) {
      setAviso(
        respuesta.error?.code === "23505"
          ? "Esa persona ya tiene un informe cargado para este mes."
          : `No se pudo guardar: ${respuesta.error?.message || "error desconocido"}`,
      );
      return;
    }
    setEditando(null);
    await cargar(mes);
  };

  const eliminar = async () => {
    if (!editando?.informeId) return;
    setGuardando(true);
    const respuesta = await supabase.from("informes").delete().eq("id", editando.informeId);
    setGuardando(false);
    if (respuesta.error) {
      setAviso(`No se pudo borrar: ${respuesta.error.message}`);
      return;
    }
    setEditando(null);
    await cargar(mes);
  };

  /** Marca verde: esa persona ya cargó su informe en la otra web. */
  const alternarMarca = async (participanteId: string) => {
    setGuardando(true);
    const existe = marcados.has(participanteId);
    const respuesta = existe
      ? await supabase
          .from("marcas_informe")
          .delete()
          .eq("participante_id", participanteId)
          .eq("mes", mes)
      : await supabase.from("marcas_informe").insert({ participante_id: participanteId, mes });

    setGuardando(false);
    if (respuesta.error) {
      setAviso(
        existe
          ? `No se pudo quitar la marca: ${respuesta.error.message}`
          : `No se pudo marcar: ${respuesta.error.message}. ¿Pegaste el SQL de informes_ampliacion.sql?`,
      );
      return;
    }
    await cargar(mes);
  };

  const cerrarMes = async () => {
    if (
      !window.confirm(
        `¿Cerrar el mes de ${etiquetaMes(mes)}?\n\nNo se borra nada: los informes quedan guardados y los que falten dejan de pedirse.`,
      )
    )
      return;
    setGuardando(true);
    const respuesta = await supabase
      .from("informes_meses")
      .upsert({ mes, cerrado_en: new Date().toISOString() });
    setGuardando(false);
    if (respuesta.error) {
      setAviso(
        `No se pudo cerrar el mes: ${respuesta.error.message}. ¿Pegaste el SQL de informes_ampliacion.sql?`,
      );
      return;
    }
    await cargar(mes);
  };

  const reabrirMes = async () => {
    setGuardando(true);
    const respuesta = await supabase.from("informes_meses").delete().eq("mes", mes);
    setGuardando(false);
    if (respuesta.error) {
      setAviso(`No se pudo reabrir: ${respuesta.error.message}`);
      return;
    }
    await cargar(mes);
  };

  const cambioDeMes = (nuevo: string) => {
    setMes(nuevo);
    setFiltro("");
  };

  const BotonCargado = ({ participanteId }: { participanteId: string }) => {
    const activo = marcados.has(participanteId);
    return (
      <Boton
        variante={activo ? "secundario" : "fantasma"}
        className={activo ? "px-2.5 py-1 text-xs" : "px-2.5 py-1 text-xs"}
        disabled={guardando}
        title={
          activo
            ? "Marcado como cargado en la otra web. Tocá para quitar la marca."
            : "Marcar en verde: ya se cargó en la otra web"
        }
        onClick={() => alternarMarca(participanteId)}
      >
        <CheckCircle2 size={14} className={activo ? "text-verde" : "text-suave"} />
        <span className={activo ? "font-bold text-verde" : undefined}>Cargado</span>
      </Boton>
    );
  };

  const publicadores = useMemo(
    () => participantes.filter((p) => p.es_publicador !== false).length,
    [participantes],
  );

  const tabs = (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-linea">
      {(
        [
          { valor: "informes", texto: "Informes", Icono: ClipboardList },
          { valor: "asistencias", texto: "Asistencias a las reuniones", Icono: Users },
        ] as const
      ).map(({ valor, texto, Icono }) => (
        <button
          key={valor}
          onClick={() => setPestana(valor)}
          className={cn(
            "flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors",
            pestana === valor
              ? "border-teal text-teal"
              : "border-transparent text-suave hover:text-texto",
          )}
        >
          <Icono size={15} />
          {texto}
        </button>
      ))}
    </div>
  );

  if (pestana === "asistencias") {
    return (
      <div>
        <Titulo>Secretaría</Titulo>
        {tabs}
        <SecretariaAsistencias />
      </div>
    );
  }

  return (
    <div>
      <Titulo>Secretaría</Titulo>
      {tabs}

      <Panel className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <Campo label="Mes del informe" className="w-full sm:w-64">
            <Select value={mes} onChange={(e) => cambioDeMes(e.target.value)}>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {etiquetaMes(m)}
                  {m === mesAnterior() ? " (mes en curso)" : ""}
                </option>
              ))}
            </Select>
          </Campo>
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta tono="teal">
              <ClipboardList size={12} /> Enviaron: {informes.length}
            </Etiqueta>
            <Etiqueta tono={marcas.length ? "verde" : "neutro"}>
              <CheckCircle2 size={12} /> Cargados en otra web: {marcas.length}
            </Etiqueta>
            <Etiqueta tono={faltan.length ? "rojo" : "verde"}>
              <Users size={12} /> Faltan: {faltan.length}
            </Etiqueta>
            <Etiqueta tono="neutro">Publicadores: {publicadores}</Etiqueta>
            {publicadores !== participantes.length && (
              <Etiqueta tono="neutro">Congregación: {participantes.length}</Etiqueta>
            )}
          </div>
          <p className="w-full text-xs text-suave sm:ml-auto sm:w-auto">
            <CalendarRange size={12} className="mr-1 inline" />
            {etiquetaMes(mesAnterior())} es el mes que está informando la gente.
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
                {new Date(mesCerrado.cerrado_en).toLocaleDateString("es-AR")}. Nada se borró: los
                datos siguen en la pestaña Actividad del Año de cada persona.
              </span>
              <Boton variante="secundario" className="ml-auto" onClick={reabrirMes} disabled={guardando}>
                <LockOpen size={15} /> Reabrir mes
              </Boton>
            </>
          ) : (
            <Boton variante="secundario" onClick={cerrarMes} disabled={guardando}>
              <Lock size={15} /> Cerrar el mes de {etiquetaMes(mes).split(" de ")[0]}
            </Boton>
          )}
          <Link
            href="/secretaria/informes/pdf"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-suave"
          >
            <FileDown size={15} /> Descargar informe del año (PDF)
          </Link>
        </div>
      </Panel>

      {errorCarga && (
        <Panel className="mb-6 p-6 text-sm">
          <p className="text-sm font-semibold text-rojo">No se pudieron leer los informes.</p>
          <p className="mt-1 text-suave">{errorCarga}</p>
          <p className="mt-3 text-suave">
            Si todavía no pegaste los scripts, corré{" "}
            <code className="font-mono">supabase/informes.sql</code> y{" "}
            <code className="font-mono">supabase/informes_ampliacion.sql</code> en Supabase.
          </p>
        </Panel>
      )}

      {aviso && (
        <div className="mb-5 rounded-xl border border-rojo/30 bg-rojo/5 px-4 py-3 text-sm font-semibold text-rojo">
          {aviso}
        </div>
      )}

      {cargando ? (
        <Panel className="flex items-center justify-center gap-2 p-10 text-sm text-suave">
          <Loader2 size={18} className="animate-spin" /> Cargando informes...
        </Panel>
      ) : errorCarga ? null : (
        <>
          <Panel className="mb-6 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-black tracking-tight">
                <Users size={16} className={faltan.length ? "text-rojo" : "text-verde"} />
                {mesCerrado
                  ? `Mes cerrado · enviaron ${informes.length + marcas.length} de ${publicadores}`
                  : `Falta enviar su informe (${faltan.length})`}
              </h2>
              <div className="relative w-full sm:w-64">
                <Search
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-suave"
                />
                <Input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar nombre"
                  className="pl-9"
                />
              </div>
            </div>

            {mesCerrado ? (
              <p className="text-sm text-suave">
                El mes está cerrado, así que ya no se piden los que faltaron. Podés seguir cargando o
                corrigiendo informes, o reabrir el mes si hace falta.
              </p>
            ) : faltan.length === 0 ? (
              <p className="text-sm text-verde">
                Todos los participantes de la congregación enviaron su informe de {etiquetaMes(mes)}.
                Ya podés cerrar el mes.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {faltanFiltrados.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-linea bg-tarjeta2 px-3 py-2"
                  >
                    <span className="truncate text-sm font-semibold">{p.nombre_completo}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <BotonCargado participanteId={p.id} />
                      <Boton
                        variante="secundario"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => setEditando({ participanteId: p.id, informeId: null })}
                      >
                        <FilePlus2 size={14} /> Cargar
                      </Boton>
                    </span>
                  </li>
                ))}
                {faltanFiltrados.length === 0 && (
                  <p className="text-sm text-suave">Nadie coincide con ese filtro.</p>
                )}
              </ul>
            )}
          </Panel>

          {SECCIONES.map(({ tipo, titulo, detalle }) => {
            const lista = enSeccion(tipo);
            const totalHoras = lista.reduce((suma, i) => suma + (i.horas ?? 0), 0);
            const totalEstudios = lista.reduce((suma, i) => suma + (i.estudios_biblicos ?? 0), 0);
            const conHoras = tipo !== "PUBLICADOR";

            return (
              <Panel key={tipo} className="mb-6 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linea bg-tarjeta2 px-5 py-3">
                  <div>
                    <h2 className="text-sm font-black tracking-tight">{titulo}</h2>
                    <p className="text-xs text-suave">{detalle}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Etiqueta>{lista.length} personas</Etiqueta>
                    {conHoras && <Etiqueta tono="teal">Horas: {totalHoras}</Etiqueta>}
                    <Etiqueta tono="verde">Estudios: {totalEstudios}</Etiqueta>
                  </div>
                </div>

                {lista.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-suave">
                    Nadie de esta sección envió su informe de {etiquetaMes(mes)}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-linea text-left text-[11px] tracking-widest text-suave uppercase">
                          <th className="px-5 py-2.5 font-bold">Nombre</th>
                          {tipo === "AUXILIAR" && <th className="px-5 py-2.5 font-bold">Meta</th>}
                          <th className="px-5 py-2.5 font-bold">
                            {conHoras ? "Horas" : "Participó"}
                          </th>
                          <th className="px-5 py-2.5 font-bold">Estudios</th>
                          <th className="px-5 py-2.5 font-bold">Observaciones</th>
                          <th className="px-5 py-2.5 font-bold">Enviado</th>
                          <th className="px-5 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((informe) => (
                          <tr key={informe.id} className="border-b border-linea/60 last:border-0">
                            <td className="px-5 py-3 font-bold">
                              {nombreDe(informe.participante_id)}
                            </td>
                            {tipo === "AUXILIAR" && (
                              <td className="px-5 py-3">
                                <Etiqueta tono={informe.horas_meta === 30 ? "teal" : "neutro"}>
                                  {informe.horas_meta ? `${informe.horas_meta} h` : "—"}
                                </Etiqueta>
                              </td>
                            )}
                            <td className="px-5 py-3">
                              {conHoras ? (
                                <span className="font-bold text-teal">{informe.horas ?? "—"}</span>
                              ) : informe.participo === null ? (
                                "—"
                              ) : (
                                <Etiqueta tono={informe.participo ? "verde" : "neutro"}>
                                  {informe.participo ? "Sí" : "No"}
                                </Etiqueta>
                              )}
                            </td>
                            <td className="px-5 py-3 font-semibold">{informe.estudios_biblicos}</td>
                            <td className="max-w-[240px] px-5 py-3 text-suave">
                              {informe.observaciones || "—"}
                            </td>
                            <td className="px-5 py-3 text-xs text-suave">
                              {informe.origen === "secretaria" ? "Secretaría" : "Formulario"}
                              <br />
                              {new Date(informe.enviado_en).toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <BotonCargado participanteId={informe.participante_id} />
                                <Boton
                                  variante="fantasma"
                                  className="px-2.5 py-1 text-xs"
                                  onClick={() =>
                                    setEditando({
                                      participanteId: informe.participante_id,
                                      informeId: informe.id,
                                    })
                                  }
                                >
                                  <Pencil size={14} /> Editar
                                </Boton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            );
          })}
        </>
      )}

      {editando && (
        <EditorInforme
          participantes={participantes}
          participanteId={editando.participanteId}
          informe={informes.find((i) => i.id === editando.informeId) || null}
          onCambiarPersona={(id) =>
            setEditando({ participanteId: id, informeId: porId.get(id)?.id || null })
          }
          onCancelar={() => setEditando(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
          guardando={guardando}
        />
      )}
    </div>
  );
}
