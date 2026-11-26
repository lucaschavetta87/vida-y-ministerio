"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boton, Campo, Input, Panel, Titulo } from "@/components/ui";
import { cn } from "@/lib/utils";
import EditorInforme from "@/components/EditorInforme";
import FormularioAsistencia from "@/components/FormularioAsistencia";
import { supabase } from "@/lib/supabase";
import { etiquetaMes, mesAnterior, type Informe } from "@/lib/informes";
import ActividadDelAnio from "@/components/ActividadDelAnio";
import MapaTerritorios from "@/components/MapaTerritorios";
import PaginaPdfReunion from "@/app/(privado)/reunion/pdf/[id]/page";
import PdfAsignacionesMecanicas from "@/app/(privado)/asignaciones-mecanicas/pdf/[reunionId]/page";
import { estadoDeTerritorios, type Territorio } from "@/lib/territorios";
import type { Grupo, Participante } from "@/lib/tipos";

export default function MiEspacioPage() {
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [cargando, setCargando] = useState(true);
  const [reunionActual, setReunionActual] = useState<{ id: string; titulo: string } | null>(null);
  const [archivoActual, setArchivoActual] = useState<string | null>(null);
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [colores, setColores] = useState<Record<number, any>>({});
  const [salidas, setSalidas] = useState<any[]>([]);
  const [menores, setMenores] = useState<Participante[]>([]);
  const [informesMenores, setInformesMenores] = useState<Record<string, any>>({});
  const [editandoMenor, setEditandoMenor] = useState<Participante | null>(null);
  const [informeMenor, setInformeMenor] = useState<any>(null);
  const [guardandoMenor, setGuardandoMenor] = useState(false);
  const [esAcomodador, setEsAcomodador] = useState(false);
  const [mostrarAsistencia, setMostrarAsistencia] = useState(false);
  const [grupoActual, setGrupoActual] = useState<Grupo | null>(null);
  const [nombreSuperintendente, setNombreSuperintendente] = useState<string | null>(null);
  const [nombreAuxiliar, setNombreAuxiliar] = useState<string | null>(null);

  const [mesInforme, setMesInforme] = useState(mesAnterior());
  const [informe, setInforme] = useState<Informe | null>(null);
  const [editandoInforme, setEditandoInforme] = useState(false);
  const [guardandoInforme, setGuardandoInforme] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(async (data) => {
        const p = data.participante || null;
        setParticipante(p);
        if (p?.id) {
          const { data: men } = await supabase
            .from("participantes")
            .select("*")
            .eq("parentesco_con", p.id);
          const lista = (men as Participante[]) || [];
          setMenores(lista);
          if (lista.length) {
            const { data: infs } = await supabase
              .from("informes")
              .select("*")
              .in("participante_id", lista.map((m) => m.id))
              .eq("mes", mesInforme);
            const mapa: Record<string, any> = {};
            (infs || []).forEach((i: any) => {
              mapa[i.participante_id] = i;
            });
            setInformesMenores(mapa);
          }
        }
        setCargando(false);
        if (p?.id) {
          const { data: pr } = await supabase
            .from("participante_roles")
            .select("role_id")
            .eq("participante_id", p.id);
          const roleIds = (pr as { role_id: string }[] || []).map((r) => r.role_id);
          if (roleIds.length) {
            const { data: roles } = await supabase
              .from("roles")
              .select("slug")
              .in("id", roleIds);
            const slugs = (roles as { slug: string }[] || []).map((r) => r.slug);
            setEsAcomodador(slugs.includes("acomodador"));
          }
        }
      });
  }, []);

  useEffect(() => {
    if (!participante) return;
    let cancelado = false;
    supabase
      .from("informes")
      .select("*")
      .eq("participante_id", participante.id)
      .eq("mes", mesInforme)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) setInforme((data as Informe) || null);
      });
    return () => {
      cancelado = true;
    };
  }, [participante, mesInforme]);

  /** Cargar el grupo del participante y los nombres de su superintendente y auxiliar. */
  useEffect(() => {
    if (!participante?.grupo) {
      setGrupoActual(null);
      setNombreSuperintendente(null);
      setNombreAuxiliar(null);
      return;
    }
    let cancelado = false;
    supabase
      .from("grupos")
      .select("*")
      .eq("numero", participante.grupo)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado || error) return;
        const g = data as Grupo | null;
        setGrupoActual(g || null);
        const ids = [g?.superintendente_id, g?.auxiliar_id].filter(Boolean) as string[];
        if (ids.length) {
          supabase
            .from("participantes")
            .select("id, nombre_completo")
            .in("id", ids)
            .then(({ data: ps }) => {
              if (cancelado) return;
              const mapa = (ps as { id: string; nombre_completo: string }[] || []).reduce(
                (acc, x) => { acc[x.id] = x.nombre_completo; return acc; },
                {} as Record<string, string>,
              );
              setNombreSuperintendente(mapa[g!.superintendente_id!] || null);
              setNombreAuxiliar(mapa[g!.auxiliar_id!] || null);
            });
        } else {
          setNombreSuperintendente(null);
          setNombreAuxiliar(null);
        }
      });
    return () => { cancelado = true; };
  }, [participante?.grupo]);

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    supabase
      .from("reuniones")
      .select("id, titulo, fecha_inicio, fecha_fin")
      .lte("fecha_inicio", hoy)
      .gte("fecha_fin", hoy)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setReunionActual(data as any);
      });
    const mes = hoy.slice(0, 7);
    fetch(`/api/salidas/archivo?clave=${mes}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.archivo?.archivo_url) setArchivoActual(d.archivo.archivo_url);
      });
    supabase
      .from("territorios")
      .select("*")
      .order("numero")
      .then(({ data }) => {
        const ts = (data as Territorio[]) || [];
        setTerritorios(ts);
        supabase
          .from("territorios_salidas")
          .select("*")
          .then(({ data: salidas }) => {
            const lista = (salidas as any) || [];
            setSalidas(lista.filter((s: any) => String(s.fecha || "").startsWith(mes)));
            setColores(estadoDeTerritorios(ts, lista, mes));
          });
      });
  }, []);

  const cambiarActivo = async (activo: boolean) => {
    if (!participante) return;
    await supabase.from("participantes").update({ activo }).eq("id", participante.id);
    setParticipante({ ...participante, activo });
  };

  const guardarInforme = async (borrador: any) => {
    if (!participante) return;
    setGuardandoInforme(true);
    const ahora = new Date().toISOString();
    const base = {
      participante_id: participante.id,
      mes: mesInforme,
      tipo: borrador.tipo,
      horas: borrador.horas,
      horas_meta: borrador.horas_meta,
      participo: borrador.participo,
      estudios_biblicos: borrador.estudios_biblicos,
      observaciones: borrador.observaciones,
      origen: "formulario",
      actualizado_en: ahora,
    };
    const respuesta = informe
      ? await supabase.from("informes").update(base).eq("id", informe.id).select().maybeSingle()
      : await supabase.from("informes").insert(base).select().maybeSingle();
    setGuardandoInforme(false);
    if (respuesta.error || !respuesta.data) {
      alert(respuesta.error?.message || "No se pudo guardar");
      return;
    }
    if (participante.activo === false) {
      await supabase.from("participantes").update({ activo: true }).eq("id", participante.id);
    }
    setInforme(respuesta.data as Informe);
    setEditandoInforme(false);
  };

  const guardarInformeMenor = async (borrador: any) => {
    if (!editandoMenor) return;
    setGuardandoMenor(true);
    const ahora = new Date().toISOString();
    const base = {
      participante_id: editandoMenor.id,
      mes: mesInforme,
      tipo: borrador.tipo,
      horas: borrador.horas,
      horas_meta: borrador.horas_meta,
      participo: borrador.participo,
      estudios_biblicos: borrador.estudios_bibiculos,
      observaciones: borrador.observaciones,
      origen: "formulario",
      actualizado_en: ahora,
    };
    const respuesta = await supabase.from("informes").insert(base).select().maybeSingle();
    setGuardandoMenor(false);
    if (respuesta.error || !respuesta.data) {
      alert(respuesta.error?.message || "No se pudo guardar");
      return;
    }
    if (editandoMenor.activo === false) {
      await supabase.from("participantes").update({ activo: true }).eq("id", editandoMenor.id);
    }
    setEditandoMenor(null);
  };

  if (cargando) return <Panel className="p-10 text-center">Cargando...</Panel>;
  if (!participante)
    return (
      <Panel className="p-8 text-center">
        <p className="text-sm text-suave">Tu usuario no está asignado a una persona.</p>
      </Panel>
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Titulo>Mi espacio</Titulo>
        <p className="mt-1 text-sm text-suave">{participante.nombre_completo}</p>
      </div>

      <Panel className="p-6">
        <h2 className="mb-3 text-lg font-bold">Mis datos personales</h2>
        <p className="text-sm text-suave">Editá tus datos desde “Mi perfil”.</p>
        <div className="mt-3">
          <Link href="/mi-perfil" className="text-teal hover:underline">
            Ir a Mi perfil
          </Link>
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-3 text-lg font-bold">Mi informe del mes</h2>
        {informe ? (
          <p className="text-sm text-verde">Ya enviaste tu informe. Si necesitás modificarlo, comunicate con el secretario.</p>
        ) : (
          <Boton onClick={() => setEditandoInforme(true)}>Cargar mi informe</Boton>
        )}
      </Panel>

      {grupoActual && (
        <Panel className="p-6">
          <h2 className="mb-3 text-lg font-bold">Mi grupo</h2>
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-linea bg-tarjeta2 px-4 py-3">
              <span className="text-[11px] font-black tracking-widest text-suave uppercase">
                Grupo {grupoActual.numero}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-suave uppercase">Superintendente</span>
                <span className="text-sm">
                  {nombreSuperintendente || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-suave uppercase">Auxiliar</span>
                <span className="text-sm">
                  {nombreAuxiliar || "—"}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-suave">
            Preguntale a tu superintendente o auxiliar si tenés dudas del grupo.
          </p>
        </Panel>
      )}

      {esAcomodador && (
        <Panel className="p-6">
          <h2 className="mb-3 text-lg font-bold">Asistencia a las reuniones</h2>
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              type="button"
              onClick={() => setMostrarAsistencia((v) => !v)}
              className={cn(
                "cursor-pointer rounded-lg border border-linea px-3 py-1.5 text-sm font-semibold text-suave transition-colors",
                mostrarAsistencia ? "bg-teal text-white" : "text-suave hover:bg-tarjeta2 hover:text-teal",
              )}
            >
              {mostrarAsistencia ? "Ocultar asistencia" : "Subir asistencia"}
            </button>
          </div>
          {mostrarAsistencia && (
            <FormularioAsistencia etiqueta={etiquetaMes(mesInforme)} />
          )}
        </Panel>
      )}

      {menores.length > 0 && (
        <Panel className="p-6">
          <h2 className="mb-3 text-lg font-bold">Menores a cargo</h2>
          <div className="space-y-2">
            {menores.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-linea bg-tarjeta2 px-3 py-2">
                <span className="font-bold">{m.nombre_completo}</span>
                {informesMenores[m.id] ? (
                  <span className="text-sm text-verde">Ya enviado</span>
                ) : (
                  <Boton variante="secundario" onClick={() => setEditandoMenor(m)}>
                    Cargar informe
                  </Boton>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {editandoInforme && participante && (
        <EditorInforme
          participantes={[participante]}
          participanteId={participante.id}
          informe={informe}
          mostrarSelector={false}
          mes={mesInforme}
          onCambiarPersona={() => {}}
          onCancelar={() => setEditandoInforme(false)}
          onGuardar={guardarInforme}
          onEliminar={async () => {}}
          guardando={guardandoInforme}
        />
      )}

      {editandoMenor && (
        <EditorInforme
          participantes={[editandoMenor]}
          participanteId={editandoMenor.id}
          informe={null}
          mostrarSelector={false}
          mes={mesInforme}
          onCambiarPersona={() => {}}
          onCancelar={() => setEditandoMenor(null)}
          onGuardar={guardarInformeMenor}
          onEliminar={async () => {}}
          guardando={guardandoMenor}
        />
      )}

      <Panel className="p-6">
        <h2 className="mb-3 text-lg font-bold">Esta semana (solo lectura)</h2>
        {reunionActual ? (
          <div className="space-y-4">
            <p className="font-bold">{reunionActual.titulo}</p>
            <div className="overflow-hidden rounded-xl border border-linea bg-white p-2">
              <PaginaPdfReunion reunionId={reunionActual.id} soloLectura />
            </div>
            <div className="overflow-x-auto rounded-xl border border-linea bg-white p-2" style={{ WebkitOverflowScrolling: "touch" }}>
              <PdfAsignacionesMecanicas reunionId={reunionActual.id} soloLectura />
            </div>
            {archivoActual && (
              <div className="overflow-hidden rounded-xl border border-linea bg-white p-2">
                {/\.(jpg|jpeg|png|gif|webp)$/i.test(archivoActual) ? (
                  <img src={archivoActual} alt="Salida de servicio" className="h-[600px] w-full object-contain" />
                ) : (
                  <iframe src={archivoActual} className="h-[600px] w-full" title="Salida de servicio" />
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-suave">No hay reunión para esta semana.</p>
        )}
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-3 text-lg font-bold">Mapa de territorios (solo lectura)</h2>
        <MapaTerritorios territorios={territorios} colores={colores} />
        <p className="mt-2 text-xs text-suave">Vista general de territorios.</p>
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-3 text-lg font-bold">Salidas de territorio (esta semana)</h2>
        {salidas.length === 0 ? (
          <p className="text-sm text-suave">Salidas no cargadas.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {salidas.map((s) => (
              <li key={s.id} className="rounded-lg border border-linea bg-tarjeta2 px-3 py-2">
                <span className="font-bold">{s.fecha}</span> · {s.detalle?.map((d: any) => d.territorio_numero).join(", ") || "—"}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ActividadDelAnio
        participante={participante}
        onCambiarActivo={cambiarActivo}
        soloLectura={!participante.clasificacion?.includes("ANCIANO")}
      />
    </div>
  );
}