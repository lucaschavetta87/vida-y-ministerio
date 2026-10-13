"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton, Campo, Input, Panel, Titulo } from "@/components/ui";
import SelectorPersona from "@/components/SelectorPersona";
import { supabase } from "@/lib/supabase";
import {
  tieneClasificacion,
  type Asignacion,
  type Participante,
  type Reunion,
  type ReunionParte,
} from "@/lib/tipos";
import { hoyISO, traerHistorial, type Historial } from "@/lib/historial";

interface RAM {
  id?: string;
  reunion_id: string;
  dia_entresemana: string | null;
  acomodador_puerta_id: string | null;
  acomodador_auditorio_id: string | null;
  microfonista_1_id: string | null;
  microfonista_2_id: string | null;
  audio_id: string | null;
  video_id: string | null;
  plataforma_id: string | null;
  retiro_donaciones_1_id: string | null;
  retiro_donaciones_2_id: string | null;
  limpieza_grupo_entresemana: string | null;
  dia_finsemana: string | null;
  presidente_fin_semana_id: string | null;
  oracion_asignaciones_id: string | null;
  oracion_asignaciones_texto: string | null;
  conferencia_nombre: string | null;
  conferencia_presenta_texto: string | null;
  conductor_atalaya_id: string | null;
  lector_id: string | null;
  acomodador_puerta_fs_id: string | null;
  acomodador_auditorio_fs_id: string | null;
  microfonista_1_fs_id: string | null;
  microfonista_2_fs_id: string | null;
  audio_fs_id: string | null;
  video_fs_id: string | null;
  plataforma_fs_id: string | null;
  retiro_donaciones_1_fs_id: string | null;
  retiro_donaciones_2_fs_id: string | null;
  limpieza_grupo_fin_semana: string | null;
  oracion_final_id: string | null;
  oracion_final_texto: string | null;
  notas: string | null;
}

/** nombre de cada tarea mecánica (para avisar si alguien repite) */
const TAREAS: [keyof RAM, string][] = [
  ["acomodador_puerta_id", "Acomodador de puerta (entre semana)"],
  ["acomodador_auditorio_id", "Acomodador de auditorio (entre semana)"],
  ["microfonista_1_id", "Micrófonista 1 (entre semana)"],
  ["microfonista_2_id", "Micrófonista 2 (entre semana)"],
  ["audio_id", "Audio (entre semana)"],
  ["video_id", "Video (entre semana)"],
  ["plataforma_id", "Plataforma (entre semana)"],
  ["retiro_donaciones_1_id", "Retiro de donaciones 1 (entre semana)"],
  ["retiro_donaciones_2_id", "Retiro de donaciones 2 (entre semana)"],
  ["presidente_fin_semana_id", "Presidente (fin de semana)"],
  ["oracion_asignaciones_id", "Oración de asignaciones"],
  ["conductor_atalaya_id", "Conductor de Atalaya"],
  ["lector_id", "Lector (Atalaya)"],
  ["acomodador_puerta_fs_id", "Acomodador de puerta (fin de semana)"],
  ["acomodador_auditorio_fs_id", "Acomodador de auditorio (fin de semana)"],
  ["microfonista_1_fs_id", "Micrófonista 1 (fin de semana)"],
  ["microfonista_2_fs_id", "Micrófonista 2 (fin de semana)"],
  ["audio_fs_id", "Audio (fin de semana)"],
  ["video_fs_id", "Video (fin de semana)"],
  ["plataforma_fs_id", "Plataforma (fin de semana)"],
  ["retiro_donaciones_1_fs_id", "Retiro de donaciones 1 (fin de semana)"],
  ["retiro_donaciones_2_fs_id", "Retiro de donaciones 2 (fin de semana)"],
  ["oracion_final_id", "Oración final"],
];

