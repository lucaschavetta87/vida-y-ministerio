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

/** Colores de la maqueta: crema en los encabezados, gris muy claro en las celdas. */
const CREMA = "#FDF6E4";
const GRIS_CELDA = "#F4F4F4";

/**
 * Tamaños de la maqueta. Son números (y no clases) para poder ajustarlos
 * en un solo lugar y que la guía ocupe bien la hoja A4.
 */
const TAM = {
  titulo: 19,
  encabezado: 13,
  celda: 13,
  limpieza: 16,
  linea: 16,
  paddingCelda: 6,
  paddingEncabezado: 8,
  huecoEntreBloques: 56,
  huecoAntesDeLineas: 32,
  huecoDespuesDeLineas: 32,
};

const celda = "border border-black px-2 leading-tight";
const encabezado = "border border-black px-2 text-center leading-tight";

/** Una columna de la grilla, con su gente. */
interface Columna {
  titulo: string[];
  arriba: string;
  abajo?: string;
  /** celda que ocupa las dos filas (limpieza) */
  doble?: string;
}

/** Una línea con la etiqueta subrayada, como en la maqueta. */
function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <p
      style={{ fontSize: TAM.linea, marginBottom: TAM.linea / 3 }}
      className="leading-relaxed"
    >
      <span className="underline">{etiqueta}:</span>{" "}
      <span className="font-medium">{valor || "—"}</span>
    </p>
  );
}

/** Título centrado del bloque. */
function Titulo({ dia }: { dia: string }) {
  return (
    <h2
      style={{ fontSize: TAM.titulo, marginBottom: TAM.titulo }}
      className="text-center leading-tight"
    >
      <span className="font-bold underline">Asignaciones Mecánicas</span>
      <span className="font-medium">: {dia}</span>
    </h2>
  );
}

