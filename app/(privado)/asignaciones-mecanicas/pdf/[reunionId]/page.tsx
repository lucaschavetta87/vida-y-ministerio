"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { Panel } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { Participante, Reunion } from "@/lib/tipos";
import { fechaLarga } from "@/lib/plantilla";

interface RAM {
  id?: string;
  reunion_id: string;
  dia_entresemana: string | null;
  acomodador_puerta_id: string | null;
  acomodador_auditorio_id: string | null;
  microfonista_1_id: string | null;
  microfonista_2_id: string | null;
  audio_video_id: string | null;
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
  audio_video_fs_id: string | null;
  plataforma_fs_id: string | null;
  retiro_donaciones_1_fs_id: string | null;
  retiro_donaciones_2_fs_id: string | null;
  limpieza_grupo_fin_semana: string | null;
  oracion_final_id: string | null;
  oracion_final_texto: string | null;
  notas: string | null;
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <tr className="border-b border-linea">
      <td className="w-56 border-r border-linea bg-gris/50 px-2 py-1.5 font-bold text-xs">
        {etiqueta}
      </td>
      <td className="px-2 py-1.5 text-sm font-semibold">
        {valor || <span className="font-normal text-suave">—</span>}
      </td>
    </tr>
  );
}

export default function PdfAsignacionesMecanicas() {
  const { reunionId } = useParams<{ reunionId: string }>();
  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [ram, setRam] = useState<RAM | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reunionId) return;
    const cargar = async () => {
      const [r, ra, p] = await Promise.all([
        supabase.from("reuniones").select("*").eq("id", reunionId).single(),
        supabase
          .from("reunion_asignaciones_mecanicas")
          .select("*")
          .eq("reunion_id", reunionId)
          .maybeSingle(),
        supabase.from("participantes").select("*"),
      ]);
      if (r.error) setError(r.error.message);
      setReunion(r.data as Reunion);
      setRam((ra.data as RAM) || null);
      setParticipantes((p.data as Participante[]) || []);
      setCargando(false);
    };
    cargar();
  }, [reunionId]);

  const nombres = useMemo(() => {
    const mapa: Record<string, string> = {};
    participantes.forEach((p) => (mapa[p.id] = p.nombre_completo));
    return mapa;
  }, [participantes]);

  const get = (id: string | null | undefined) =>
    id ? nombres[id] || "—" : "—";

  const dos = (a: string | null | undefined, b: string | null | undefined) => {
    const n1 = a ? nombres[a] || "—" : "";
    const n2 = b ? nombres[b] || "—" : "";
    if (n1 && n2) return `${n1} / ${n2}`;
    return n1 || n2 || "";
  };

  if (cargando) return <Panel className="p-10 text-center">Cargando...</Panel>;
  if (error || !reunion)
    return <div className="p-4 text-rojo">{error || "No encontrado"}</div>;

  return (
    <div className="pagina-pdf mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/asignaciones-mecanicas"
          className="flex items-center gap-1 text-sm text-suave hover:text-teal"
        >
          <ChevronLeft size={15} /> Volver
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-bold text-white"
        >
          <Printer size={15} /> Guardar como PDF
        </button>
      </div>

      <header className="mb-4 border-b-2 border-texto pb-3">
        <h1 className="text-lg font-black uppercase">
          Asignaciones Este Las Heras
        </h1>
        <p className="text-sm font-semibold">{reunion.titulo}</p>
        <p className="text-xs text-suave">
          {fechaLarga(reunion.fecha_inicio)} → {fechaLarga(reunion.fecha_fin)}
        </p>
      </header>

      <h2 className="mb-2 mt-6 border-b border-texto pb-1 text-sm font-black tracking-widest uppercase">
        Reunión de Entresemana
      </h2>
      <table className="mb-6 w-full border-collapse">
        <tbody>
          <Fila etiqueta="Día de la Reunión" valor={ram?.dia_entresemana || ""} />
          <Fila etiqueta="Acomodador de Puerta" valor={get(ram?.acomodador_puerta_id)} />
          <Fila etiqueta="Acomodador de Auditorio" valor={get(ram?.acomodador_auditorio_id)} />
          <Fila etiqueta="Micrófonista 1" valor={get(ram?.microfonista_1_id)} />
          <Fila etiqueta="Micrófonista 2" valor={get(ram?.microfonista_2_id)} />
          <Fila etiqueta="Audio y Video" valor={get(ram?.audio_video_id)} />
          <Fila etiqueta="Plataforma" valor={get(ram?.plataforma_id)} />
          <Fila
            etiqueta="Retiro de Donaciones"
            valor={dos(ram?.retiro_donaciones_1_id, ram?.retiro_donaciones_2_id)}
          />
          <Fila etiqueta="Limpieza - Grupo" valor={ram?.limpieza_grupo_entresemana || ""} />
        </tbody>
      </table>

      <h2 className="mb-2 border-b border-texto pb-1 text-sm font-black tracking-widest uppercase">
        Reunión de Fin de Semana
      </h2>
      <table className="w-full border-collapse">
        <tbody>
          <Fila etiqueta="Día de la Reunión" valor={ram?.dia_finsemana || ""} />
          <Fila etiqueta="Presidente" valor={get(ram?.presidente_fin_semana_id)} />
          <Fila
            etiqueta="Oración (Asignaciones)"
            valor={get(ram?.oracion_asignaciones_id)}
          />
          {(ram?.conferencia_nombre || ram?.conferencia_presenta_texto) && (
            <Fila
              etiqueta="Conferencia"
              valor={[
                ram?.conferencia_nombre || "",
                ram?.conferencia_presenta_texto
                  ? `Presenta: ${ram.conferencia_presenta_texto}`
                  : "",
              ]
                .filter(Boolean)
                .join(" — ")}
            />
          )}
          <Fila etiqueta="Conductor de Atalaya" valor={get(ram?.conductor_atalaya_id)} />
          <Fila etiqueta="Lector (Atalaya)" valor={get(ram?.lector_id)} />
          <Fila etiqueta="Acomodador de Puerta" valor={get(ram?.acomodador_puerta_fs_id)} />
          <Fila etiqueta="Acomodador de Auditorio" valor={get(ram?.acomodador_auditorio_fs_id)} />
          <Fila etiqueta="Micrófonista 1" valor={get(ram?.microfonista_1_fs_id)} />
          <Fila etiqueta="Micrófonista 2" valor={get(ram?.microfonista_2_fs_id)} />
          <Fila etiqueta="Audio y Video" valor={get(ram?.audio_video_fs_id)} />
          <Fila etiqueta="Plataforma" valor={get(ram?.plataforma_fs_id)} />
          <Fila
            etiqueta="Retiro de Donaciones"
            valor={dos(ram?.retiro_donaciones_1_fs_id, ram?.retiro_donaciones_2_fs_id)}
          />
          <Fila
            etiqueta="Limpieza - Grupo"
            valor={ram?.limpieza_grupo_fin_semana || ram?.limpieza_grupo_entresemana || ""}
          />
          <Fila
            etiqueta="Oración Final"
            valor={
              get(ram?.oracion_final_id) +
              (ram?.oracion_final_texto ? ` — ${ram.oracion_final_texto}` : "")
            }
          />
        </tbody>
      </table>
    </div>
  );
}