function ramVacio(reunionId: string): RAM {
  return {
    reunion_id: reunionId,
    dia_entresemana: null,
    acomodador_puerta_id: null,
    acomodador_auditorio_id: null,
    microfonista_1_id: null,
    microfonista_2_id: null,
    audio_id: null,
    video_id: null,
    plataforma_id: null,
    retiro_donaciones_1_id: null,
    retiro_donaciones_2_id: null,
    limpieza_grupo_entresemana: null,
    dia_finsemana: null,
    presidente_fin_semana_id: null,
    oracion_asignaciones_id: null,
    oracion_asignaciones_texto: null,
    conferencia_nombre: null,
    conferencia_presenta_texto: null,
    conductor_atalaya_id: null,
    lector_id: null,
    acomodador_puerta_fs_id: null,
    acomodador_auditorio_fs_id: null,
    microfonista_1_fs_id: null,
    microfonista_2_fs_id: null,
    audio_fs_id: null,
    video_fs_id: null,
    plataforma_fs_id: null,
    retiro_donaciones_1_fs_id: null,
    retiro_donaciones_2_fs_id: null,
    limpieza_grupo_fin_semana: null,
    oracion_final_id: null,
    oracion_final_texto: null,
    notas: null,
  };
}

interface DatosBase {
  reuniones: Reunion[];
  participantes: Participante[];
  participanteRoles: Asignacion[];
  roles: { id: string; slug: string }[];
}

async function traerBase(): Promise<DatosBase> {
  const [r, p, pr, ro] = await Promise.all([
    supabase.from("reuniones").select("*").order("fecha_inicio", { ascending: false }),
    supabase.from("participantes").select("*").order("nombre_completo"),
    supabase.from("participante_roles").select("*"),
    supabase.from("roles").select("*"),
  ]);
  return {
    reuniones: (r.data as Reunion[]) || [],
    participantes: (p.data as Participante[]) || [],
    participanteRoles: (pr.data as Asignacion[]) || [],
    roles: (ro.data as { id: string; slug: string }[]) || [],
  };
}

