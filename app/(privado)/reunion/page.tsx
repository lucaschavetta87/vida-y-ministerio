"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronLeft,
  FileDown,
  FileUp,
  ImagePlus,
  Gem,
  HeartHandshake,
  ListOrdered,
  Loader2,
  Music,
  Pencil,
  Plus,
  Trash2,
  Wheat,
} from "lucide-react";
import {
  Boton,
  Campo,
  Etiqueta,
  Input,
  Panel,
  Select,
  Textarea,
} from "@/components/ui";
import BuscadorParticipante from "@/components/BuscadorParticipante";
import { supabase } from "@/lib/supabase";
import { rolAdmiteClasificacion } from "@/lib/roles";
import type {
  Asignacion,
  EstadoGuardado,
  Participante,
  Reunion,
  ReunionParte,
  Rol,
} from "@/lib/tipos";
import {
  PLANTILLA_PARTES,
  SECCIONES,
  SECCION_META,
  fechaLarga,
  sumarDias,
  tituloSemana,
} from "@/lib/plantilla";
import { cn } from "@/lib/utils";
import { leerGuiaMwb, type ResultadoLectura } from "@/lib/leer-pdf";
import { importarSemanas } from "@/lib/importar-guia";
import { repetidosDe } from "@/lib/sincronizar";
import type { SemanaMwb } from "@/lib/pdf";
import {
  hoyISO,
  traerHistorial,
  type Historial,
} from "@/lib/historial";

const AVISO_SUPABASE =
  "No se pudo leer Supabase. ¿Ejecutaste el script SQL en el panel?";

const SECCIONES_CUERPO = SECCIONES.filter(
  (s) => s !== "APERTURA" && s !== "CIERRE" && s !== "ASIGNACIONES MECANICAS",
);

const MULTI_SECCION = "SEAMOS MEJORES MAESTROS";

/** si falta la migración, lo decimos claro */
function traducirError(msg: string): string {
  if (/lector_id/.test(msg || ""))
    return "Falta la migración: pegá supabase/migracion_v3.sql en el SQL Editor de Supabase.";
  if (/participante_ids/.test(msg || ""))
    return "Falta la migración: pegá supabase/migracion_v2.sql en el SQL Editor de Supabase.";
  return msg;
}

interface DatosBase {
  reuniones: Reunion[];
  roles: Rol[];
  participantes: Participante[];
  participanteRoles: Asignacion[];
  error: string;
}

async function traerBase(): Promise<DatosBase> {
  const [r, ro, p, pr] = await Promise.all([
    supabase
      .from("reuniones")
      .select("*")
      .order("fecha_inicio", { ascending: false }),
    supabase.from("roles").select("*").order("orden"),
    supabase.from("participantes").select("*").order("nombre_completo"),
    supabase.from("participante_roles").select("*"),
  ]);
  const fallo = r.error || ro.error || p.error || pr.error;
  return {
    reuniones: (r.data as Reunion[]) || [],
    roles: (ro.data as Rol[]) || [],
    participantes: (p.data as Participante[]) || [],
    participanteRoles: (pr.data as Asignacion[]) || [],
    error: fallo ? traducirError(fallo.message) || AVISO_SUPABASE : "",
  };
}

