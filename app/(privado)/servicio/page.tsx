"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Loader2,
  MapPin,
  NotebookPen,
  Pencil,
  Settings2,
  Trash2,
} from "lucide-react";
import MapaTerritorios, { LeyendaMapa } from "@/components/MapaTerritorios";
import PanelTerritoriosPersonales from "@/components/PanelTerritoriosPersonales";
import FormularioSalidas from "@/components/FormularioSalidas";
import { Boton, Campo, Etiqueta, Modal, Panel, Select, Textarea, Titulo } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  LETRAS,
  ZONAS,
  estadoDeTerritorios,
  fechaCorta,
  hoyClave,
  mesDe,
  nombreDelMes,
  ultimasVisitas,
  ultimosMeses,
  type SalidaConDetalle,
  type SalidaTerritorioDetalle,
  type Territorio,
} from "@/lib/territorios";
import type { Participante } from "@/lib/tipos";

type Pestana = "territorio" | "salidas" | "personales";

export default function PaginaServicio() {
  const [pestana, setPestana] = useState<Pestana>("territorio");
  const [mes, setMes] = useState(mesDe(hoyClave()));
  const [meses, setMeses] = useState<string[]>([mesDe(hoyClave())]);

  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [salidas, setSalidas] = useState<SalidaConDetalle[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [editandoTerritorios, setEditandoTerritorios] = useState(false);
  const [viendo, setViendo] = useState<Territorio | null>(null);
  /** número de territorio → publicador que lo tiene asignado */
  const [personales, setPersonales] = useState<Record<number, string>>({});

  /* ---------- datos ---------- */

  const cargarTerritorios = useCallback(async () => {
    const { data, error } = await supabase
      .from("territorios")
      .select("*")
      .order("numero");
    if (error) setAviso("No se pudieron leer los territorios. Pegá migracion_v10.sql.");
    setTerritorios((data as Territorio[]) || []);
  }, []);

  const cargarSalidas = useCallback(async () => {
    const { data: cabeceras } = await supabase
      .from("territorios_salidas")
      .select("*")
      .order("fecha", { ascending: false });
    const lista = (cabeceras || []) as SalidaConDetalle[];
    if (!lista.length) {
      setSalidas([]);
      return;
    }
    const { data: detalles } = await supabase
      .from("territorios_salidas_detalle")
      .select("*")
      .in(
        "salida_id",
        lista.map((s) => s.id),
      );
    const porSalida = new Map<string, SalidaTerritorioDetalle[]>();
    ((detalles || []) as SalidaTerritorioDetalle[]).forEach((d) => {
      const arr = porSalida.get(d.salida_id) || [];
      arr.push(d);
      porSalida.set(d.salida_id, arr);
    });
    setSalidas(
      lista.map((s) => ({
        ...s,
        detalle: (porSalida.get(s.id) || []).sort(
          (a, b) => a.territorio_numero - b.territorio_numero,
        ),
      })),
    );
  }, []);

  useEffect(() => {
    Promise.all([
      cargarTerritorios(),
      cargarSalidas(),
      supabase.from("participantes").select("*"),
      supabase.from("territorios_personales").select("publicador_id, territorio_numero"),
    ]).then(([, , p, pe]) => {
      const personas = (p.data as Participante[]) || [];
      setParticipantes(personas);
      const mapa: Record<number, string> = {};
      (
        (pe.data as { publicador_id: string; territorio_numero: number }[]) || []
      ).forEach((a) => {
        mapa[a.territorio_numero] =
          personas.find((x) => x.id === a.publicador_id)?.nombre_completo || "alguien";
      });
      setPersonales(mapa);
    });
    setCargando(false);
  }, [cargarTerritorios, cargarSalidas]);

  /** Los meses que tienen salidas, para el selector. */
  const mesesDisponibles = useMemo(() => {
    const conDatos = new Set(salidas.map((s) => mesDe(s.fecha)));
    return ultimosMeses(24).filter((m) => conDatos.has(m));
  }, [salidas]);

  useEffect(() => {
    setMeses([...new Set([mesDe(hoyClave()), ...mesesDisponibles])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salidas.length]);

  /* ---------- cálculos del mes ---------- */

  const colores = useMemo(
    () => estadoDeTerritorios(territorios, salidas, mes),
    [territorios, salidas, mes],
  );

  const delMes = useMemo(
    () => salidas.filter((s) => mesDe(s.fecha) === mes),
    [salidas, mes],
  );

  const ultimoVisto = useMemo(() => ultimasVisitas(salidas), [salidas]);

  const completos = territorios.filter(
    (t) => t.activo && colores[t.numero]?.estado === "COMPLETADO",
  );
  const aMedias = territorios.filter(
    (t) => t.activo && colores[t.numero]?.estado === "PENDIENTE",
  );
  const disponibles = territorios.filter(
    (t) => t.activo && colores[t.numero]?.estado === "DISPONIBLE",
  );

  const nombreDe = useCallback(
    (id: string | null | undefined) =>
      participantes.find((p) => p.id === id)?.nombre_completo || "—",
    [participantes],
  );

  const borrarSalida = async (id: string) => {
    if (!window.confirm("¿Borrar esta salida de territorio?")) return;
    await supabase.from("territorios_salidas").delete().eq("id", id);
    await cargarSalidas();
  };

  const guardarObservaciones = async (numero: number, texto: string) => {
    const { error } = await supabase
      .from("territorios")
      .update({ observaciones: texto.trim() || null })
      .eq("numero", numero);
    if (error) setAviso(error.message);
    else setAviso("");
    await cargarTerritorios();
  };

  const guardarTerritorio = async (t: Territorio) => {
    const { error } = await supabase
      .from("territorios")
      .update({ letras: t.letras })
      .eq("numero", t.numero);
    if (error) setAviso(error.message);
    else setAviso("");
    await cargarTerritorios();
  };

  /* ------------------------------------------------------------------ */

  const tabs = (
    <div className="no-print mb-6 flex gap-1 overflow-x-auto border-b border-linea">
      {(
        [
          { valor: "territorio", texto: "Territorio", Icono: MapPin },
          { valor: "salidas", texto: "Salidas al ministerio", Icono: CalendarRange },
          { valor: "personales", texto: "Territorios personales", Icono: NotebookPen },
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

  if (cargando) {
    return (
      <Panel className="flex items-center justify-center gap-2 p-10 text-sm text-suave">
        <Loader2 size={16} className="animate-spin" /> Cargando servicio…
      </Panel>
    );
  }

  /* ---------------- pestaña territorio ---------------- */
  if (pestana === "territorio") {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Titulo>Territorio</Titulo>
          <div className="no-print flex flex-wrap items-end gap-3">
            <Campo label="Mes" className="w-48">
              <Select value={mes} onChange={(e) => setMes(e.target.value)}>
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {nombreDelMes(m)}
                  </option>
                ))}
              </Select>
            </Campo>
            <Boton
              variante="secundario"
              onClick={() => setEditandoTerritorios(true)}
            >
              <Settings2 size={15} /> Territorios
            </Boton>
          </div>
        </div>

        {tabs}

        {aviso && (
          <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
            {aviso}
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Etiqueta tono="verde">Completados: {completos.length} / 69</Etiqueta>
          <Etiqueta tono="neutro">A medias: {aMedias.length}</Etiqueta>
          <Etiqueta>Disponibles: {disponibles.length}</Etiqueta>
        </div>

        <Panel className="mb-6 p-4">
          <MapaTerritorios
            territorios={territorios}
            colores={colores}
            onElegir={(t) => setViendo(t)}
          />
          <div className="mt-3">
            <LeyendaMapa />
          </div>
        </Panel>

        <Panel className="mb-6 p-5">
          <h2 className="mb-3 text-sm font-black">
            Territorios pendientes de {nombreDelMes(mes)}
          </h2>
          {aMedias.length === 0 && disponibles.length === 0 ? (
            <p className="text-sm text-verde">
              Los 69 territorios están completos este mes.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...aMedias, ...disponibles].map((t) => {
                const estado = colores[t.numero]?.estado;
                return (
                  <div
                    key={t.numero}
                    className="flex items-center justify-between gap-2 rounded-xl border border-linea bg-tarjeta2 px-3 py-2"
                  >
                    <span className="text-sm">
                      <strong>{t.numero}</strong>{" "}
                      <span className="text-xs text-suave">
                        {t.letras.join(" · ")}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {estado === "PENDIENTE" && (
                        <Etiqueta tono="neutro">
                          quedó:{" "}
                          {(colores[t.numero]?.letrasHechas || []).join(" ") || "parcial"}
                        </Etiqueta>
                      )}
                      {ultimoVisto[t.numero] ? (
                        <span className="text-[10px] text-suave">
                          {fechaCorta(ultimoVisto[t.numero])}
                        </span>
                      ) : (
                        <span className="text-[10px] text-suave">nunca</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel className="overflow-x-auto">
          <div className="border-b border-linea px-5 py-3">
            <h2 className="text-sm font-black">Salidas registradas en {nombreDelMes(mes)}</h2>
          </div>
          {delMes.length === 0 ? (
            <p className="p-6 text-sm text-suave">
              Todavía no hay salidas cargadas este mes. Se cargan desde{" "}
              <code className="font-mono">/territorios</code>.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-[11px] tracking-widest text-suave uppercase">
                  <th className="px-5 py-2.5 font-bold">Día</th>
                  <th className="px-5 py-2.5 font-bold">Conductor</th>
                  <th className="px-5 py-2.5 font-bold">Completados</th>
                  <th className="px-5 py-2.5 font-bold">Pendientes</th>
                  <th className="px-5 py-2.5 font-bold">Notas</th>
                  <th className="px-5 py-2.5 text-right font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {delMes.map((s) => (
                  <tr key={s.id} className="border-b border-linea/60">
                    <td className="px-5 py-3 font-semibold">{fechaCorta(s.fecha)}</td>
                    <td className="px-5 py-3">{nombreDe(s.conductor_id)}</td>
                    <td className="px-5 py-3">
                      {s.detalle
                        .filter((d) => d.estado === "COMPLETADO")
                        .map((d) => d.territorio_numero)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3">
                      {s.detalle
                        .filter((d) => d.estado === "PENDIENTE")
                        .map(
                          (d) =>
                            `${d.territorio_numero}${
                              d.letras.length ? ` (${d.letras.join(",")})` : ""
                            }`,
                        )
                        .join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-suave">{s.notas || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => borrarSalida(s.id)}
                          className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-rojo hover:text-rojo"
                          title="Borrar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* ---- ver un territorio (modal) ---- */}
        {viendo && (
          <ModalTerritorio
            territorio={viendo}
            estado={colores[viendo.numero]?.estado || "DISPONIBLE"}
            ultimaVisita={ultimoVisto[viendo.numero] || null}
            fechaCompletado={colores[viendo.numero]?.ultima || null}
            personal={personales[viendo.numero] || null}
            onCerrar={() => setViendo(null)}
            onGuardar={guardarObservaciones}
          />
        )}

        {editandoTerritorios && (
          <Panel className="mt-6 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black">Territorios</h2>
                <p className="text-xs text-suave">
                  Corregí las manzanas si alguna no está bien
                </p>
              </div>
              <Boton variante="fantasma" onClick={() => setEditandoTerritorios(false)}>
                Cerrar
              </Boton>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {territorios.map((t) => (
                <TerritorioEditor key={t.numero} territorio={t} onGuardar={guardarTerritorio} />
              ))}
            </div>
          </Panel>
        )}
      </div>
    );
  }

  /* ---------------- pestaña territorios personales ---------------- */
  if (pestana === "personales")
    return (
      <div>
        <Titulo>Servicio</Titulo>
        {tabs}
        <PanelTerritoriosPersonales
          participantes={participantes}
          territorios={territorios}
        />
      </div>
    );

  /* ---------------- pestaña salidas ---------------- */
  return (
    <div>
      <Titulo>Servicio</Titulo>
      {tabs}
      <FormularioSalidas participantes={participantes} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor de las manzanas de un territorio                             */
/* ------------------------------------------------------------------ */
function TerritorioEditor({
  territorio,
  onGuardar,
}: {
  territorio: Territorio;
  onGuardar: (t: Territorio) => Promise<void>;
}) {
  const [letras, setLetras] = useState<string[]>(territorio.letras || []);
  const [guardando, setGuardando] = useState(false);

  const alternar = (letra: string) =>
    setLetras((prev) =>
      prev.includes(letra) ? prev.filter((l) => l !== letra) : [...prev, letra].sort(),
    );

  return (
    <div className="rounded-xl border border-linea bg-tarjeta2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm">{territorio.numero}</strong>
        <span className="text-[10px] text-suave">
          {ZONAS.find((z) => z.valor === territorio.zona)?.texto}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {LETRAS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => alternar(l)}
            className={cn(
              "h-7 w-7 cursor-pointer rounded border text-xs font-bold",
              letras.includes(l)
                ? "border-teal bg-teal text-fondo"
                : "border-linea text-suave hover:border-suave",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <Boton
        variante="secundario"
        className="w-full px-2 py-1 text-xs"
        disabled={guardando}
        onClick={async () => {
          setGuardando(true);
          await onGuardar({ ...territorio, letras });
          setGuardando(false);
        }}
      >
        {guardando ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />}
        Guardar
      </Boton>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal del territorio: cuándo se hizo y qué hay que saber             */
/* ------------------------------------------------------------------ */
function ModalTerritorio({
  territorio,
  estado,
  ultimaVisita,
  fechaCompletado,
  personal,
  onCerrar,
  onGuardar,
}: {
  territorio: Territorio;
  estado: string;
  ultimaVisita: string | null;
  fechaCompletado: string | null;
  /** si es territorio personal, el nombre de quien lo tiene */
  personal?: string | null;
  onCerrar: () => void;
  onGuardar: (numero: number, texto: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState(territorio.observaciones || "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  return (
    <Modal
      titulo={`Territorio ${territorio.numero}`}
      subtitulo={ZONAS.find((z) => z.valor === territorio.zona)?.texto}
      onCerrar={onCerrar}
      className="max-w-lg"
    >
      <div className="flex flex-col gap-4 p-6">
        {personal && (
          <p className="flex items-start gap-2 rounded-xl border border-gold2/40 bg-gold2/10 px-3 py-2 text-sm font-semibold text-gold2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Este territorio es <strong>personal de {personal}</strong>. Si se usa en una
              salida, avisale para que no se pisen.
            </span>
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-linea bg-tarjeta2 p-3">
            <p className="text-[11px] tracking-widest text-suave uppercase">Manzanas</p>
            <p className="mt-1 text-sm font-bold tracking-wide uppercase">
              {territorio.letras.join(", ") || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-linea bg-tarjeta2 p-3">
            <p className="text-[11px] tracking-widest text-suave uppercase">
              Cuándo se hizo
            </p>
            <p className="mt-1 text-sm font-bold">
              {estado === "COMPLETADO" && fechaCompletado
                ? `Completado el ${fechaCorta(fechaCompletado)}`
                : estado === "PENDIENTE"
                  ? "Este mes quedó a medias"
                  : "Este mes todavía no se hizo"}
            </p>
            <p className="mt-0.5 text-xs text-suave">
              {ultimaVisita
                ? `Última vez: ${fechaCorta(ultimaVisita)}`
                : "Nunca se registró como hecho"}
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] tracking-widest text-suave uppercase">
            Observaciones
          </label>
          <Textarea
            rows={3}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setGuardado(false);
            }}
            placeholder="Ej: la familia de la manzana C no atiende; la esquina de la calle X está cerrada."
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            {guardado && <span className="text-xs text-verde">Guardado</span>}
            <Boton
              disabled={guardando}
              onClick={async () => {
                setGuardando(true);
                await onGuardar(territorio.numero, texto);
                setGuardando(false);
                setGuardado(true);
              }}
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
              Guardar observación
            </Boton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