export default function AsignacionesMecanicasPage() {
  const router = useRouter();
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [reunionId, setReunionId] = useState<string>("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [participanteRoles, setParticipanteRoles] = useState<Asignacion[]>([]);
  const [roles, setRoles] = useState<{ id: string; slug: string }[]>([]);
  const [ram, setRam] = useState<RAM | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [partes, setPartes] = useState<ReunionParte[]>([]);
  const [historial, setHistorial] = useState<Historial>(new Map());
  const hoy = hoyISO();

  useEffect(() => {
    let cancelado = false;
    traerBase().then((datos) => {
      if (cancelado) return;
      setReuniones(datos.reuniones);
      setParticipantes(datos.participantes);
      setParticipanteRoles(datos.participanteRoles);
      setRoles(datos.roles);
      if (datos.reuniones[0]) setReunionId(datos.reuniones[0].id);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!reunionId) return;
    let cancelado = false;
    supabase
      .from("reunion_asignaciones_mecanicas")
      .select("*")
      .eq("reunion_id", reunionId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return;
        if (data) {
          setRam(data as RAM);
        } else {
          setRam({ ...ramVacio(reunionId) });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [reunionId]);

  const set = (k: keyof RAM, v: RAM[keyof RAM]) =>
    setRam((prev) => (prev ? { ...prev, [k]: v } : prev));

  const hombres = useMemo(
    () => participantes.filter((p) => p.activo && p.genero === "HOMBRE"),
    [participantes],
  );

  /** Los micros también los pueden pasar los niños (varones). */
  const paraMicrofonos = useMemo(
    () =>
      participantes.filter(
        (p) => p.activo && (p.genero === "HOMBRE" || p.genero === "NIÑO"),
      ),
    [participantes],
  );

  const ancianos = useMemo(
    () => hombres.filter((p) => tieneClasificacion(p, "ANCIANO")),
    [hombres],
  );
  const ancianosOServidores = useMemo(
    () =>
      hombres.filter(
        (p) =>
          tieneClasificacion(p, "ANCIANO") ||
          tieneClasificacion(p, "SIERVO_MINISTERIAL"),
      ),
    [hombres],
  );

  const idsRol = useCallback(
    (slug: string): Set<string> => {
      const rol = roles.find((r) => r.slug === slug);
      if (!rol) return new Set();
      return new Set(
        participanteRoles.filter((a) => a.role_id === rol.id).map((a) => a.participante_id),
      );
    },
    [roles, participanteRoles],
  );

  /**
   * Solo se pueden elegir los que tienen ese rol tildado en la ficha del
   * participante (o el permiso especial de la tarea).
   */
  const aptos = useCallback(
    (
      slug: string,
      permiso?: (p: Participante) => boolean,
      base: Participante[] = hombres,
    ) => {
      const conRol = idsRol(slug);
      return base.filter(
        (p) => conRol.has(p.id) || (permiso ? permiso(p) : false),
      );
    },
    [hombres, idsRol],
  );

  /* ---------- temas de la reunión e historial ---------- */

  useEffect(() => {
    if (!reunionId) return;
    let cancelado = false;
    supabase
      .from("reunion_partes")
      .select("id, titulo, seccion, participante_ids")
      .eq("reunion_id", reunionId)
      .then(({ data }) => {
        if (!cancelado) setPartes((data as ReunionParte[]) || []);
      });
    return () => {
      cancelado = true;
    };
  }, [reunionId]);

  useEffect(() => {
    if (cargando) return;
    let cancelado = false;
    traerHistorial(hoy).then(({ historial: h }) => {
      if (!cancelado) setHistorial(h);
    });
    return () => {
      cancelado = true;
    };
  }, [cargando, hoy]);

  /** temas de la reunión donde esa persona ya tiene algo asignado */
  const temasDe = useCallback(
    (id: string): string[] =>
      partes
        .filter((p) => (p.participante_ids || []).includes(id))
        .map((p) => p.titulo),
    [partes],
  );

  /** otras tareas (de esta misma pantalla) que ya tiene asignadas */
  const tareasPorPersona = useMemo(() => {
    const mapa = new Map<string, { campo: string; etiqueta: string }[]>();
    if (!ram) return mapa;
    for (const [campo, etiqueta] of TAREAS) {
      const id = ram[campo] as string | null;
      if (!id) continue;
      const lista = mapa.get(id) || [];
      lista.push({ campo, etiqueta });
      mapa.set(id, lista);
    }
    return mapa;
  }, [ram]);

  /** avisos de la persona para la tarea que se está editando */
  const avisosDe = useCallback(
    (campo: keyof RAM) => (id: string): string[] =>
      (tareasPorPersona.get(id) || [])
        .filter((t) => t.campo !== campo)
        .map((t) => t.etiqueta),
    [tareasPorPersona],
  );

  const aptosRetiro = useMemo(
    () => aptos("retiro_donaciones", (p) => Boolean(p.retiro_donaciones_aprobado)),
    [aptos],
  );

  const aptosLectorAtalaya = useMemo(
    () => aptos("lector_atalaya", (p) => Boolean(p.lector_atalaya_aprobado)),
    [aptos],
  );

  const aptosAcomodadorPuerta = useMemo(() => aptos("acomodador_puerta"), [aptos]);
  const aptosAcomodadorAuditorio = useMemo(() => aptos("acomodador_auditorio"), [aptos]);
  const aptosMicrofonista = useMemo(() => {
    const vistos = new Map<string, Participante>();
    for (const slug of ["microfonista_1", "microfonista_2"]) {
      for (const p of aptos(slug, undefined, paraMicrofonos)) vistos.set(p.id, p);
    }
    return [...vistos.values()].sort((a, b) =>
      a.nombre_completo.localeCompare(b.nombre_completo, "es"),
    );
  }, [aptos, paraMicrofonos]);
  const aptosAudioVideo = useMemo(() => aptos("audio_video"), [aptos]);
  const aptosPlataforma = useMemo(() => aptos("plataforma"), [aptos]);
  const aptosOracion = useMemo(() => aptos("oracion"), [aptos]);
  const aptosOracionFinal = useMemo(() => aptos("oracion_fin"), [aptos]);

  /* ---------- lo de entre semana se repite en fin de semana ---------- */

  const COPIAR_A_FIN_DE_SEMANA: [keyof RAM, keyof RAM][] = [
    ["acomodador_puerta_id", "acomodador_puerta_fs_id"],
    ["acomodador_auditorio_id", "acomodador_auditorio_fs_id"],
    ["microfonista_1_id", "microfonista_1_fs_id"],
    ["microfonista_2_id", "microfonista_2_fs_id"],
    ["audio_id", "audio_fs_id"],
    ["video_id", "video_fs_id"],
    ["plataforma_id", "plataforma_fs_id"],
    ["retiro_donaciones_1_id", "retiro_donaciones_1_fs_id"],
    ["retiro_donaciones_2_id", "retiro_donaciones_2_fs_id"],
    ["limpieza_grupo_entresemana", "limpieza_grupo_fin_semana"],
  ];

  /** queda algo de entre semana para copiar? */
  const hayParaCopiar = useMemo(() => {
    if (!ram) return false;
    return COPIAR_A_FIN_DE_SEMANA.some(([origen]) => Boolean(ram[origen]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ram]);

  const copiarAFinDeSemana = () => {
    if (!ram) return;
    const cambios: Partial<RAM> = {};
    for (const [origen, destino] of COPIAR_A_FIN_DE_SEMANA) {
      cambios[destino] = ram[origen] as never;
    }
    setRam({ ...ram, ...cambios });
  };

  const guardar = async () => {
    if (!ram || !reunionId) return;
    setGuardando(true);
    // las columnas viejas "audio y video" ya no se usan: no se mandan
    const campos: Record<string, unknown> = { ...ram };
    delete campos.audio_video_id;
    delete campos.audio_video_fs_id;
    const { error } = await supabase
      .from("reunion_asignaciones_mecanicas")
      .upsert(campos);
    setGuardando(false);
    if (error) {
      setError(
        error.code === "42703" ||
          error.code === "PGRST204" ||
          /does not exist|could not find/i.test(error.message)
          ? "Falta la migración: pegá supabase/migracion_v5.sql en el SQL Editor de Supabase."
          : error.message,
      );
    } else setError("");
  };

  const irPdf = () => {
    if (!reunionId) return;
    router.push(`/asignaciones-mecanicas/pdf/${reunionId}`);
  };

  if (cargando) return <Panel className="p-10 text-center">Cargando...</Panel>;

  if (!reunionId || !ram) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Titulo>Asignaciones Este Las Heras</Titulo>
          <Boton variante="secundario" onClick={irPdf} disabled={!reunionId}>
            Generar PDF
          </Boton>
        </div>
        <Panel className="p-8 text-center">
          <p className="text-sm font-semibold">
            Todavía no hay ninguna reunión cargada.
          </p>
          <p className="mt-2 text-sm text-suave">
            Las tareas mecánicas se cargan sobre una reunión. Creá una semana
            (subiendo el PDF de la guía) y volvé a esta pantalla.
          </p>
          <Boton className="mt-4" onClick={() => router.push("/reunion")}>
            Ir a Vida y Ministerio
          </Boton>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Titulo>Asignaciones Este Las Heras</Titulo>
        <div className="flex gap-2">
          <Boton onClick={guardar} disabled={guardando}>
            Guardar
          </Boton>
          <Boton variante="secundario" onClick={irPdf}>
            Generar PDF
          </Boton>
        </div>
      </div>

      <Panel className="mb-4 p-4">
        <p className="mb-3 text-xs text-suave">
          En cada tarea solo se listan los que ya tienen ese rol aprobado en su
          ficha. Si alguien ya tiene un tema en la reunión de esta semana,
          aparece avisado, pero se puede poner igual.
        </p>
        <Campo label="Reunión">
          <select
            value={reunionId}
            onChange={(e) => setReunionId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-linea bg-tarjeta2 px-3 py-1 text-sm outline-none focus:border-teal"
          >
            {reuniones.map((r) => (
              <option key={r.id} value={r.id}>
                {r.titulo}
              </option>
            ))}
          </select>
        </Campo>
        {error && <p className="mt-2 text-sm text-rojo">{error}</p>}
      </Panel>

      <Panel className="mb-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">REUNIÓN DE ENTRESEMANA</h2>
          <span className="text-xs text-suave">
            Retiro de Donaciones aptos: {aptosRetiro.length}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Día de la Reunión de Entresemana">
            <Input value={ram.dia_entresemana || ""} onChange={(e) => set("dia_entresemana", e.target.value)} />
          </Campo>
          <Campo label="Limpieza - Grupo">
            <Input
              value={ram.limpieza_grupo_entresemana || ""}
              onChange={(e) => {
                set("limpieza_grupo_entresemana", e.target.value);
                set("limpieza_grupo_fin_semana", e.target.value);
              }}
            />
          </Campo>
          <Campo label="Acomodador de Puerta">
            <SelectorPersona todos={participantes} candidatos={aptosAcomodadorPuerta} valor={ram.acomodador_puerta_id} tareasDe={avisosDe("acomodador_puerta_id")} onChange={(id) => set("acomodador_puerta_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Acomodador de Auditorio">
            <SelectorPersona todos={participantes} candidatos={aptosAcomodadorAuditorio} valor={ram.acomodador_auditorio_id} tareasDe={avisosDe("acomodador_auditorio_id")} onChange={(id) => set("acomodador_auditorio_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Micrófonista 1">
            <SelectorPersona todos={participantes} candidatos={aptosMicrofonista} valor={ram.microfonista_1_id} tareasDe={avisosDe("microfonista_1_id")} onChange={(id) => set("microfonista_1_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Micrófonista 2">
            <SelectorPersona todos={participantes} candidatos={aptosMicrofonista} valor={ram.microfonista_2_id} tareasDe={avisosDe("microfonista_2_id")} onChange={(id) => set("microfonista_2_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Audio">
            <SelectorPersona todos={participantes} candidatos={aptosAudioVideo} valor={ram.audio_id} tareasDe={avisosDe("audio_id")} onChange={(id) => set("audio_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Video">
            <SelectorPersona todos={participantes} candidatos={aptosAudioVideo} valor={ram.video_id} tareasDe={avisosDe("video_id")} onChange={(id) => set("video_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Plataforma">
            <SelectorPersona todos={participantes} candidatos={aptosPlataforma} valor={ram.plataforma_id} tareasDe={avisosDe("plataforma_id")} onChange={(id) => set("plataforma_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Retiro de Donaciones 1">
            <SelectorPersona todos={participantes} candidatos={aptosRetiro} valor={ram.retiro_donaciones_1_id} tareasDe={avisosDe("retiro_donaciones_1_id")} onChange={(id) => set("retiro_donaciones_1_id", id)} vacioTexto="Nadie aprobado aún" temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Retiro de Donaciones 2">
            <SelectorPersona todos={participantes} candidatos={aptosRetiro} valor={ram.retiro_donaciones_2_id} tareasDe={avisosDe("retiro_donaciones_2_id")} onChange={(id) => set("retiro_donaciones_2_id", id)} vacioTexto="Nadie aprobado aún" temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">REUNIÓN DE FIN DE SEMANA</h2>
            <p className="text-xs text-suave">
              Acomodadores, microfónistas, audio, video, plataforma, retiro de
              donaciones y limpieza se repiten de la reunión de entre semana.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-suave">
              Lector Atalaya aptos: {aptosLectorAtalaya.length}
            </span>
            <Boton
              variante="secundario"
              onClick={copiarAFinDeSemana}
              disabled={!hayParaCopiar}
              title="Repite en la reunión de fin de semana lo que está en la de entre semana"
            >
              Repetir de entre semana
            </Boton>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Día de la Reunión de Fin de Semana">
            <Input value={ram.dia_finsemana || ""} onChange={(e) => set("dia_finsemana", e.target.value)} />
          </Campo>
          <Campo label="Presidente (Anciano/Siervo Ministerial)">
            <SelectorPersona todos={participantes} candidatos={ancianosOServidores} valor={ram.presidente_fin_semana_id} tareasDe={avisosDe("presidente_fin_semana_id")} onChange={(id) => set("presidente_fin_semana_id", id)} vacioTexto="Sin ancianos/siervos cargados" temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Oración (Asignaciones)">
            <SelectorPersona todos={participantes} candidatos={aptosOracion} valor={ram.oracion_asignaciones_id} tareasDe={avisosDe("oracion_asignaciones_id")} onChange={(id) => set("oracion_asignaciones_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Nombre de la Conferencia">
            <Input value={ram.conferencia_nombre || ""} onChange={(e) => set("conferencia_nombre", e.target.value)} placeholder="Ej: La fe nos impulsa" />
          </Campo>
          <Campo label="Conferencia - Presenta (a mano)" hint="No está en la lista: escribí el nombre">
            <Input value={ram.conferencia_presenta_texto || ""} onChange={(e) => set("conferencia_presenta_texto", e.target.value)} placeholder="Ej: Juan Pérez (invitado)" />
          </Campo>
          <Campo label="Conductor de Atalaya (Solo Ancianos)">
            <SelectorPersona todos={participantes} candidatos={ancianos} valor={ram.conductor_atalaya_id} tareasDe={avisosDe("conductor_atalaya_id")} onChange={(id) => set("conductor_atalaya_id", id)} vacioTexto="Sin ancianos cargados" temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Lector (Atalaya) - Solo hombres aprobados">
            <SelectorPersona todos={participantes} candidatos={aptosLectorAtalaya} valor={ram.lector_id} tareasDe={avisosDe("lector_id")} onChange={(id) => set("lector_id", id)} vacioTexto="Nadie aprobado aún" temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Acomodador de Puerta">
            <SelectorPersona todos={participantes} candidatos={aptosAcomodadorPuerta} valor={ram.acomodador_puerta_fs_id} tareasDe={avisosDe("acomodador_puerta_fs_id")} onChange={(id) => set("acomodador_puerta_fs_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Acomodador de Auditorio">
            <SelectorPersona todos={participantes} candidatos={aptosAcomodadorAuditorio} valor={ram.acomodador_auditorio_fs_id} tareasDe={avisosDe("acomodador_auditorio_fs_id")} onChange={(id) => set("acomodador_auditorio_fs_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Micrófonista 1">
            <SelectorPersona todos={participantes} candidatos={aptosMicrofonista} valor={ram.microfonista_1_fs_id} tareasDe={avisosDe("microfonista_1_fs_id")} onChange={(id) => set("microfonista_1_fs_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Micrófonista 2">
            <SelectorPersona todos={participantes} candidatos={aptosMicrofonista} valor={ram.microfonista_2_fs_id} tareasDe={avisosDe("microfonista_2_fs_id")} onChange={(id) => set("microfonista_2_fs_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Audio">
            <SelectorPersona todos={participantes} candidatos={aptosAudioVideo} valor={ram.audio_fs_id} tareasDe={avisosDe("audio_fs_id")} onChange={(id) => set("audio_fs_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Video">
            <SelectorPersona todos={participantes} candidatos={aptosAudioVideo} valor={ram.video_fs_id} tareasDe={avisosDe("video_fs_id")} onChange={(id) => set("video_fs_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Plataforma">
            <SelectorPersona todos={participantes} candidatos={aptosPlataforma} valor={ram.plataforma_fs_id} tareasDe={avisosDe("plataforma_fs_id")} onChange={(id) => set("plataforma_fs_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Retiro de Donaciones 1 (Fin de Semana)">
            <SelectorPersona todos={participantes} candidatos={aptosRetiro} valor={ram.retiro_donaciones_1_fs_id} tareasDe={avisosDe("retiro_donaciones_1_fs_id")} onChange={(id) => set("retiro_donaciones_1_fs_id", id)} vacioTexto="Nadie aprobado aún" temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Retiro de Donaciones 2 (Fin de Semana)">
            <SelectorPersona todos={participantes} candidatos={aptosRetiro} valor={ram.retiro_donaciones_2_fs_id} tareasDe={avisosDe("retiro_donaciones_2_fs_id")} onChange={(id) => set("retiro_donaciones_2_fs_id", id)} vacioTexto="Nadie aprobado aún" temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
          <Campo label="Limpieza - Grupo (copiado de Entresemana)">
            <Input value={ram.limpieza_grupo_fin_semana || ""} onChange={(e) => set("limpieza_grupo_fin_semana", e.target.value)} />
          </Campo>
          <Campo label="Oración Final">
            <SelectorPersona todos={participantes} candidatos={aptosOracionFinal} valor={ram.oracion_final_id} tareasDe={avisosDe("oracion_final_id")} onChange={(id) => set("oracion_final_id", id)} temasDe={temasDe} historial={historial} hoy={hoy} />
          </Campo>
        </div>
      </Panel>
    </div>
  );
}