function lunesDeEstaSemana(): string {
  const d = new Date();
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const diaMes = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${diaMes}`;
}

function lineasDe(texto: string | null): string[] {
  return (texto || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function iconoSeccion(nombre: string) {
  switch (nombre) {
    case "gema":
      return Gem;
    case "trigo":
      return Wheat;
    case "oveja":
      return HeartHandshake;
    default:
      return Music;
  }
}

const esLinea = (p: ReunionParte) => p.tipo !== "item";

type EstadoGuia = { tipo: "idle" | "leyendo" | "creando" | "ok" | "error"; texto: string };

export default function PaginaReunion() {
  const router = useRouter();
  const parametros = useSearchParams();
  // /reunion?reunion=<id> abre esa semana directo (vuelve desde las
  // asignaciones, por ejemplo)
  const reunionDeUrl = parametros.get("reunion");
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [reunionId, setReunionId] = useState<string | null>(null);
  const [paginaReuniones, setPaginaReuniones] = useState(1);
  const [registroPartes, setRegistroPartes] = useState<{
    reunionId: string | null;
    partes: ReunionParte[];
  }>({ reunionId: null, partes: [] });
  const [roles, setRoles] = useState<Rol[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [participanteRoles, setParticipanteRoles] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState<EstadoGuardado>("idle");
  const [error, setError] = useState("");
  /** títulos que salieron repetidos al leer el PDF */
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const [fechaNueva, setFechaNueva] = useState("");
  const [citaNueva, setCitaNueva] = useState("");
  const [creando, setCreando] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [historial, setHistorial] = useState<Historial>(new Map());
  const [proximas, setProximas] = useState<Historial>(new Map());
  const [errorHistorial, setErrorHistorial] = useState("");
  const [estadoGuia, setEstadoGuia] = useState<EstadoGuia>({
    tipo: "idle",
    texto: "",
  });
  const [lectura, setLectura] = useState<ResultadoLectura | null>(null);
  const [terceroAbierto, setTerceroAbierto] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const hoy = hoyISO();

  const aplicarBase = useCallback((datos: DatosBase) => {
    if (datos.error) {
      setError(datos.error);
      setCargando(false);
      return;
    }
    setReuniones(datos.reuniones);
    setRoles(datos.roles);
    setParticipantes(datos.participantes);
    setParticipanteRoles(datos.participanteRoles);
    setCargando(false);
  }, []);

  const cargarBase = useCallback(async () => {
    aplicarBase(await traerBase());
  }, [aplicarBase]);

  // /reunion?reunion=<id> abre directo esa semana (al volver de las
  // asignaciones, por ejemplo)
  useEffect(() => {
    if (!reunionDeUrl) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReunionId(reunionDeUrl);
  }, [reunionDeUrl]);

  useEffect(() => {
    let cancelado = false;
    traerBase().then((datos) => {
      if (!cancelado) aplicarBase(datos);
    });
    return () => {
      cancelado = true;
    };
  }, [aplicarBase]);

  /* ---------- historial: se vuelve a traer al cargar, al asignar
     y cada vez que la pestaña vuelve a estar a la vista ---------- */
  const guardarHistorial = (h: Historial, p: Historial, e: string) => {
    setHistorial(h);
    setProximas(p);
    setErrorHistorial(e);
  };

  const cargarHistorial = useCallback(
    () =>
      traerHistorial(hoy).then(({ historial, proximas, error }) => {
        guardarHistorial(historial, proximas, error);
      }),
    [hoy],
  );

  useEffect(() => {
    if (cargando) return;
    let cancelado = false;
    traerHistorial(hoy).then((datos) => {
      if (cancelado) return;
      guardarHistorial(datos.historial, datos.proximas, datos.error);
    });
    const alVolver = () => {
      if (cancelado || document.visibilityState !== "visible") return;
      traerHistorial(hoy).then((datos) => {
        if (cancelado) return;
        guardarHistorial(datos.historial, datos.proximas, datos.error);
      });
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargando, hoy]);

  const partes: ReunionParte[] = useMemo(
    () =>
      registroPartes.reunionId === reunionId ? registroPartes.partes : [],
    [registroPartes, reunionId],
  );
  const cargandoPartes =
    reunionId !== null && registroPartes.reunionId !== reunionId;

  /** títulos que quedaron con el mismo texto en dos temas */
  const repetidosPartes = useMemo(() => repetidosDe(partes), [partes]);

  const modificarPartes = useCallback(
    (fn: (prev: ReunionParte[]) => ReunionParte[]) =>
      setRegistroPartes((prev) => ({
        reunionId,
        partes: fn(prev.reunionId === reunionId ? prev.partes : []),
      })),
    [reunionId],
  );

  useEffect(() => {
    if (!reunionId) return;
    let cancelado = false;
    supabase
      .from("reunion_partes")
      .select("*")
      .eq("reunion_id", reunionId)
      .order("orden")
      .then(
        ({ data, error: errPartes }) => {
          if (cancelado) return;
          if (errPartes) {
            setRegistroPartes({ reunionId, partes: [] });
            setError(
              "No se pudieron cargar las partes de la reunión: " +
                traducirError(errPartes.message),
            );
            return;
          }
          setRegistroPartes({
            reunionId,
            partes: (data as ReunionParte[]) || [],
          });
        },
        () => {
          if (cancelado) return;
          setRegistroPartes({ reunionId, partes: [] });
          setError("No se pudieron cargar las partes de la reunión.");
        },
      );
    return () => {
      cancelado = true;
    };
  }, [reunionId]);

  const reunion = reuniones.find((r) => r.id === reunionId) || null;

  const nombres = useMemo(() => {
    const mapa: Record<string, string> = {};
    participantes.forEach((p) => (mapa[p.id] = p.nombre_completo));
    return mapa;
  }, [participantes]);

  const activos = useMemo(
    () => participantes.filter((p) => p.activo),
    [participantes],
  );
  const hombresActivos = useMemo(
    () => activos.filter((p) => p.genero === "HOMBRE"),
    [activos],
  );

  const asignadas = partes.filter((p) => (p.participante_ids || []).length > 0)
    .length;

  const candidatosPorRol = useCallback(
    (roleId: string | null): Participante[] => {
      if (!roleId) return activos;
      const rol = roles.find((r) => r.id === roleId);
      if (!rol) return activos;
      const conRol = new Set(
        participanteRoles
          .filter((a) => a.role_id === rol.id)
          .map((a) => a.participante_id),
      );
      return activos.filter(
        (p) =>
          conRol.has(p.id) &&
          rol.generos_permitidos.includes(p.genero) &&
          rolAdmiteClasificacion(rol, p.clasificacion),
      );
    },
    [activos, roles, participanteRoles],
  );

  const candidatosDe = useCallback(
    (parte: ReunionParte) => candidatosPorRol(parte.role_id),
    [candidatosPorRol],
  );

  const ocupadosEn = useCallback(
    (parteId: string): Record<string, string> => {
      const mapa: Record<string, string> = {};
      partes.forEach((p) => {
        if (p.id === parteId) return;
        for (const id of p.participante_ids || []) {
          mapa[id] = mapa[id] ? `${mapa[id]}, ${p.titulo}` : p.titulo;
        }
      });
      return mapa;
    },
    [partes],
  );

  /* ---------- historial (sólo se muestra dentro del desplegable) ---------- */
  const historialVisible = errorHistorial ? undefined : historial;

  /* ---------- presidente ---------- */
  // en la reunión se preside la reunión de entre semana:
  // solo los que tienen esa asignación tildada
  const rolPresidente = roles.find(
    (r) => r.slug === "presidente_entre_semana",
  );
  const rolEstudio = roles.find((r) => r.slug === "estudio");
  const rolLectura = roles.find((r) => r.slug === "lectura");
  const partesPresidente = useMemo(
    () =>
      rolPresidente
        ? partes.filter((p) => p.role_id === rolPresidente.id)
        : [],
    [partes, rolPresidente],
  );
  const presidenteId =
    partesPresidente.find((p) => (p.participante_ids || [])[0])?.participante_ids[0] ||
    null;

  const elegirPresidente = async (id: string | null) => {
    if (partesPresidente.length === 0) {
      setError(
        "Esta semana todavía no tiene las partes “Palabras de introducción/conclusión”. Sincronizá la programación.",
      );
      return;
    }
    setEstado("guardando");
    let fallo = "";
    for (const p of partesPresidente) {
      const ids = id ? [id] : [];
      modificarPartes((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, participante_ids: ids } : x)),
      );
      const { error: err } = await supabase
        .from("reunion_partes")
        .update({ participante_ids: ids })
        .eq("id", p.id);
      if (err) fallo = traducirError(err.message);
    }
    if (fallo) {
      setEstado("error");
      setError(fallo);
    } else {
      setEstado("guardado");
    }
  };

  /* ---------- guardar ---------- */
  const crearSemana = async () => {
    if (!fechaNueva) {
      setError("Elegí la fecha de inicio de la semana.");
      return;
    }
    setCreando(true);
    setError("");
    const { data: nueva, error } = await supabase
      .from("reuniones")
      .insert({
        fecha_inicio: fechaNueva,
        fecha_fin: sumarDias(fechaNueva, 6),
        titulo: tituloSemana(fechaNueva),
        cita_biblica: citaNueva.trim() || null,
      })
      .select("*")
      .single();

    if (error) {
      setCreando(false);
      setError(
        error.code === "23505"
          ? "Ya existe una reunión creada para esa semana."
          : error.message,
      );
      return;
    }

    const porSlug = new Map(roles.map((r) => [r.slug, r.id]));
    const { error: errPartes } = await supabase.from("reunion_partes").insert(
      PLANTILLA_PARTES.map((p) => ({
        reunion_id: nueva.id,
        orden: p.orden,
        seccion: p.seccion,
        tipo: p.tipo,
        titulo: p.titulo,
        duracion: p.duracion || null,
        descripcion: p.descripcion || null,
        role_id: p.slug ? (porSlug.get(p.slug) ?? null) : null,
      })),
    );

    setCreando(false);
    if (errPartes) {
      setError(
        "La semana se creó pero no se pudieron generar las partes: " +
          traducirError(errPartes.message),
      );
    }

    await cargarBase();
    setReunionId(nueva.id);
    setFechaNueva("");
    setCitaNueva("");
  };

  const editarLocal = (id: string, cambios: Partial<ReunionParte>) =>
    modificarPartes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)),
    );

  const guardarCampo = async (id: string, cambios: Partial<ReunionParte>) => {
    setEstado("guardando");
    const { error } = await supabase
      .from("reunion_partes")
      .update(cambios)
      .eq("id", id);
    if (error) {
      setEstado("error");
      setError(traducirError(error.message));
    } else {
      setEstado("guardado");
    }
  };

  const persistirParte = async (id: string, cambios: Partial<ReunionParte>) => {
    modificarPartes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)),
    );
    setEstado("guardando");
    const { error } = await supabase
      .from("reunion_partes")
      .update(cambios)
      .eq("id", id);
    if (error) {
      setEstado("error");
      setError(traducirError(error.message));
    } else {
      setEstado("guardado");
    }
  };

  const asignar = (parte: ReunionParte, ids: string[]) => {
    void persistirParte(parte.id, { participante_ids: ids }).then(() =>
      cargarHistorial(),
    );
  };

  /** mueve un tema un lugar arriba o abajo dentro de su misma sección */
  const moverTema = async (parte: ReunionParte, delta: -1 | 1) => {
    const ordenadas = [...partes]
      .sort((a, b) => a.orden - b.orden)
      .filter((p) => p.seccion === parte.seccion);
    const i = ordenadas.findIndex((p) => p.id === parte.id);
    const destino = i + delta;
    if (i < 0 || destino < 0 || destino >= ordenadas.length) return;
    const actual = ordenadas[i];
    const otro = ordenadas[destino];
    const cambios = [
      { id: actual.id, orden: otro.orden },
      { id: otro.id, orden: actual.orden },
    ];
    modificarPartes((prev) =>
      prev.map((p) => {
        const c = cambios.find((x) => x.id === p.id);
        return c ? { ...p, orden: c.orden } : p;
      }),
    );
    setEstado("guardando");
    for (const c of cambios) {
      const { error } = await supabase
        .from("reunion_partes")
        .update({ orden: c.orden })
        .eq("id", c.id);
      if (error) {
        setEstado("error");
        setError(traducirError(error.message));
        return;
      }
    }
    setEstado("guardado");
  };

  /** deja los temas como los de la guía: 1, 2, 3 de Tesoros y después */
  const ordenarTemas = async () => {
    const RANGO: Record<string, number> = {
      APERTURA: 0,
      "TESOROS DE LA BIBLIA": 100,
      "SEAMOS MEJORES MAESTROS": 200,
      "NUESTRA VIDA CRISTIANA": 300,
      CIERRE: 900,
    };
    const numeroDe = (t: string) => Number(t.match(/^(\d+)\./)?.[1] ?? 0);
    const ordenadas = [...partes].sort((a, b) => {
      const ra = RANGO[a.seccion] ?? 400;
      const rb = RANGO[b.seccion] ?? 400;
      if (ra !== rb) return ra - rb;
      const na = numeroDe(a.titulo);
      const nb = numeroDe(b.titulo);
      if (na !== nb) return (na || 99) - (nb || 99);
      return a.orden - b.orden;
    });

    const cambios: { id: string; orden: number }[] = [];
    ordenadas.forEach((p, i) => {
      const nuevo = (i + 1) * 10;
      if (p.orden !== nuevo) cambios.push({ id: p.id, orden: nuevo });
    });
    if (!cambios.length) return;

    modificarPartes((prev) =>
      prev.map((p) => ({ ...p, orden: cambios.find((c) => c.id === p.id)?.orden ?? p.orden })),
    );
    setEstado("guardando");
    for (const c of cambios) {
      const { error } = await supabase
        .from("reunion_partes")
        .update({ orden: c.orden })
        .eq("id", c.id);
      if (error) {
        setEstado("error");
        setError(traducirError(error.message));
        return;
      }
    }
    setEstado("guardado");
  };

  const asignarLector = (parte: ReunionParte, id: string | null) =>
    persistirParte(parte.id, { lector_id: id });

  const agregarParte = async (seccion: string) => {
    const ultima = partes
      .filter((p) => p.seccion === seccion)
      .reduce((max, p) => Math.max(max, p.orden), 0);
    const { data, error } = await supabase
      .from("reunion_partes")
      .insert({
        reunion_id: reunionId,
        orden: ultima + 10,
        seccion,
        tipo: "item",
        titulo: "Nueva parte",
        duracion: "",
        descripcion: "",
        role_id: null,
      })
      .select("*")
      .single();
    if (error) return setError(traducirError(error.message));
    modificarPartes((prev) =>
      [...prev, data as ReunionParte].sort((a, b) => a.orden - b.orden),
    );
  };

  const eliminarParte = async (parte: ReunionParte) => {
    if (!window.confirm(`¿Eliminar la parte “${parte.titulo}”?`)) return;
    const { error } = await supabase
      .from("reunion_partes")
      .delete()
      .eq("id", parte.id);
    if (error) return setError(traducirError(error.message));
    modificarPartes((prev) => prev.filter((p) => p.id !== parte.id));
  };

  /* ---------- subir el PDF de la guía ---------- */

  const elegirArchivo = async (archivo: File) => {
    setError("");
    setLectura(null);
    setEstadoGuia({ tipo: "leyendo", texto: "Leyendo el PDF de la guía…" });
    try {
      const resultado = await leerGuiaMwb(archivo, { imagenes: true });
      if (resultado.semanas.length === 0) {
        setEstadoGuia({
          tipo: "error",
          texto:
            "No se encontró ninguna semana en el PDF. Fijate que sea la guía de la reunión, con las semanas y sus temas.",
        });
        return;
      }
      setLectura(resultado);
      setEstadoGuia({
        tipo: "ok",
        texto: `${resultado.semanas.length} semana${
          resultado.semanas.length === 1 ? "" : "s"
        } en ${resultado.nombreArchivo}`,
      });
    } catch (e) {
      setEstadoGuia({
        tipo: "error",
        texto:
          "No se pudo leer el PDF: " +
          ((e as Error).message || "probá con el archivo otra vez"),
      });
    }
  };

  const crearTodas = async () => {
    if (!lectura) return;
    setEstadoGuia({ tipo: "creando", texto: "Guardando las reuniones…" });
    setError("");
    const resultado = await importarSemanas(
      lectura.semanas,
      `pdf:${lectura.nombreArchivo}`,
      roles,
      new Set(activos.map((p) => p.id)),
    );
    if (resultado.error) {
      setEstadoGuia({ tipo: "error", texto: resultado.error });
      setError(resultado.error);
      return;
    }
    setAdvertencias(resultado.advertencias || []);
    const detalles: string[] = [];
    if (resultado.creadas.length) {
      detalles.push(`${resultado.creadas.length} nueva(s)`);
    }
    if (resultado.actualizadas.length) {
      detalles.push(`${resultado.actualizadas.length} actualizada(s)`);
    }
    setEstadoGuia({
      tipo: "ok",
      texto: `Reuniones guardadas · ${detalles.join(" · ")}`,
    });
    setLectura(null);
    if (archivoRef.current) archivoRef.current.value = "";
    await cargarBase();
  };

  const quitarLectura = () => {
    setLectura(null);
    setEstadoGuia({ tipo: "idle", texto: "" });
    if (archivoRef.current) archivoRef.current.value = "";
  };

  const irAlPdf = () => {
    if (estado === "error") {
      setError("Hay un error de guardado. Revisalo antes de crear el PDF.");
      return;
    }
    if (!reunionId) return;
    setModoEdicion(false);
    router.push(`/reunion/pdf/${reunionId}`);
  };

  /* ---------------- RAIL DE ASIGNACIÓN ---------------- */

  /* En "Lectura de la Biblia" y en "Seamos mejores maestros" el tema lo
     dan de a dos: el titular y su ayudante. Con el + se agrega un tercero. */
  const esDeA = (parte: ReunionParte) =>
    parte.seccion === MULTI_SECCION || parte.role_id === rolLectura?.id;

  const railDe = (parte: ReunionParte) => {
    const rol = roles.find((r) => r.id === parte.role_id);
    const candidatos = candidatosDe(parte);
    const ocupados = ocupadosEn(parte.id);
    const ids = parte.participante_ids || [];
    const deA = esDeA(parte);
    const esEstudio = rolEstudio !== undefined && parte.role_id === rolEstudio.id;
    const duplicados = ids.filter((id) => ocupados[id]);

    const buscar = (
      valor: string | null,
      cambiar: (id: string | null) => void,
      excluir: string[],
      placeholder: string,
      key: string,
    ) => (
      <BuscadorParticipante
        key={key}
        candidatos={candidatos.filter((c) => !excluir.includes(c.id))}
        nombres={nombres}
        historial={historialVisible}
        proximas={proximas}
        hoy={hoy}
        valor={valor}
        onChange={cambiar}
        ocupados={ocupados}
        placeholder={placeholder}
        vacioTexto={
          rol ? "Nadie tiene ese rol tildado aún" : "No hay participantes activos"
        }
      />
    );

    return (
      <div
        key={parte.id}
        className="border-b border-linea/70 py-3 last:border-b-0"
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-black tracking-[0.15em] text-suave uppercase">
            {ids.length > 1
              ? `${ids.length} participantes`
              : ids.length === 1
                ? "Asignado"
                : "Sin asignar"}
          </span>
          <Etiqueta tono={rol ? "teal" : "neutro"}>
            {rol ? rol.nombre : "sin rol"}
          </Etiqueta>
        </div>

        {deA ? (
          <div className="flex flex-col gap-3">
            <div>
              <span className="mb-1 block text-[10px] font-black tracking-[0.15em] text-suave uppercase">
                Titular
              </span>
              {buscar(
                ids[0] || null,
                (id) =>
                  asignar(parte, id ? [id, ...ids.slice(1)] : ids.slice(1)),
                ids.slice(1),
                "Buscar titular…",
                "titular",
              )}
            </div>
            <div>
              <span className="mb-1 block text-[10px] font-black tracking-[0.15em] text-suave uppercase">
                Ayudante
              </span>
              {buscar(
                ids[1] || null,
                (id) => {
                  const resto = ids.slice(2);
                  return asignar(parte, id ? [...(ids[0] ? [ids[0]] : []), id, ...resto] : resto);
                },
                ids.filter((x, i) => i !== 1),
                "Buscar ayudante…",
                "ayudante",
              )}
            </div>
            {ids[2] && (
              <div>
                <span className="mb-1 block text-[10px] font-black tracking-[0.15em] text-suave uppercase">
                  Otro participante
                </span>
                {buscar(
                  ids[2],
                  (id) =>
                    asignar(
                      parte,
                      id ? [...ids.slice(0, 2), id] : ids.slice(0, 2),
                    ),
                  ids.slice(0, 2),
                  "Buscar acompañante…",
                  "tercero",
                )}
              </div>
            )}
            {!ids[2] && (
              <button
                type="button"
                onClick={() => setTerceroAbierto(parte.id)}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-linea bg-tarjeta2 px-3 py-2 text-xs font-semibold text-suave transition-colors hover:border-teal hover:text-teal"
              >
                <Plus size={13} /> Agregar un participante más
              </button>
            )}
            {terceroAbierto === parte.id && (
              <div>
                <span className="mb-1 block text-[10px] font-black tracking-[0.15em] text-suave uppercase">
                  Otro participante
                </span>
                {buscar(
                  null,
                  (id) => {
                    setTerceroAbierto(null);
                    if (id) asignar(parte, [...ids, id]);
                  },
                  ids,
                  "Buscar acompañante…",
                  "tercero-nuevo",
                )}
              </div>
            )}
          </div>
        ) : (
          buscar(
            ids[0] || null,
            (id) => asignar(parte, id ? [id] : []),
            [],
            "Buscar participante…",
            "simple",
          )
        )}

        {esEstudio && (
          <div className="mt-3 border-t border-dashed border-linea pt-3">
            <span className="mb-1.5 block text-[10px] font-black tracking-[0.15em] text-suave uppercase">
              Lector
            </span>
            <BuscadorParticipante
              candidatos={hombresActivos}
              nombres={nombres}
              historial={historialVisible}
              proximas={proximas}
              hoy={hoy}
              valor={parte.lector_id || null}
              onChange={(id) => asignarLector(parte, id)}
              ocupados={ocupados}
              placeholder="Buscar lector…"
              vacioTexto="No hay hombres activos"
            />
            <p className="mt-1 text-[11px] text-suave">
              Lee en voz alta las citas del Estudio bíblico. Solo para hombres.
            </p>
          </div>
        )}
        {duplicados.map((id) => (
          <p key={id} className="mt-1 text-[11px] text-gold">
            {nombres[id]} también está en “{ocupados[id]}”
          </p>
        ))}
        {!parte.role_id && (
          <p className="mt-1 text-[11px] text-suave">
            Sin rol: se listan todos los activos.
          </p>
        )}
      </div>
    );
  };

  const rails = (lista: ReunionParte[], alinear = false) => (
    <div className={cn("flex flex-col", alinear && "pt-4")}>
      {lista.map(railDe)}
    </div>
  );

  /* ---------------- RENDER ---------------- */

  if (cargando) {
    return (
      <Panel className="p-10 text-center text-sm text-suave">Cargando…</Panel>
    );
  }

  if (!reunionId) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-black tracking-tight">
          Vida y Ministerio
        </h1>

        <Panel className="mb-6 p-6">
          <p className="mb-4 text-sm text-suave">
            Subí el PDF de la guía (el que trae las reuniones de dos meses) y la
            app copia cada semana con sus temas, duraciones, párrafos e
            ilustraciones, tal como están. Después elegís quién hace cada tema.
          </p>
          <input
            ref={archivoRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void elegirArchivo(archivo);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Boton
              onClick={() => archivoRef.current?.click()}
              disabled={estadoGuia.tipo === "leyendo" || estadoGuia.tipo === "creando"}
            >
              {estadoGuia.tipo === "leyendo" || estadoGuia.tipo === "creando" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileUp size={15} />
              )}
              Subir PDF de la guía
            </Boton>
            {estadoGuia.texto && (
              <span
                className={cn(
                  "text-xs",
                  estadoGuia.tipo === "error" ? "text-rojo" : "text-suave",
                )}
              >
                {estadoGuia.texto}
              </span>
            )}
          </div>

          {lectura && (
            <div className="mt-5 rounded-xl border border-linea bg-tarjeta2 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold">
                  Semanas que trae el PDF ({lectura.semanas.length})
                </h2>
                <div className="flex gap-2">
                  <Boton variante="secundario" onClick={quitarLectura}>
                    Descartar
                  </Boton>
                  <Boton
                    onClick={crearTodas}
                    disabled={estadoGuia.tipo === "creando"}
                  >
                    {estadoGuia.tipo === "creando" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Plus size={15} />
                    )}
                    Crear las {lectura.semanas.length} reuniones
                  </Boton>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {lectura.semanas.map((s: SemanaMwb) => (
                  <li
                    key={s.fechaInicio}
                    className="flex items-center justify-between gap-2 rounded-lg border border-linea bg-tarjeta px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {s.titulo}
                      </span>
                      <span className="block truncate text-[11px] text-suave">
                        {s.cita || "sin cita"} · {s.partes.length} partes
                      </span>
                    </span>
                    {reuniones.some((r) => r.fecha_inicio === s.fechaInicio) && (
                      <Etiqueta tono="neutro">ya existe</Etiqueta>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-suave">
                Si una semana ya existe se actualiza sola y no se pierden las
                personas ya asignadas.
              </p>
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
              {error}
            </p>
          )}
          {advertencias.length > 0 && (
            <div className="mt-4 rounded-xl border border-gold2/50 bg-gold2/10 px-3 py-2 text-sm text-gold2">
              <p className="mb-1 font-bold">Revisá estos temas contra el PDF:</p>
              <ul className="list-inside list-disc">
                {advertencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs">
                El título de cada tema se puede corregir escribiéndolo en la lista de la
                reunión.
              </p>
            </div>
          )}
        </Panel>

        <details className="mb-8">
          <summary className="cursor-pointer text-sm font-semibold text-suave hover:text-teal">
            ¿Sin el PDF? Crear la semana a mano
          </summary>
          <Panel className="mt-3 p-6">
          <p className="mb-4 text-sm text-suave">
            Crea la semana con la plantilla de siempre (los temas se editan a
            mano después). Lo normal es subir el PDF de la guía.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Inicio de la semana *">
              <Input
                type="date"
                value={fechaNueva}
                onChange={(e) => setFechaNueva(e.target.value)}
              />
            </Campo>
            <Campo label="Cita bíblica (opcional)" hint="Ej: Jeremías 38, 39">
              <Input
                value={citaNueva}
                onChange={(e) => setCitaNueva(e.target.value)}
                placeholder="Jeremías 38, 39"
              />
            </Campo>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setFechaNueva(lunesDeEstaSemana())}
              className="cursor-pointer text-xs font-semibold text-teal hover:underline"
            >
              Usar el lunes de esta semana
            </button>
            <Boton onClick={crearSemana} disabled={creando}>
              {creando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              Crear reunión
            </Boton>
          </div>
          </Panel>
        </details>

        <h2 className="mb-3 text-sm font-bold tracking-widest text-suave uppercase">
          Semanas guardadas
        </h2>
        {reuniones.length === 0 ? (
          <Panel className="p-8 text-center text-sm text-suave">
            Todavía no hay reuniones creadas.
          </Panel>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {reuniones
                .slice((paginaReuniones - 1) * 4, paginaReuniones * 4)
                .map((r) => (
                  <div
                    key={r.id}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-linea bg-tarjeta transition hover:shadow-lg"
                    onClick={() => {
                      setReunionId(r.id);
                      router.replace(`/reunion?reunion=${r.id}`);
                    }}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden border-b border-linea bg-gray-100">
                      <iframe
                        src={`/reunion/pdf/${r.id}`}
                        className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-[0.25]"
                        title="preview"
                      />
                      <a
                        href={`/reunion/pdf/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-teal px-2 py-1 text-xs font-bold text-white shadow"
                      >
                        <FileDown size={12} /> Ver PDF
                      </a>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold">{r.titulo}</p>
                      <p className="text-xs text-suave">
                        {fechaLarga(r.fecha_inicio)} → {fechaLarga(r.fecha_fin)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
            {Math.ceil(reuniones.length / 4) > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Boton
                  variante="secundario"
                  onClick={() => setPaginaReuniones((p) => Math.max(1, p - 1))}
                  disabled={paginaReuniones === 1}
                >
                  Anterior
                </Boton>
                <span className="text-sm">
                  {paginaReuniones} / {Math.ceil(reuniones.length / 4)}
                </span>
                <Boton
                  variante="secundario"
                  onClick={() =>
                    setPaginaReuniones((p) =>
                      Math.min(Math.ceil(reuniones.length / 4), p + 1),
                    )
                  }
                  disabled={paginaReuniones === Math.ceil(reuniones.length / 4)}
                >
                  Siguiente
                </Boton>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  /* --- agrupamiento: líneas de apertura/cierre + secciones --- */

  const metaDe = (seccion: string) => {
    const directo = SECCION_META[seccion];
    if (directo) return directo;
    const u = seccion.toUpperCase();
    if (u.includes("TESOROS")) return SECCION_META["TESOROS DE LA BIBLIA"];
    if (u.includes("MAESTROS") || u.includes("SEAMOS"))
      return SECCION_META["SEAMOS MEJORES MAESTROS"];
    if (u.includes("CRISTIANA")) return SECCION_META["NUESTRA VIDA CRISTIANA"];
    if (u.includes("ASIGNACIONES") || u.includes("MECANICAS"))
      return SECCION_META["ASIGNACIONES MECANICAS"];
    return {
      color: "text-suave",
      fondo: "bg-borde",
      borde: "",
      icono: "nota",
    } as const;
  };

  const agruparLineas = (lista: ReunionParte[]) => {
    const grupos: { tipo: "linea" | "parte"; items: ReunionParte[] }[] = [];
    lista.forEach((p) => {
      const ultimo = grupos[grupos.length - 1];
      if (esLinea(p) && ultimo?.tipo === "linea") {
        ultimo.items.push(p);
      } else {
        grupos.push({ tipo: esLinea(p) ? "linea" : "parte", items: [p] });
      }
    });
    return grupos;
  };

  const seccionPartes = (seccion: string) =>
    partes.filter((p) => p.seccion === seccion);

  const seccionesACuerpo = [
    ...SECCIONES_CUERPO.filter((s) => seccionPartes(s).length > 0),
    ...partes
      .map((p) => p.seccion)
      .filter(
        (s, i, arr) =>
          !SECCIONES.includes(s as (typeof SECCIONES)[number]) &&
          arr.indexOf(s) === i,
      ),
  ];

  const lineaItems = (items: ReunionParte[]) => (
    <>
      {items.map((p, i) => (
        <span key={p.id} className="inline">
          {i > 0 && <span className="px-1.5 font-bold">|</span>}
          <span className="font-semibold">{p.titulo}</span>
          {p.duracion && (
            <span className="font-normal text-suave"> ({p.duracion})</span>
          )}
        </span>
      ))}
    </>
  );

  return (
    <div>
      {/* ---------- barra superior ---------- */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => {
              setReunionId(null);
              setModoEdicion(false);
              setEstadoGuia({ tipo: "idle", texto: "" });
              setError("");
            }}
            className="mb-2 flex cursor-pointer items-center gap-1 text-xs font-semibold text-suave transition-colors hover:text-teal"
          >
            <ChevronLeft size={14} /> Cambiar semana
          </button>
          <p className="flex flex-wrap items-center gap-2 text-sm text-suave">
            <span>
              {reunion ? fechaLarga(reunion.fecha_inicio) : ""} →{" "}
              {reunion ? fechaLarga(reunion.fecha_fin) : ""}
            </span>
            <Etiqueta tono="teal">
              {asignadas}/{partes.length} partes asignadas
            </Etiqueta>
            {reunion?.wol_doc_id && (
              <Etiqueta tono="neutro">del PDF</Etiqueta>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-suave">
            {estado === "guardando" && "Guardando…"}
            {estado === "guardado" && <span className="text-verde">Guardado ✓</span>}
            {estado === "error" && <span className="text-rojo">Error al guardar</span>}
          </span>
          <Boton
            variante="secundario"
            onClick={() => archivoRef.current?.click()}
            disabled={estadoGuia.tipo === "leyendo" || estadoGuia.tipo === "creando"}
            title="Subir el PDF de la guía para traer los temas de los próximos meses"
          >
            {estadoGuia.tipo === "leyendo" || estadoGuia.tipo === "creando" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FileUp size={15} />
            )}
            Subir PDF
          </Boton>
          <Boton
            variante={modoEdicion ? "primario" : "secundario"}
            onClick={() => setModoEdicion((v) => !v)}
          >
            {modoEdicion ? (
              <>
                <Check size={15} /> Listo
              </>
            ) : (
              <>
                <Pencil size={15} /> Editar
              </>
            )}
          </Boton>
          {modoEdicion && (
            <Boton
              variante="secundario"
              onClick={ordenarTemas}
              title="Reacomoda los temas como en la guía: 1, 2, 3 de Tesoros y después los demás"
            >
              <ListOrdered size={15} /> Ordenar temas
            </Boton>
          )}
           {reunionId && (
             <Boton
               variante="secundario"
               onClick={() => {
                 if (!reunionId) return;
                 router.push(`/reunion/asignaciones/${reunionId}`);
               }}
               title="Una imagen por persona para la Lectura de la Biblia y Seamos mejores maestros"
             >
               <ImagePlus size={15} /> Generar asignaciones
             </Boton>
           )}
           <Boton onClick={irAlPdf}>
             <FileDown size={15} /> Guardar y crear PDF
           </Boton>
           {reunionId && (
             <Boton
               variante="secundario"
               onClick={async () => {
                 if (!reunion) return;
                 if (!window.confirm(`¿Borrar la reunión "${reunion.titulo}"? Esto no se puede deshacer.`)) return;
                 await supabase.from("reunion_partes").delete().eq("reunion_id", reunionId);
                 await supabase.from("reuniones").delete().eq("id", reunionId);
                 await cargarBase();
                 setReunionId(null);
                 setModoEdicion(false);
                 setError("");
               }}
             >
               <Trash2 size={15} /> Borrar reunión
             </Boton>
           )}
         </div>
       </div>

      <input
        ref={archivoRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) void elegirArchivo(archivo);
        }}
      />

      {estadoGuia.texto && (
        <p
          className={cn(
            "mb-4 rounded-xl border px-3 py-2 text-xs",
            estadoGuia.tipo === "error"
              ? "border-rojo/40 bg-rojo/10 text-rojo"
              : estadoGuia.tipo === "ok"
                ? "border-teal/40 bg-teal/10 text-teal"
                : "border-linea bg-tarjeta2 text-suave",
          )}
        >
          {estadoGuia.texto}
        </p>
      )}

      {lectura && (
        <Panel className="mb-4 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">
              Semanas que trae el PDF ({lectura.semanas.length})
            </h2>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={quitarLectura}>
                Descartar
              </Boton>
              <Boton
                onClick={crearTodas}
                disabled={estadoGuia.tipo === "creando"}
              >
                {estadoGuia.tipo === "creando" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Crear las {lectura.semanas.length} reuniones
              </Boton>
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {lectura.semanas.map((s: SemanaMwb) => (
              <li
                key={s.fechaInicio}
                className="flex items-center justify-between gap-2 rounded-lg border border-linea bg-tarjeta2 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {s.titulo}
                  </span>
                  <span className="block truncate text-[11px] text-suave">
                    {s.cita || "sin cita"} · {s.partes.length} partes
                  </span>
                </span>
                {reuniones.some((r) => r.fecha_inicio === s.fechaInicio) && (
                  <Etiqueta tono="neutro">ya existe</Etiqueta>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      {cargandoPartes ? (
        <Panel className="p-10 text-center text-sm text-suave">
          Cargando partes…
        </Panel>
      ) : (
        <div>
          {/* ---------- encabezado de la guía ---------- */}
          <FilaGuia>
            <header className="max-w-[46rem]">
              <h1 className="text-[1.45em] leading-tight font-normal text-suave uppercase">
                {reunion?.titulo}
              </h1>
              {modoEdicion ? (
                <input
                  defaultValue={reunion?.cita_biblica || ""}
                  placeholder="Cita bíblica (Ej: Jeremías 38, 39)"
                  onBlur={async (e) => {
                    const valor = e.target.value.trim();
                    setEstado("guardando");
                    const { error } = await supabase
                      .from("reuniones")
                      .update({ cita_biblica: valor || null })
                      .eq("id", reunionId);
                    setEstado(error ? "error" : "guardado");
                  }}
                  className="mt-1 w-full border-b border-dashed border-linea bg-transparent pb-1 text-lg font-bold outline-none focus:border-teal"
                />
              ) : (
                <h2 className="mt-1 text-lg font-bold">
                  {reunion?.cita_biblica}
                </h2>
              )}
            </header>
          </FilaGuia>

          {/* ---------- títulos repetidos ---------- */}
          {repetidosPartes.length > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-gold2/50 bg-gold2/10 px-3 py-2 text-sm text-gold2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                Se repiten{" "}
                <strong>
                  {repetidosPartes.map((t) => `“${t}”`).join(", ")}
                </strong>{" "}
                en dos temas. Seguramente el PDF se leyó mal: corregí el título
                escribiéndolo acá abajo.
              </span>
            </p>
          )}

          {/* ---------- PRESIDENTE ---------- */}
          <FilaGuia
            className="mt-5"
            rail={
              rolPresidente ? (
                <BuscadorParticipante
                  candidatos={candidatosPorRol(rolPresidente.id)}
                  nombres={nombres}
                  historial={historialVisible}
              proximas={proximas}
                  hoy={hoy}
                  valor={presidenteId}
                  onChange={(id) => elegirPresidente(id)}
                  ocupados={ocupadosEn("")}
                  vacioTexto="Nadie tiene el rol “Presidente (entre semana)” tildado"
                />
              ) : (
                <p className="text-[11px] text-suave">
                  Falta el rol “Presidente”.
                </p>
              )
            }
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 items-center rounded-md bg-teal px-2 text-[11px] font-black tracking-widest text-white uppercase">
                Presidente
              </span>
              <span className="text-sm text-suave">
                {presidenteId
                  ? nombres[presidenteId]
                  : "Elegí quién preside esta semana"}
              </span>
            </div>
            <p className="mt-1 max-w-[46rem] text-[11px] text-suave">
              Se asigna a “Palabras de introducción” y “Palabras de conclusión”.
              Puede repetirse en otras partes de la misma reunión. Preside la
              reunión de entre semana, así que solo aparecen los hombres que
              tienen esa asignación tildada y son ancianos.
            </p>
          </FilaGuia>

          {/* ---------- APERTURA ---------- */}
          {seccionPartes("APERTURA").length > 0 && (
            <FilaGuia
              className="mt-6"
              rail={rails(seccionPartes("APERTURA"), true)}
            >
              <div className="max-w-[46rem] border-t-2 border-borde pt-4">
                {modoEdicion ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {seccionPartes("APERTURA").map((p, i) => (
                      <span key={p.id} className="flex items-center gap-2">
                        {i > 0 && <span className="font-bold">|</span>}
                        <Input
                          value={p.titulo}
                          onChange={(e) => editarLocal(p.id, { titulo: e.target.value })}
                          onBlur={() => guardarCampo(p.id, { titulo: p.titulo })}
                          className="w-56 border-b border-dashed border-linea bg-transparent px-1 py-0.5 font-bold"
                        />
                        <Input
                          value={p.duracion || ""}
                          onChange={(e) =>
                            editarLocal(p.id, { duracion: e.target.value })
                          }
                          onBlur={() =>
                            guardarCampo(p.id, { duracion: p.duracion })
                          }
                          placeholder="(1 min.)"
                          className="w-24 border-b border-dashed border-linea bg-transparent px-1 py-0.5 text-suave"
                        />
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 text-base">
                    <Music size={20} className="shrink-0 text-texto" />
                    {lineaItems(seccionPartes("APERTURA"))}
                  </p>
                )}
              </div>
            </FilaGuia>
          )}

          {/* ---------- secciones con puntos ---------- */}
          {seccionesACuerpo.map((seccion) => {
            const meta = metaDe(seccion);
            const Icono = iconoSeccion(meta.icono);
            const lista = seccionPartes(seccion);
            if (lista.length === 0) return null;
            return (
              <div key={seccion}>
                <FilaGuia className="mt-10">
                  <div
                    className={cn(
                      "flex max-w-[46rem] items-center gap-3",
                      meta.borde,
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] text-white",
                        meta.fondo,
                      )}
                    >
                      <Icono size={14} />
                    </span>
                    <h2 className={cn("text-base font-bold uppercase", meta.color)}>
                      {seccion}
                    </h2>
                    {modoEdicion && (
                      <button
                        onClick={() => agregarParte(seccion)}
                        className="ml-auto flex cursor-pointer items-center gap-1 text-[11px] font-bold text-suave transition-colors hover:text-teal"
                      >
                        <Plus size={13} /> Agregar parte
                      </button>
                    )}
                  </div>
                </FilaGuia>

                {agruparLineas(lista).map((grupo, idx) =>
                  grupo.tipo === "linea" ? (
                    <FilaGuia
                      key={`l-${idx}`}
                      className="mt-4"
                      rail={rails(grupo.items, true)}
                    >
                      <p className="flex max-w-[46rem] items-center gap-2 border-t-2 border-borde pt-4 text-base">
                        <Music size={20} className="shrink-0" />
                        {lineaItems(grupo.items)}
                      </p>
                    </FilaGuia>
                  ) : (
                    <FilaGuia
                      key={grupo.items[0].id}
                      className="mt-5"
                      rail={railDe(grupo.items[0])}
                    >
                      <GuiaPunto
                        parte={grupo.items[0]}
                        color={meta.color}
                        modoEdicion={modoEdicion}
                        editarLocal={editarLocal}
                        guardarCampo={guardarCampo}
                        persistir={persistirParte}
                        eliminarParte={eliminarParte}
                    moverTema={moverTema}
                        roles={roles}
                      />
                    </FilaGuia>
                  ),
                )}
              </div>
            );
          })}

          {/* ---------- ASIGNACIONES MECANICAS ---------- */}
          {seccionPartes("ASIGNACIONES MECANICAS").length > 0 && (
            <div className="mt-10">
              <FilaGuia>
                <div className="max-w-[46rem] border-b border-linea pb-2">
                  <h2 className="text-base font-bold uppercase text-teal">
                    ASIGNACIONES MECÁNICAS
                  </h2>
                </div>
              </FilaGuia>
              {seccionPartes("ASIGNACIONES MECANICAS").map((parte) => (
                <FilaGuia
                  key={parte.id}
                  className="mt-5"
                  rail={railDe(parte)}
                >
                  <GuiaPunto
                    parte={parte}
                    color="text-teal"
                    modoEdicion={modoEdicion}
                    editarLocal={editarLocal}
                    guardarCampo={guardarCampo}
                    persistir={persistirParte}
                    eliminarParte={eliminarParte}
                    moverTema={moverTema}
                    roles={roles}
                  />
                </FilaGuia>
              ))}
            </div>
          )}

          {/* ---------- CIERRE ---------- */}
          {seccionPartes("CIERRE").length > 0 && (
            <FilaGuia
              className="mt-10"
              rail={rails(seccionPartes("CIERRE"), true)}
            >
              <div className="max-w-[46rem] border-t-2 border-borde pt-4">
                {modoEdicion ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {seccionPartes("CIERRE").map((p, i) => (
                      <span key={p.id} className="flex items-center gap-2">
                        {i > 0 && <span className="font-bold">|</span>}
                        <Input
                          value={p.titulo}
                          onChange={(e) => editarLocal(p.id, { titulo: e.target.value })}
                          onBlur={() => guardarCampo(p.id, { titulo: p.titulo })}
                          className="w-56 border-b border-dashed border-linea bg-transparent px-1 py-0.5 font-bold"
                        />
                        <Input
                          value={p.duracion || ""}
                          onChange={(e) =>
                            editarLocal(p.id, { duracion: e.target.value })
                          }
                          onBlur={() =>
                            guardarCampo(p.id, { duracion: p.duracion })
                          }
                          placeholder="(3 mins.)"
                          className="w-24 border-b border-dashed border-linea bg-transparent px-1 py-0.5 text-suave"
                        />
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 text-base">
                    {lineaItems(seccionPartes("CIERRE"))}
                    <Music size={20} className="shrink-0" />
                  </p>
                )}
              </div>
            </FilaGuia>
          )}

          <p className="mt-10 text-[11px] text-suave">
            {modoEdicion
              ? "Editá títulos, duraciones, párrafos (una línea por párrafo) y la imagen de cada parte. Se guarda automáticamente."
              : "Programación copiada del PDF de la guía. Usá «Editar» para corregir o agregar temas, y «Subir PDF» para volver a traer la guía del mes."}
          </p>
        </div>
      )}
    </div>
  );
}

/* Fila de la guía: contenido a la izquierda y rail de asignación a la derecha */
function FilaGuia({
  children,
  rail,
  className,
}: {
  children: ReactNode;
  rail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-10 gap-y-0 lg:grid-cols-[minmax(0,1fr)_320px]",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      <div className="min-w-0">{rail}</div>
    </div>
  );
}

/* ---------------- PUNTO NUMERADO DE LA GUÍA ---------------- */

function GuiaPunto({
  parte,
  color,
  modoEdicion,
  editarLocal,
  guardarCampo,
  persistir,
  eliminarParte,
  moverTema,
  roles,
}: {
  parte: ReunionParte;
  color: string;
  modoEdicion: boolean;
  editarLocal: (id: string, cambios: Partial<ReunionParte>) => void;
  guardarCampo: (id: string, cambios: Partial<ReunionParte>) => Promise<void>;
  persistir: (id: string, cambios: Partial<ReunionParte>) => Promise<void>;
  eliminarParte: (p: ReunionParte) => Promise<void>;
  moverTema: (p: ReunionParte, delta: -1 | 1) => void;
  roles: Rol[];
}) {
  const lineas = lineasDe(parte.descripcion);

  return (
    <div className="max-w-[46rem]">
      <div className="flex items-start gap-3">
        {modoEdicion ? (
          <Input
            value={parte.titulo}
            onChange={(e) => editarLocal(parte.id, { titulo: e.target.value })}
            onBlur={() => guardarCampo(parte.id, { titulo: parte.titulo })}
            className={cn(
              "border-b border-dashed border-linea bg-transparent px-1 py-0.5 text-base font-bold",
              color,
            )}
          />
        ) : (
          <h3 className={cn("text-base font-bold", color)}>{parte.titulo}</h3>
        )}
        {modoEdicion && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <button
              onClick={() => moverTema(parte, -1)}
              className="cursor-pointer rounded-md border border-linea p-1.5 text-suave transition-colors hover:border-teal hover:text-teal"
              title="Subir este tema un lugar"
            >
              <ArrowUp size={13} />
            </button>
            <button
              onClick={() => moverTema(parte, 1)}
              className="cursor-pointer rounded-md border border-linea p-1.5 text-suave transition-colors hover:border-teal hover:text-teal"
              title="Bajar este tema un lugar"
            >
              <ArrowDown size={13} />
            </button>
          </span>
        )}
        {modoEdicion && (
          <button
            onClick={() => eliminarParte(parte)}
            className="shrink-0 cursor-pointer rounded-md border border-linea p-1.5 text-suave transition-colors hover:border-rojo hover:text-rojo"
            title="Eliminar parte"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="mt-1 pl-5">
        <div className="flex items-center gap-2 text-suave">
          {modoEdicion ? (
            <>
              <span>(</span>
              <Input
                value={parte.duracion || ""}
                onChange={(e) => editarLocal(parte.id, { duracion: e.target.value })}
                onBlur={() => guardarCampo(parte.id, { duracion: parte.duracion })}
                placeholder="10 mins."
                className="w-24 border-b border-dashed border-linea bg-transparent px-1 py-0"
              />
              <span>)</span>
            </>
          ) : (
            parte.duracion && <p>({parte.duracion})</p>
          )}
        </div>

        {modoEdicion ? (
          <Textarea
            value={parte.descripcion || ""}
            onChange={(e) => editarLocal(parte.id, { descripcion: e.target.value })}
            onBlur={() => guardarCampo(parte.id, { descripcion: parte.descripcion })}
            rows={Math.max(2, lineas.length + 1)}
            placeholder={
              "Una línea por párrafo.\nUna línea que empiece con PREGÚNTESE: se resalta."
            }
            className="mt-2"
          />
        ) : (
          <div className="mt-1">
            {lineas.map((l, i) =>
              /^(preg[uú]ntese|para meditar):/i.test(l) ? (
                <div key={i}>
                  <hr className="my-3 w-16 border-t border-linea" />
                  <p className="mb-1">
                    <span className={cn("font-bold", color)}>
                      {l.split(":")[0]}:
                    </span>
                    {l.slice(l.indexOf(":") + 1)}
                  </p>
                </div>
              ) : (
                <p key={i} className="mb-1">
                  {l}
                </p>
              ),
            )}
          </div>
        )}

        {(parte.imagen_url || modoEdicion) && (
          <figure className="mt-4">
            {parte.imagen_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={parte.imagen_url}
                alt={parte.pie_foto || parte.titulo}
                className="w-full max-w-xs rounded-sm border border-linea bg-gris object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="rounded-sm border border-dashed border-linea bg-gris px-3 py-4 text-center text-xs text-suave">
                Sin imagen en esta parte
              </div>
            )}
            {modoEdicion ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  value={parte.imagen_url || ""}
                  onChange={(e) =>
                    editarLocal(parte.id, { imagen_url: e.target.value })
                  }
                  onBlur={() =>
                    guardarCampo(parte.id, { imagen_url: parte.imagen_url })
                  }
                  placeholder="URL de la imagen"
                />
                <Input
                  value={parte.pie_foto || ""}
                  onChange={(e) =>
                    editarLocal(parte.id, { pie_foto: e.target.value })
                  }
                  onBlur={() =>
                    guardarCampo(parte.id, { pie_foto: parte.pie_foto })
                  }
                  placeholder="Pie de foto"
                />
              </div>
            ) : (
              parte.pie_foto && (
                <figcaption className="mt-1 text-xs text-suave">
                  {parte.pie_foto}
                </figcaption>
              )
            )}
          </figure>
        )}
      </div>

      {modoEdicion && (
        <div className="mt-3 ml-5 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-linea bg-tarjeta2 px-3 py-2">
          <span className="text-[10px] font-black tracking-widest text-suave uppercase">
            Rol requerido
          </span>
          <Select
            value={parte.role_id || ""}
            onChange={(e) =>
              persistir(parte.id, { role_id: e.target.value || null })
            }
            className="w-auto py-1 text-xs"
          >
            <option value="">Todos los participantes</option>
            {roles
              .filter((r) => r.activo)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
          </Select>
        </div>
      )}
    </div>
  );
}
