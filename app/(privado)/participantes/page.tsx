"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Boton, Etiqueta, Modal, Panel, Titulo } from "@/components/ui";
import ParticipanteForm from "@/components/ParticipanteForm";
import ActividadDelAnio from "@/components/ActividadDelAnio";
import GestionRoles from "@/components/GestionRoles";
import { supabase } from "@/lib/supabase";
import {
  META_PRECURSOR_ANUAL,
  rangoAnioServicio,
  anioServicioActual,
  etiquetaAnioServicio,
  horasDelAnio,
  textoHorasFaltan,
} from "@/lib/anio-servicio";
import { etiquetaMes, mesAnterior } from "@/lib/informes";
import type { Informe, MarcaInforme } from "@/lib/informes";
import {
  tieneClasificacion,
  textoClasificacion,
  type Asignacion,
  type Participante,
  type Rol,
} from "@/lib/tipos";

const AVISO_SUPABASE =
  "No se pudo leer Supabase. ¿Ejecutaste el script SQL en el panel?";

interface DatosParticipantes {
  participantes: Participante[];
  roles: Rol[];
  asignaciones: Asignacion[];
  informes: Informe[];
  marcas: MarcaInforme[];
  error: string;
  /** Si falla la consulta de informes, no se marca a nadie como irregular. */
  errorInformes: string;
}

async function traerDatos(): Promise<DatosParticipantes> {
  // todo el año de servicio, para poder mostrar las horas del año
  const rango = rangoAnioServicio(anioServicioActual());
  const [p, r, a, i, m] = await Promise.all([
    supabase.from("participantes").select("*").order("nombre_completo"),
    supabase.from("roles").select("*").order("orden"),
    supabase.from("participante_roles").select("*"),
    supabase
      .from("informes")
      .select("participante_id, mes, horas, tipo")
      .gte("mes", rango.desde)
      .lte("mes", rango.hasta),
    supabase
      .from("marcas_informe")
      .select("participante_id, mes")
      .gte("mes", rango.desde)
      .lte("mes", rango.hasta),
  ]);
  return {
    participantes: (p.data as Participante[]) || [],
    roles: (r.data as Rol[]) || [],
    asignaciones: (a.data as Asignacion[]) || [],
    informes: (i.data as Informe[]) || [],
    marcas: (m.data as MarcaInforme[]) || [],
    error: p.error?.message || r.error?.message || a.error?.message || "",
    errorInformes: i.error?.message || m.error?.message || "",
  };
}