/** La grilla de 8 columnas. */
function Grilla({ columnas }: { columnas: Columna[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {columnas.map((c, i) => (
            <th
              key={i}
              className={encabezado}
              style={{
                background: CREMA,
                fontSize: TAM.encabezado,
                paddingTop: TAM.paddingEncabezado,
                paddingBottom: TAM.paddingEncabezado,
              }}
            >
              {c.titulo.map((linea, j) => (
                <span key={j} className="block">
                  {linea}
                </span>
              ))}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[0, 1].map((fila) => (
          <tr key={fila}>
            {columnas.map((c, i) =>
              c.doble !== undefined ? (
                fila === 0 ? (
                  <td
                    key={i}
                    rowSpan={2}
                    style={{
                      background: GRIS_CELDA,
                      paddingTop: TAM.paddingCelda,
                      paddingBottom: TAM.paddingCelda,
                    }}
                    className={`${celda} text-center`}
                  >
                    <span style={{ fontSize: TAM.limpieza }}>{c.doble}</span>
                  </td>
                ) : null
              ) : (
                <td
                  key={i}
                  className={celda}
                  style={{
                    background: GRIS_CELDA,
                    fontSize: TAM.celda,
                    paddingTop: TAM.paddingCelda,
                    paddingBottom: TAM.paddingCelda,
                  }}
                >
                  {fila === 0 ? c.arriba : c.abajo}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
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

  /** Nombre de la persona, o cadena vacía si no hay nadie asignado. */
  const get = (id: string | null | undefined) => (id ? nombres[id] || "" : "");

  /** El día que se escribió en la pantalla; si no, la fecha de la reunión. */
  const diaDe = (escrito: string | null | undefined) => {
    if (escrito && escrito.trim()) return escrito.trim();
    return reunion ? fechaLarga(reunion.fecha_inicio) : "";
  };

  /** Los campos de la tabla cambian de nombre en fin de semana. */
  const campos = (esFinDeSemana: boolean) => ({
    puerta: (esFinDeSemana ? "acomodador_puerta_fs_id" : "acomodador_puerta_id") as keyof RAM,
    auditorio: (esFinDeSemana
      ? "acomodador_auditorio_fs_id"
      : "acomodador_auditorio_id") as keyof RAM,
    audio: (esFinDeSemana ? "audio_fs_id" : "audio_id") as keyof RAM,
    video: (esFinDeSemana ? "video_fs_id" : "video_id") as keyof RAM,
    plataforma: (esFinDeSemana ? "plataforma_fs_id" : "plataforma_id") as keyof RAM,
    microfonista1: (esFinDeSemana
      ? "microfonista_1_fs_id"
      : "microfonista_1_id") as keyof RAM,
    microfonista2: (esFinDeSemana
      ? "microfonista_2_fs_id"
      : "microfonista_2_id") as keyof RAM,
    retiro1: (esFinDeSemana
      ? "retiro_donaciones_1_fs_id"
      : "retiro_donaciones_1_id") as keyof RAM,
    retiro2: (esFinDeSemana
      ? "retiro_donaciones_2_fs_id"
      : "retiro_donaciones_2_id") as keyof RAM,
  });

  const columnas = (r: RAM, esFinDeSemana: boolean): Columna[] => {
    const c = campos(esFinDeSemana);
    const nombre = (campo: keyof RAM) => get(r[campo] as string | null);
    return [
      { titulo: ["Acomodador", "Puerta"], arriba: nombre(c.puerta) },
      { titulo: ["Acomodador", "Auditorio"], arriba: nombre(c.auditorio) },
      { titulo: ["Audio"], arriba: nombre(c.audio) },
      { titulo: ["Video /", "ZOOM"], arriba: nombre(c.video) },
      { titulo: ["Plataforma"], arriba: nombre(c.plataforma) },
      {
        titulo: ["Micrófonos"],
        arriba: nombre(c.microfonista1),
        abajo: nombre(c.microfonista2),
      },
      {
        titulo: ["Retiro de", "Donaciones"],
        arriba: nombre(c.retiro1),
        abajo: nombre(c.retiro2),
      },
      {
        titulo: ["Limpieza"],
        arriba: "",
        doble:
          (esFinDeSemana
            ? r.limpieza_grupo_fin_semana
            : r.limpieza_grupo_entresemana) || "",
      },
    ];
  };

  if (cargando) return <Panel className="p-10 text-center">Cargando...</Panel>;
  if (error || !reunion || !ram)
    return <div className="p-4 text-rojo">{error || "No encontrado"}</div>;

  const oracionFinal = [
    get(ram.oracion_final_id) ||
      ram.oracion_final_texto ||
      "",
  ]
    .filter(Boolean)
    .join(" — ");

  const conferencia = [
    ram.conferencia_nombre || "",
    ram.conferencia_presenta_texto
      ? `Presenta: ${ram.conferencia_presenta_texto}`
      : "",
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="pagina-pdf mx-auto w-full max-w-[1000px] font-serif">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 font-sans">
        <Link
          href="/asignaciones-mecanicas"
          className="flex items-center gap-1 text-sm text-suave hover:text-teal"
        >
          <ChevronLeft size={15} /> Volver
        </Link>
        <button
          onClick={() => window.print()}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-bold text-white"
        >
          <Printer size={15} /> Guardar como PDF
        </button>
      </div>

      {/* -------- entre semana -------- */}
      <section className="break-inside-avoid">
        <Titulo dia={diaDe(ram.dia_entresemana)} />
        <Grilla columnas={columnas(ram, false)} />
      </section>

      {/* -------- fin de semana -------- */}
      <section
        style={{ marginTop: TAM.huecoEntreBloques }}
        className="break-inside-avoid"
      >
        <Titulo dia={diaDe(ram.dia_finsemana)} />

        <div style={{ marginBottom: TAM.huecoAntesDeLineas }}>
          <Linea etiqueta="Presidente" valor={get(ram.presidente_fin_semana_id)} />
          <Linea
            etiqueta="Oración"
            valor={get(ram.oracion_asignaciones_id) || ram.oracion_asignaciones_texto || ""}
          />
          <Linea etiqueta="Conductor de la Atalaya" valor={get(ram.conductor_atalaya_id)} />
          <Linea etiqueta="Lector" valor={get(ram.lector_id)} />
        </div>

        <Grilla columnas={columnas(ram, true)} />

        {(oracionFinal || conferencia) && (
          <div style={{ marginTop: TAM.huecoDespuesDeLineas }}>
            {oracionFinal && <Linea etiqueta="Oración final" valor={oracionFinal} />}
            {conferencia && <Linea etiqueta="Conferencia" valor={conferencia} />}
          </div>
        )}
      </section>
    </div>
  );
}