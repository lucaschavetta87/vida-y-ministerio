"use client";

import { useEffect, useState } from "react";
import EditorInforme from "@/components/EditorInforme";
import { Boton, Campo, Input, Panel, Titulo } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { mesAnterior, type Informe } from "@/lib/informes";
import type { Participante } from "@/lib/tipos";

export default function MiPerfilPage() {
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefonoFijo, setTelefonoFijo] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");

  const [mesInforme, setMesInforme] = useState(mesAnterior());
  const [informe, setInforme] = useState<Informe | null>(null);
  const [editandoInforme, setEditandoInforme] = useState(false);
  const [guardandoInforme, setGuardandoInforme] = useState(false);
  const [reunionActual, setReunionActual] = useState<{ id: string; titulo: string } | null>(null);
  const [archivoActual, setArchivoActual] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        const p = data.participante as Participante | null;
        setParticipante(p);
        if (p) {
          setTelefono(p.telefono || "");
          setDireccion(p.direccion || "");
          setTelefonoFijo(p.telefono_fijo || "");
          setEstadoCivil(p.estado_civil || "");
          setContactoNombre(p.contacto_emergencia_nombre || "");
          setContactoTelefono(p.contacto_emergencia_telefono || "");
        }
        setCargando(false);
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
  }, []);

  const guardar = async () => {
    if (!participante) return;
    setGuardando(true);
    setError("");
    setOk(false);
    const { error: e } = await supabase
      .from("participantes")
      .update({
        telefono: telefono || null,
        direccion: direccion || null,
        telefono_fijo: telefonoFijo || null,
        estado_civil: estadoCivil || null,
        contacto_emergencia_nombre: contactoNombre || null,
        contacto_emergencia_telefono: contactoTelefono || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", participante.id);
    setGuardando(false);
    if (e) setError(e.message);
    else setOk(true);
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

  if (cargando) return <Panel className="p-10 text-center">Cargando...</Panel>;
  if (!participante)
    return (
      <Panel className="p-8 text-center">
        <p className="text-sm text-suave">Tu usuario no está asignado a una persona.</p>
      </Panel>
    );

  return (
    <div>
      <div className="mb-6">
        <Titulo>Mi perfil</Titulo>
        <p className="mt-1 text-sm text-suave">{participante.nombre_completo}</p>
      </div>
      <Panel className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Teléfono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Campo>
          <Campo label="Teléfono fijo">
            <Input value={telefonoFijo} onChange={(e) => setTelefonoFijo(e.target.value)} />
          </Campo>
          <Campo label="Dirección">
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </Campo>
          <Campo label="Estado civil">
            <Input value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} />
          </Campo>
          <Campo label="Contacto de emergencia">
            <Input value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} />
          </Campo>
          <Campo label="Teléfono de emergencia">
            <Input value={contactoTelefono} onChange={(e) => setContactoTelefono(e.target.value)} />
          </Campo>
        </div>
        {error && <p className="mt-3 text-sm text-rojo">{error}</p>}
        {ok && <p className="mt-3 text-sm text-verde">Guardado.</p>}
        <div className="mt-4">
          <Boton onClick={guardar} disabled={guardando}>
            Guardar
          </Boton>
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-2 text-lg font-bold">Mi informe del mes</h2>
        <p className="mb-3 text-sm text-suave">{mesInforme}</p>
        {informe ? (
          <p className="text-sm text-verde">
            Ya enviaste tu informe. Si necesitás modificarlo, comunicate con el secretario o tu superintendente de grupo.
          </p>
        ) : (
          <Boton onClick={() => setEditandoInforme(true)}>Enviar mi informe</Boton>
        )}
      </Panel>

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

      <Panel className="p-6">
        <h2 className="mb-3 text-lg font-bold">Esta semana (solo lectura)</h2>
        {reunionActual ? (
          <div className="space-y-2 text-sm">
            <p className="font-bold">{reunionActual.titulo}</p>
            <a
              href={`/reunion/pdf/${reunionActual.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-teal hover:underline"
            >
              Ver PDF de Vida y Ministerio
            </a>
            <br />
            <a
              href={`/asignaciones-mecanicas/pdf/${reunionActual.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-teal hover:underline"
            >
              Ver asignaciones mecánicas
            </a>
          </div>
        ) : (
          <p className="text-sm text-suave">No hay reunión para esta semana.</p>
        )}
        {archivoActual && (
          <div className="mt-3">
            <a href={archivoActual} target="_blank" rel="noreferrer" className="text-teal hover:underline">
              Ver salida de servicio
            </a>
          </div>
        )}
      </Panel>
    </div>
  );
}