export default function PaginaParticipantes() {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [informesMes, setInformesMes] = useState<Informe[]>([]);
  const [marcasMes, setMarcasMes] = useState<MarcaInforme[]>([]);
  const [datosInformesOk, setDatosInformesOk] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroInactivos, setFiltroInactivos] = useState(false);
  const [filtroIrregulares, setFiltroIrregulares] = useState(false);
  const [filtroPrecursores, setFiltroPrecursores] = useState(false);
  const [filtroAncianos, setFiltroAncianos] = useState(false);
  const [filtroSiervos, setFiltroSiervos] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Participante | null>(null);
  /** Persona cuya actividad se está viendo (solo lectura). */
  const [viendo, setViendo] = useState<Participante | null>(null);
  /** Con qué pestaña se abre el formulario. */
  const [pestanaForm, setPestanaForm] = useState<"ficha" | "actividad">("ficha");
  const [rolesAbierto, setRolesAbierto] = useState(false);
  const [aviso, setAviso] = useState("");

  const aplicar = useCallback((datos: DatosParticipantes) => {
    if (datos.error) {
      setAviso(AVISO_SUPABASE);
      setCargando(false);
      return;
    }
    setParticipantes(datos.participantes);
    setRoles(datos.roles);
    setAsignaciones(datos.asignaciones);
    setInformesMes(datos.informes);
    setMarcasMes(datos.marcas);
    setDatosInformesOk(!datos.errorInformes);
    setAviso(
      datos.errorInformes
        ? "No se pudieron leer los informes del mes: el filtro de irregulares no está disponible. ¿Pegaste supabase/informes.sql?"
        : "",
    );
    setCargando(false);
  }, []);

  const cargar = useCallback(async () => {
    aplicar(await traerDatos());
  }, [aplicar]);

  useEffect(() => {
    let cancelado = false;
    traerDatos().then((datos) => {
      if (!cancelado) aplicar(datos);
    });
    return () => {
      cancelado = true;
    };
  }, [aplicar]);

  /** Ya informou el mes que se está informando (SOLO el mes en curso). */
  /** Horas del año de servicio de cada persona (para la meta de 600). */
  const horasAnio = useMemo(
    () => horasDelAnio(informesMes, marcasMes),
    [informesMes, marcasMes],
  );

  const esPrecursor = useCallback(
    (p: Participante) => tieneClasificacion(p, "PRECURSOR_REGULAR"),
    [],
  );
  const esAnciano = useCallback((p: Participante) => tieneClasificacion(p, "ANCIANO"), []);
  const esSiervo = useCallback(
    (p: Participante) => tieneClasificacion(p, "SIERVO_MINISTERIAL"),
    [],
  );

  const informaron = useMemo(() => {
    const ids = new Set<string>();
    informesMes.forEach((i) => ids.add(i.participante_id));
    marcasMes.forEach((m) => ids.add(m.participante_id));
    return ids;
  }, [informesMes, marcasMes]);

  /** Activos y publicadores sin informe del mes en curso = irregulares. */
  const irregulares = useMemo(() => {
    if (!datosInformesOk) return new Set<string>();
    return new Set(
      participantes
        .filter(
          (p) =>
            p.activo && p.es_publicador !== false && !informaron.has(p.id),
        )
        .map((p) => p.id),
    );
  }, [participantes, informaron, datosInformesOk]);

  const precursores = useMemo(
    () => participantes.filter(esPrecursor),
    [participantes, esPrecursor],
  );
  const ancianos = useMemo(() => participantes.filter(esAnciano), [participantes, esAnciano]);
  const siervos = useMemo(() => participantes.filter(esSiervo), [participantes, esSiervo]);
  const publicadores = useMemo(
    () => participantes.filter((p) => p.activo && p.es_publicador !== false).length,
    [participantes],
  );
  const activos = useMemo(() => participantes.filter((p) => p.activo).length, [participantes]);

  /** Todas las personas dadas de baja (el estado se cambia a mano). */
  const inactivos = useMemo(
    () => participantes.filter((p) => !p.activo).map((p) => p.id),
    [participantes],
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return participantes.filter((p) => {
      if (filtroInactivos) {
        if (p.activo) return false;
      } else if (!p.activo) {
        return false;
      }
      if (filtroIrregulares && !irregulares.has(p.id)) return false;
      if (filtroPrecursores && !esPrecursor(p)) return false;
      if (filtroAncianos && !esAnciano(p)) return false;
      if (filtroSiervos && !esSiervo(p)) return false;
      if (!q) return true;
      return (
        p.nombre_completo.toLowerCase().includes(q) ||
        (p.telefono || "").includes(q) ||
        (p.direccion || "").toLowerCase().includes(q)
      );
    });
  }, [
    participantes,
    busqueda,
    filtroInactivos,
    filtroIrregulares,
    filtroPrecursores,
    filtroAncianos,
    filtroSiervos,
    irregulares,
    esPrecursor,
    esAnciano,
    esSiervo,
  ]);

  const mayores = useMemo(
    () =>
      participantes.filter(
        (p) =>
          p.activo &&
          (p.genero === "HOMBRE" || p.genero === "MUJER") &&
          p.id !== editando?.id,
      ),
    [participantes, editando],
  );

  const rolesDe = (id: string) =>
    asignaciones
      .filter((a) => a.participante_id === id)
      .map((a) => roles.find((r) => r.id === a.role_id))
      .filter((r): r is Rol => Boolean(r));

  const guardar = async (
    datos: Omit<Participante, "id"> & { id?: string },
    roleIds: string[],
  ): Promise<string | null> => {
    const campos = {
       nombre_completo: datos.nombre_completo.trim(),
       genero: datos.genero,
       edad: datos.edad || null,
       fecha_nacimiento: datos.fecha_nacimiento || null,
       telefono: datos.telefono || null,
       telefono_fijo: datos.telefono_fijo || null,
       direccion: datos.direccion || null,
       fecha_bautismo: datos.fecha_bautismo || null,
       anios_bautizado: datos.anios_bautizado ?? null,
       es_secretario: datos.es_secretario || false,
       miembro_comite_asamblea: datos.miembro_comite_asamblea || false,
       estado_civil: datos.estado_civil || null,
       conyuge_id: datos.conyuge_id || null,
       parentesco_tipo:
         datos.genero === "NIÑO" || datos.genero === "NIÑA"
           ? (datos.parentesco_tipo || null)
           : null,
       parentesco_con:
         datos.genero === "NIÑO" || datos.genero === "NIÑA"
           ? datos.parentesco_con
           : null,
       clasificacion: datos.clasificacion || null,
       retiro_donaciones_aprobado: datos.retiro_donaciones_aprobado || false,
       lector_atalaya_aprobado: datos.lector_atalaya_aprobado || false,
      es_publicador: datos.es_publicador !== false,
       activo: datos.activo,
     };

    let id = datos.id;
    let avisoColumnas = "";
    if (id) {
      let { error } = await supabase.from("participantes").update(campos).eq("id", id);
      if (error && faltaColumnaNueva(error.message)) {
        const reintento = await supabase
          .from("participantes")
          .update(sinColumnasNuevas(campos))
          .eq("id", id);
        error = reintento.error;
        if (!error)
          avisoColumnas =
            "Faltan las columnas nuevas en la base (anios_bautizado, es_secretario, miembro_comite_asamblea, es_publicador, anio_servicio_inicio, contacto_emergencia_nombre, contacto_emergencia_telefono, tipo_bautizado). Corre el SQL de migración.";
      }
      if (error) return traducir(error.message);
    } else {
      let { data, error } = await supabase
        .from("participantes")
        .insert(campos)
        .select("id")
        .single();
      if (error && faltaColumnaNueva(error.message)) {
        const reintento = await supabase
          .from("participantes")
          .insert(sinColumnasNuevas(campos))
          .select("id")
          .single();
        data = reintento.data;
        error = reintento.error;
        if (!error)
          avisoColumnas =
            "Faltan las columnas nuevas en la base (anios_bautizado, es_secretario, miembro_comite_asamblea, es_publicador, anio_servicio_inicio, contacto_emergencia_nombre, contacto_emergencia_telefono, tipo_bautizado). Corre el SQL de migración.";
      }
      if (error) return traducir(error.message);
      if (!data) return "No se pudo guardar el participante.";
      id = data.id;
    }

    const { error: errDel } = await supabase
      .from("participante_roles")
      .delete()
      .eq("participante_id", id);
    if (errDel) return traducir(errDel.message);

    if (roleIds.length > 0) {
      const { error: errIns } = await supabase
        .from("participante_roles")
        .insert(roleIds.map((r) => ({ participante_id: id, role_id: r })));
      if (errIns) return traducir(errIns.message);
    }

    await cargar();
    setFormAbierto(false);
    setEditando(null);
    setAviso(avisoColumnas);
    return null;
  };

  const alternarActivo = async (p: Participante) => {
    const accion = p.activo ? "desactivar" : "reactivar";
    if (!window.confirm(`¿${accion[0].toUpperCase() + accion.slice(1)} a ${p.nombre_completo}?`))
      return;
    const { error } = await supabase
      .from("participantes")
      .update({ activo: !p.activo })
      .eq("id", p.id);
    if (error) setAviso(traducir(error.message));
    else await cargar();
  };

  const eliminar = async (p: Participante) => {
    if (
      !window.confirm(
        `¿Eliminar a ${p.nombre_completo}?\n\n` +
          "Se borra su ficha y todo su historial (informes, asistencias y asignaciones). " +
          "Esto no se puede deshacer.",
      )
    )
      return;
    const { error } = await supabase.from("participantes").delete().eq("id", p.id);
    if (error) {
      if (error.message.includes("parentesco")) {
        setAviso(
          "No se puede eliminar: es el mayor de menores cargados. Sacales primero ese parentesco en su ficha.",
        );
      } else if (error.code === "23503") {
        setAviso("No se puede eliminar: todavía hay algo de la base que lo referencia.");
      } else {
        setAviso(traducir(error.message));
      }
      return;
    }
    setAviso("");
    if (editando?.id === p.id) {
      setEditando(null);
      setFormAbierto(false);
    }
    await cargar();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Titulo>Personas de la congregación</Titulo>
          <div className="-mt-4 mb-4 flex flex-wrap items-center gap-2">
            <Etiqueta tono="verde">Activos: {activos}</Etiqueta>
            <Etiqueta tono="teal">Publicadores: {publicadores}</Etiqueta>
            <Etiqueta>Precursores: {precursores.length}</Etiqueta>
            <Etiqueta>Ancianos: {ancianos.length}</Etiqueta>
            <Etiqueta>Siervos: {siervos.length}</Etiqueta>
            <Etiqueta>{roles.length} roles de asignación</Etiqueta>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/participantes/s21"
            target="_blank"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-suave"
          >
            <FileText size={15} /> Todas las fichas S-21
          </Link>
          <Boton variante="secundario" onClick={() => setRolesAbierto(true)}>
            <Settings2 size={15} /> Gestionar roles
          </Boton>
          <Boton
            onClick={() => {
              setEditando(null);
              setPestanaForm("ficha");
              setFormAbierto(true);
            }}
          >
            <Plus size={16} /> Nueva persona
          </Boton>
        </div>
      </div>

      <Panel className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-3 py-2">
          <Search size={15} className="text-suave" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono o dirección…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-suave/70"
          />
        </div>
        <button
          onClick={() => setFiltroInactivos((v) => !v)}
          className={
            "cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold tracking-wide transition-colors " +
            (filtroInactivos
              ? "border-teal bg-teal/10 text-teal"
              : "border-linea text-suave hover:border-suave")
          }
          title="Personas dadas de baja (el estado se cambia a mano, con el botón de la fila o el de la ficha)"
        >
          INACTIVOS
          {inactivos.length ? ` (${inactivos.length})` : ""}
        </button>
        <button
          onClick={() => setFiltroIrregulares((v) => !v)}
          disabled={!datosInformesOk}
          className={
            "cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
            (filtroIrregulares
              ? "border-rojo bg-rojo/10 text-rojo"
              : "border-linea text-suave hover:border-suave")
          }
          title={`Activos que no entregaron el informe de ${etiquetaMes(mesAnterior())}`}
        >
          IRREGULARES{irregulares.size ? ` (${irregulares.size})` : ""}
        </button>
        {(
          [
            [
              "PRECURSORES",
              filtroPrecursores,
              setFiltroPrecursores,
              precursores.length,
              "Precursores Regulares del año de servicio",
            ],
            ["ANCIANOS", filtroAncianos, setFiltroAncianos, ancianos.length, "Anciano en el ministerio"],
            ["SIERVOS", filtroSiervos, setFiltroSiervos, siervos.length, "Siervo Ministerial"],
          ] as const
        ).map(([texto, activo, cambiar, cantidad, descripcion]) => (
          <button
            key={texto}
            onClick={() => cambiar(!activo)}
            title={descripcion}
            className={
              "cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold tracking-wide transition-colors " +
              (activo
                ? "border-teal bg-teal/10 text-teal"
                : "border-linea text-suave hover:border-suave")
            }
          >
            {texto}
            {cantidad ? ` (${cantidad})` : ""}
          </button>
        ))}
        {(filtroInactivos ||
          filtroIrregulares ||
          filtroPrecursores ||
          filtroAncianos ||
          filtroSiervos) && (
          <button
            onClick={() => {
              setFiltroInactivos(false);
              setFiltroIrregulares(false);
              setFiltroPrecursores(false);
              setFiltroAncianos(false);
              setFiltroSiervos(false);
            }}
            className="cursor-pointer px-1 text-xs font-semibold text-teal hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </Panel>

      {aviso && (
        <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {aviso}
        </p>
      )}

      {cargando ? (
        <Panel className="p-10 text-center text-sm text-suave">
          Cargando participantes…
        </Panel>
      ) : visibles.length === 0 ? (
        <Panel className="p-10 text-center">
          <Users size={30} className="mx-auto mb-3 text-suave" />
          <p className="text-sm text-suave">
            {participantes.length === 0
              ? "Todavía no hay personas cargadas. Empezá con el botón “Nueva persona”."
              : filtroInactivos ||
                  filtroIrregulares ||
                  filtroPrecursores ||
                  filtroAncianos ||
                  filtroSiervos
                ? "Ninguna persona coincide con los filtros aplicados."
                : "Ninguna persona coincide con la búsqueda."}
          </p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-linea text-[11px] tracking-widest text-suave uppercase">
                <th className="px-4 py-3 font-bold">Persona</th>
                <th className="px-4 py-3 font-bold">Género</th>
                <th className="px-4 py-3 font-bold">Contacto</th>
                <th className="px-4 py-3 font-bold">Bautismo</th>
                <th className="px-4 py-3 font-bold">Asignaciones</th>
                <th className="px-4 py-3 text-right font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const susRoles = rolesDe(p.id);
                const horas = horasAnio.get(p.id)?.horas ?? 0;
                const esNino = p.genero === "NIÑO" || p.genero === "NIÑA";
                const mayor = p.parentesco_con
                  ? participantes.find((m) => m.id === p.parentesco_con)
                  : null;
                return (
                  <tr
                    key={p.id}
                    className={
                      "border-b border-linea/60 transition-colors hover:bg-tarjeta2/60 " +
                      (!p.activo ? "opacity-50" : "")
                    }
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setViendo(p)}
                        title="Ver el año de servicio"
                        className="cursor-pointer text-left font-semibold hover:text-teal hover:underline"
                      >
                        {p.nombre_completo}
                      </button>
                      {p.edad !== null && p.edad !== undefined && (
                        <div className="text-[11px] text-suave">Edad: {p.edad}</div>
                      )}
                      {p.fecha_nacimiento && (
                        <div className="text-[11px] text-suave">
                          Nacimiento: {new Date(p.fecha_nacimiento + "T12:00:00").toLocaleDateString("es-AR")}
                        </div>
                      )}
                      {p.fecha_bautismo && (
                        <div className="text-[11px] text-suave">
                          Bautismo: {new Date(p.fecha_bautismo + "T12:00:00").toLocaleDateString("es-AR")}
                        </div>
                      )}
                      {p.anios_bautizado !== null && p.anios_bautizado !== undefined && (
                        <div className="text-[11px] text-suave">
                          Años bautizado: {p.anios_bautizado}
                        </div>
                      )}
                      {(p.clasificacion || []).length > 0 && (
                        <div className="mt-1 flex max-w-[260px] flex-wrap gap-1">
                          {p.clasificacion!.map((c) => (
                            <Etiqueta key={c} tono="teal">
                              {textoClasificacion(c)}
                            </Etiqueta>
                          ))}
                        </div>
                      )}
                      {p.es_secretario && (
                        <div className="text-[11px] font-semibold text-teal">Secretario</div>
                      )}
                      {p.miembro_comite_asamblea && (
                        <div className="text-[11px] font-semibold text-teal">
                          Miembro del Comité de Asamblea
                        </div>
                      )}
                      {p.retiro_donaciones_aprobado && p.genero === "HOMBRE" && (
                        <div className="text-[11px] font-semibold text-teal">Retiro de Donaciones: Aprobado</div>
                      )}
                      {p.lector_atalaya_aprobado && p.genero === "HOMBRE" && (
                        <div className="text-[11px] font-semibold text-teal">Lector de Atalaya: Aprobado</div>
                      )}
                      {p.es_publicador === false && (
                        <div className="text-[11px] font-semibold text-rojo">
                          No informa (no es publicador)
                        </div>
                      )}
                      {!p.activo && (
                        <div className="text-[11px] font-semibold text-rojo">INACTIVO</div>
                      )}
                      {p.activo && irregulares.has(p.id) && (
                        <div className="text-[11px] font-semibold text-rojo">
                          Sin informe de {etiquetaMes(mesAnterior())}
                        </div>
                      )}
                      {esPrecursor(p) && (
                        <div className="text-[11px]">
                          <span
                            className={
                              "font-semibold " +
                              (horas >= META_PRECURSOR_ANUAL ? "text-verde" : "text-rojo")
                            }
                          >
                            {textoHorasFaltan(horas)}
                          </span>{" "}
                          <span className="text-suave">· {horas} h de {META_PRECURSOR_ANUAL}</span>
                        </div>
                      )}
                      {horasAnio.get(p.id)?.auxiliarMesActual && (
                        <div className="text-[11px] text-suave">
                          Reportó como precursor auxiliar en{" "}
                          {etiquetaMes(mesAnterior())}
                        </div>
                      )}
                      {esNino && (
                        <div className="text-[11px] text-suave">
                          {p.parentesco_tipo} de{" "}
                          {mayor ? mayor.nombre_completo : "mayor no cargado"}
                        </div>
                      )}
                      {p.estado_civil && (
                        <div className="text-[11px] text-suave">Estado: {p.estado_civil}</div>
                      )}
                      <div className="text-[11px] text-suave">
                        Ficha desde: {etiquetaAnioServicio(p.anio_servicio_inicio ?? anioServicioActual())}
                      </div>
                      {p.conyuge_id && (
                        <div className="text-[11px] text-suave">
                          Cónyuge: {participantes.find((m) => m.id === p.conyuge_id)?.nombre_completo || "—"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Etiqueta
                        tono={
                          p.genero === "HOMBRE"
                            ? "teal"
                            : p.genero === "MUJER"
                              ? "neutro"
                              : "neutro"
                        }
                      >
                        {p.genero}
                      </Etiqueta>
                    </td>
                    <td className="px-4 py-3 text-suave">
                      <div>{p.telefono || "—"} {p.telefono_fijo ? ` / ${p.telefono_fijo}` : ""}</div>
                      <div className="text-[11px]">{p.direccion || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-suave">
                      {p.fecha_bautismo
                        ? new Date(p.fecha_bautismo + "T12:00:00").toLocaleDateString(
                            "es-AR",
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {susRoles.length === 0 && (
                          <span className="text-[11px] text-suave">
                            Sin asignaciones
                          </span>
                        )}
                        {susRoles.slice(0, 3).map((r) => (
                          <Etiqueta key={r.id} tono="teal">
                            {r.nombre}
                          </Etiqueta>
                        ))}
                        {susRoles.length > 3 && (
                          <Etiqueta>+{susRoles.length - 3}</Etiqueta>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setPestanaForm("ficha");
                            setEditando(p);
                            setFormAbierto(true);
                          }}
                          className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-teal hover:text-teal"
                          title="Editar la ficha"
                        >
                          <Pencil size={14} />
                        </button>
                        <Link
                          href={`/participantes/s21/${p.id}`}
                          target="_blank"
                          className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-teal hover:text-teal"
                          title="Ficha S-21 de esta persona"
                        >
                          <FileText size={14} />
                        </Link>
                        <button
                          onClick={() => {
                            setPestanaForm("actividad");
                            setEditando(p);
                            setFormAbierto(true);
                          }}
                          className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-teal hover:text-teal"
                          title="Editar la actividad mes por mes"
                        >
                          <CalendarCheck size={14} />
                        </button>
                        <button
                          onClick={() => alternarActivo(p)}
                          className={
                            "cursor-pointer rounded-lg border border-linea p-2 transition-colors " +
                            (p.activo
                              ? "text-suave hover:border-rojo hover:text-rojo"
                              : "text-verde hover:border-verde")
                          }
                          title={p.activo ? "Desactivar" : "Reactivar"}
                        >
                          {p.activo ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                        <button
                          onClick={() => eliminar(p)}
                          className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-rojo hover:text-rojo"
                          title="Eliminar definitivamente"
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
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-suave">
        <span className="flex items-center gap-1.5">
          <CalendarCheck size={13} /> Tocá el nombre para ver el año de servicio; con el ícono de
          calendario editás la actividad mes por mes
        </span>
        <span className="flex items-center gap-1.5">
          <UserRound size={13} /> El parentesco obliga a elegir un mayor cargado para NIÑO/NIÑA
        </span>
        <span className="flex items-center gap-1.5">
          <SlidersHorizontal size={13} /> Las asignaciones tildadas acá son las
          que ofrece el buscador de la reunión
        </span>
        <span className="flex items-center gap-1.5">
          <UserRound size={13} /> Desactivar conserva el historial
        </span>
        <span className="flex items-center gap-1.5">
          <Trash2 size={13} /> Eliminar borra la ficha y todo el historial
        </span>
      </div>

      {viendo && (
        <Modal
          titulo={viendo.nombre_completo}
          subtitulo="Año de servicio: de septiembre a agosto. Para corregir algo, usá Editar actividad."
          onCerrar={() => setViendo(null)}
        >
          <ActividadDelAnio
            participante={viendo}
            soloLectura
            onCambiarActivo={async () => undefined}
          />
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
            <Link
              href={`/participantes/s21/${viendo.id}`}
              target="_blank"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-suave"
            >
              <FileText size={15} /> Ver S-21
            </Link>
            <Boton
              onClick={() => {
                const persona = viendo;
                setViendo(null);
                setPestanaForm("actividad");
                setEditando(persona);
                setFormAbierto(true);
              }}
            >
              <CalendarCheck size={15} /> Editar actividad
            </Boton>
          </div>
        </Modal>
      )}

      {formAbierto && (
        <ParticipanteForm
          pestanaInicial={pestanaForm}
          participante={editando}
          roles={roles}
          mayores={mayores}
          asignacionesIniciales={
            editando ? rolesDe(editando.id).map((r) => r.id) : []
          }
          onGuardar={guardar}
          onCambiarActivo={async (activo) => {
            setParticipantes((prev) =>
              prev.map((p) => (p.id === editando?.id ? { ...p, activo } : p)),
            );
            setEditando((prev) => (prev ? { ...prev, activo } : prev));
            await cargar();
          }}
          onCerrar={() => {
            setFormAbierto(false);
            setEditando(null);
          }}
        />
      )}

      {rolesAbierto && (
        <GestionRoles
          roles={roles}
          onCerrar={() => setRolesAbierto(false)}
          onRecargar={cargar}
        />
      )}
    </div>
  );
}

const COLUMNAS_NUEVAS = [
  "anios_bautizado",
  "es_secretario",
  "miembro_comite_asamblea",
  "es_publicador",
  "anio_servicio_inicio",
  "contacto_emergencia_nombre",
  "contacto_emergencia_telefono",
  "tipo_bautizado",
];

function faltaColumnaNueva(mensaje: string): boolean {
  return COLUMNAS_NUEVAS.some((c) => mensaje.includes(c));
}

function sinColumnasNuevas<T extends Record<string, unknown>>(objeto: T): T {
  const copia: Record<string, unknown> = { ...objeto };
  for (const columna of COLUMNAS_NUEVAS) delete copia[columna];
  return copia as T;
}

function traducir(mensaje: string): string {
  if (mensaje.includes("parentesco")) return mensaje;
  if (mensaje.includes("duplicate key") || mensaje.includes("23505"))
    return "Ya existe un participante con ese nombre.";
  return mensaje;
}
