"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Boton, Campo, Etiqueta, Input, Panel } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  CONFIG_POR_DEFECTO,
  hoyClave,
  nombreDelMes,
  type ConfigSalidas,
  type SalidaMinisterio,
} from "@/lib/territorios";
import {
  FILAS_POR_DIA,
  SEMANA,
  diasDeSemana,
  fechaTabla,
  inicioDeSemana,
  moverDias,
  normalizar,
  tituloDeSemana,
} from "@/lib/planilla";
import ModalS13 from "@/components/ModalS13";
import type { SalidaConDetalle, Territorio } from "@/lib/territorios";
import type { Participante } from "@/lib/tipos";

/* ============================================================
   La planilla se arma por semana, día por día, en la misma tabla
   que sale en el PDF:
   FECHA | HORA | UBICACIÓN | CONDUCTOR | TERRITORIO
   Cada día arranca con tres filas vacías y un + para agregar más.
   Lo que queda en blanco no se guarda ni se imprime.
   ============================================================ */

/** Una fila de la planilla mientras se la está armando. */
interface Fila {
  /** id de la base; vacío = fila nueva, todavía no guardada */
  id?: string;
  clave: string;
  fecha: string;
  hora: string;
  ubicacion: string;
  conductor_id: string;
  conductor_texto: string;
  tipo: "TERRITORIO" | "TELEFONICA";
  territorios: string;
  /** fila a lo ancho de toda la planilla (feriado, nota del día) */
  es_nota: boolean;
  /** el texto de esa nota */
  nota: string;
}

let contador = 0;
const nuevaClave = () => `n${Date.now()}-${contador++}`;

const filaVacia = (fecha: string, esNota = false): Fila => ({
  clave: nuevaClave(),
  fecha,
  hora: "",
  ubicacion: "",
  conductor_id: "",
  conductor_texto: "",
  tipo: "TERRITORIO",
  territorios: "",
  es_nota: esNota,
  nota: "",
});

const deSalida = (s: SalidaMinisterio): Fila => ({
  id: s.id,
  clave: s.id,
  fecha: s.fecha,
  hora: s.hora || "",
  ubicacion: s.ubicacion || "",
  conductor_id: s.conductor_id || "",
  conductor_texto: s.conductor_texto || "",
  tipo: (s.tipo || "TERRITORIO") as Fila["tipo"],
  territorios: s.territorios || "",
  es_nota: !!s.es_nota,
  nota: s.notas || "",
});

/** Los números de territorio escritos, ej: "21 / 20 (B,C,D,E)" → [21, 20]. */
function numerosDeTerritorios(texto: string): number[] {
  return (texto.match(/\d+/g) || [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 69);
}

/** Una fila vacía si no tiene nada escrito: no se guarda ni se imprime. */
const tieneDatos = (f: Fila) =>
  f.es_nota
    ? !!f.nota.trim()
    : !!(f.hora.trim() || f.ubicacion.trim() || f.territorios.trim() || f.conductor_texto.trim());

export default function FormularioSalidas({
  participantes,
  territorios = [],
  salidasTerritorio = [],
}: {
  participantes: Participante[];
  /** los 69 territorios, para el S-13 */
  territorios?: Territorio[];
  /** salidas de territorio ya cargadas, para el S-13 */
  salidasTerritorio?: SalidaConDetalle[];
}) {
  const hoy = hoyClave();
  /** Cualquier día de la semana que se está armando. */
  const [ancla, setAncla] = useState(inicioDeSemana(hoy));
  const [salidas, setSalidas] = useState<SalidaMinisterio[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [config, setConfig] = useState<ConfigSalidas>(CONFIG_POR_DEFECTO);
  const [territoriosHechos, setTerritoriosHechos] = useState<number[]>([]);
  /** número de territorio → publicador que lo tiene asignado */
  const [personales, setPersonales] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [aviso, setAviso] = useState("");
  const [editandoConfig, setEditandoConfig] = useState(false);
  const [viendoS13, setViendoS13] = useState(false);

  const semana = useMemo(() => diasDeSemana(ancla), [ancla]);

  /** Los aprobados para conducir salidas: solo hombres activos. */
  const conductores = useMemo(
    () =>
      participantes.filter(
        (p) =>
          p.activo && p.genero === "HOMBRE" && p.conductor_salidas_aprobado === true,
      ),
    [participantes],
  );

  /** id → nombre (de todos, por si alguno dejó de estar aprobado). */
  const nombreDe = useCallback(
    (id: string) => participantes.find((p) => p.id === id)?.nombre_completo || "",
    [participantes],
  );

  /* ---------------- carga ---------------- */

  const cargar = useCallback(async (fecha: string) => {
    const dias = diasDeSemana(fecha);
    const { data } = await supabase
      .from("salidas_ministerio")
      .select("*")
      .gte("fecha", dias[0])
      .lte("fecha", dias[6])
      .order("fecha", { ascending: true });
    const lista = (data as SalidaMinisterio[]) || [];
    setSalidas(lista);

    // cada día arranca con al menos tres filas vacías para completar
    const nuevas: Fila[] = lista.map(deSalida);
    dias.forEach((f) => {
      const cuantas = nuevas.filter((x) => x.fecha === f && !x.es_nota).length;
      for (let i = cuantas; i < FILAS_POR_DIA; i += 1) nuevas.push(filaVacia(f));
    });
    setFilas(nuevas);
    setSucio(false);
  }, []);

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase
      .from("salidas_ministerio_config")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (data) setConfig(data as ConfigSalidas);
  }, []);

  const cargarTerritorios = useCallback(async () => {
    const { data: cabeceras } = await supabase.from("territorios_salidas").select("id");
    const ids = ((cabeceras || []) as { id: string }[]).map((s) => s.id);
    if (!ids.length) return setTerritoriosHechos([]);
    const { data } = await supabase
      .from("territorios_salidas_detalle")
      .select("territorio_numero")
      .in("salida_id", ids)
      .eq("estado", "COMPLETADO");
    setTerritoriosHechos(
      [...new Set((data || []).map((d) => d.territorio_numero as number))].sort(
        (a, b) => a - b,
      ),
    );
  }, []);

  /** Los territorios que ya son personales de alguien. */
  const cargarPersonales = useCallback(async () => {
    const { data } = await supabase
      .from("territorios_personales")
      .select("publicador_id, territorio_numero");
    const mapa: Record<number, string> = {};
    ((data || []) as { publicador_id: string; territorio_numero: number }[]).forEach((a) => {
      mapa[a.territorio_numero] = participantes.find((p) => p.id === a.publicador_id)
        ?.nombre_completo || "asignado";
    });
    setPersonales(mapa);
  }, [participantes]);

  useEffect(() => {
    setCargando(true);
    Promise.all([
      cargar(ancla),
      cargarConfig(),
      cargarTerritorios(),
      cargarPersonales(),
    ]).then(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancla]);

  /* ---------------- edición ---------------- */

  const cambiarSemana = (nueva: string) => {
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Cambiar de semana igual?")) return;
    setAncla(inicioDeSemana(nueva));
  };

  const editar = (clave: string, campo: keyof Fila, valor: string | boolean) => {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
    setSucio(true);
  };

  const agregarFila = (fecha: string, esNota = false) => {
    setFilas((prev) => [...prev, filaVacia(fecha, esNota)]);
    setSucio(true);
  };

  const quitarFila = (clave: string) => {
    setFilas((prev) => prev.filter((f) => f.clave !== clave));
    setSucio(true);
  };

  /* ---------------- guardar ---------------- */

  const guardar = async () => {
    const conDatos = filas.filter(tieneDatos);
    setGuardando(true);
    setAviso("");
    const ahora = new Date().toISOString();

    for (const f of conDatos) {
      const datos = {
        fecha: f.fecha,
        hora: f.es_nota ? null : f.hora.trim() || null,
        ubicacion: f.ubicacion.trim() || null,
        conductor_id: f.conductor_id || null,
        conductor_texto: f.conductor_texto.trim() || null,
        tipo: f.tipo,
        territorios:
          f.tipo === "TERRITORIO" && !f.es_nota ? f.territorios.trim() || null : null,
        es_nota: f.es_nota,
        notas: f.es_nota ? f.nota.trim() || null : null,
        actualizado_en: ahora,
      };
      const r = f.id
        ? await supabase.from("salidas_ministerio").update(datos).eq("id", f.id)
        : await supabase
            .from("salidas_ministerio")
            .insert({ ...datos, creado_en: ahora, turno: "MANANA" });
      if (r.error) {
        setAviso(`No se pudo guardar: ${r.error.message}`);
        setGuardando(false);
        return;
      }
    }

    // lo que se vació se borra de la base
    const conservados = new Set(conDatos.filter((f) => f.id).map((f) => f.id));
    const paraBorrar = salidas.filter((s) => !conservados.has(s.id)).map((s) => s.id);
    if (paraBorrar.length)
      await supabase.from("salidas_ministerio").delete().in("id", paraBorrar);

    setGuardando(false);
    await cargar(ancla);
  };

  /* ---------------- armado de la tabla ---------------- */

  const celda =
    "w-full bg-transparent px-2 py-2 text-sm font-semibold uppercase outline-none placeholder:font-normal placeholder:text-suave/50";

  const sinHacer = Array.from({ length: 69 }, (_, i) => i + 1).filter(
    (n) => !territoriosHechos.includes(n),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ---- pendientes ---- */}
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-black">
            <CalendarDays size={16} /> Territorios que faltan
          </h2>
          <Etiqueta tono={sinHacer.length ? "neutro" : "verde"}>
            {sinHacer.length} de 69 sin completar
          </Etiqueta>
        </div>
        <p className="mt-2 text-sm leading-relaxed">
          {sinHacer.map((n) => (
            <span
              key={n}
              className="mr-1.5 inline-block rounded border border-linea bg-tarjeta2 px-1.5 py-0.5 text-xs"
            >
              {n}
            </span>
          ))}
        </p>
      </Panel>

      {/* ---- la semana ---- */}
      <Panel className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">{tituloDeSemana(ancla)}</h2>
            <p className="text-xs text-suave">
              Los 7 días con tres filas para completar. Lo que quede en blanco no sale
              en el PDF. Un conductor puede llevar varias salidas.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex items-end gap-1">
              <button
                onClick={() => cambiarSemana(moverDias(ancla, -7))}
                className="cursor-pointer rounded-xl border border-linea bg-tarjeta2 px-2.5 py-2.5 text-suave transition-colors hover:border-suave hover:text-teal"
                title="Semana anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <Campo label="Ir a la semana" className="w-40">
                <Input
                  type="date"
                  value={ancla}
                  onChange={(e) => e.target.value && cambiarSemana(e.target.value)}
                />
              </Campo>
              <button
                onClick={() => cambiarSemana(moverDias(ancla, 7))}
                className="cursor-pointer rounded-xl border border-linea bg-tarjeta2 px-2.5 py-2.5 text-suave transition-colors hover:border-suave hover:text-teal"
                title="Semana siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Boton variante="secundario" onClick={() => setEditandoConfig((v) => !v)}>
              <ImageIcon size={15} /> Encabezado
            </Boton>
            <Boton variante="secundario" onClick={() => setViendoS13(true)}>
              <FileText size={15} /> Ver S-13
            </Boton>
            <a
              href={`/servicio/salidas/pdf/semana/${ancla}`}
              target="_blank"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-suave"
            >
              <FileDown size={15} /> PDF de la semana
            </a>
            <Boton onClick={guardar} disabled={guardando || !sucio}>
              {guardando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Guardar planilla
            </Boton>
          </div>
        </div>

        {editandoConfig && (
          <Panel className="mb-4 bg-tarjeta2 p-4">
            <EncabezadoEditor
              config={config}
              semana={ancla}
              onGuardar={setConfig}
              onCerrar={() => setEditandoConfig(false)}
            />
          </Panel>
        )}

        {aviso && (
          <p className="mb-3 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
            {aviso}
          </p>
        )}

        {cargando ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-suave">
            <Loader2 size={16} className="animate-spin" /> Cargando la semana…
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="text-white" style={{ background: config.color_tabla }}>
                  <th className="w-[14%] px-2 py-2 text-left font-bold tracking-wide uppercase">
                    Fecha
                  </th>
                  <th className="w-[9%] px-2 py-2 text-left font-bold tracking-wide uppercase">
                    Hora
                  </th>
                  <th className="w-[27%] px-2 py-2 text-center font-bold tracking-wide uppercase">
                    Ubicación
                  </th>
                  <th className="w-[22%] px-2 py-2 text-center font-bold tracking-wide uppercase">
                    Conductor
                  </th>
                  <th className="w-[22%] px-2 py-2 text-center font-bold tracking-wide uppercase">
                    Territorio
                  </th>
                  <th className="w-[6%]" />
                </tr>
              </thead>
              <tbody>
                {SEMANA.map((dia, indiceDia) => {
                  const fecha = semana[indiceDia];
                  const delDia = filas.filter((f) => f.fecha === fecha);
                  const notas = delDia.filter((f) => f.es_nota);
                  // las cargadas ordenadas por hora; las vacías al final
                  const salidas = delDia
                    .filter((f) => !f.es_nota)
                    .sort((a, b) => {
                      const va = a.hora ? a.hora : "99:99";
                      const vb = b.hora ? b.hora : "99:99";
                      return va.localeCompare(vb);
                    });

                  return (
                    <Fragment key={fecha}>
                      {notas.map((f) => (
                        <tr
                          key={f.clave}
                          className="border-b border-linea"
                          style={{
                            background:
                              indiceDia % 2 ? config.color_fila_b : config.color_fila_a,
                          }}
                        >
                          <td colSpan={5}>
                            <input
                              value={f.nota}
                              onChange={(e) => editar(f.clave, "nota", e.target.value)}
                              placeholder="FERIADO NACIONAL"
                              className="w-full bg-transparent px-3 py-2 text-center text-sm font-bold tracking-wide uppercase outline-none placeholder:text-suave/50"
                            />
                          </td>
                          <td className="px-2">
                            <Borrar onClick={() => quitarFila(f.clave)} />
                          </td>
                        </tr>
                      ))}

                      {salidas.map((f, i) => (
                        <tr
                          key={f.clave}
                          className="border-b border-linea"
                          style={{
                            background:
                              indiceDia % 2 ? config.color_fila_b : config.color_fila_a,
                          }}
                        >
                          {i === 0 && (
                            <td rowSpan={salidas.length} className="align-middle">
                              <p className="px-3 py-2 text-sm font-bold tracking-wide whitespace-nowrap uppercase">
                                {fechaTabla(fecha)}
                              </p>
                              <p className="px-3 pb-2 text-[11px] text-suave">
                                {nombreDelMes(fecha.slice(0, 7))}
                              </p>
                            </td>
                          )}
                          <td className="border-b border-linea">
                            <input
                              value={f.hora}
                              onChange={(e) => editar(f.clave, "hora", e.target.value)}
                              placeholder="09:45"
                              className={celda}
                            />
                          </td>
                          <td className="border-b border-linea">
                            <input
                              value={f.ubicacion}
                              onChange={(e) => editar(f.clave, "ubicacion", e.target.value)}
                              placeholder="Eva Perón y Lisandro Moyano"
                              className={`${celda} text-center`}
                            />
                          </td>
                          <td className="relative border-b border-linea">
                            <CampoConductor
                              nombre={
                                f.conductor_id ? nombreDe(f.conductor_id) : f.conductor_texto
                              }
                              conductores={conductores}
                              cambiar={(id, texto) => {
                                setFilas((prev) =>
                                  prev.map((x) =>
                                    x.clave === f.clave
                                      ? { ...x, conductor_id: id, conductor_texto: texto }
                                      : x,
                                  ),
                                );
                                setSucio(true);
                              }}
                            />
                          </td>
                          <td className="border-b border-linea">
                            {f.tipo === "TELEFONICA" ? (
                              <p className="px-2 py-2 text-center text-sm font-bold tracking-wide uppercase">
                                Telefónica
                              </p>
                            ) : (
                              <>
                                <input
                                  value={f.territorios}
                                  onChange={(e) =>
                                    editar(f.clave, "territorios", e.target.value)
                                  }
                                  placeholder="21 / 20 (B,C,D,E)"
                                  className={`${celda} text-center`}
                                />
                                <AvisosTerritorios
                                  numeros={numerosDeTerritorios(f.territorios)}
                                  personales={personales}
                                  hechos={territoriosHechos}
                                />
                              </>
                            )}
                            <label className="flex cursor-pointer items-center justify-center gap-1 pb-1.5 text-[10px] text-suave">
                              <input
                                type="checkbox"
                                checked={f.tipo === "TELEFONICA"}
                                onChange={(e) =>
                                  editar(
                                    f.clave,
                                    "tipo",
                                    e.target.checked ? "TELEFONICA" : "TERRITORIO",
                                  )
                                }
                                className="accent-teal"
                              />
                              Telefónica (sin territorio)
                            </label>
                          </td>
                          <td className="border-b border-linea px-2">
                            <Borrar onClick={() => quitarFila(f.clave)} />
                          </td>
                        </tr>
                      ))}

                      {/* los botones del día */}
                      <tr
                        style={{
                          background: indiceDia % 2 ? config.color_fila_b : config.color_fila_a,
                        }}
                      >
                        {salidas.length === 0 && (
                          <td className="border-b border-linea px-3 py-2.5 align-middle">
                            <p className="text-sm font-bold tracking-wide whitespace-nowrap uppercase">
                              {fechaTabla(fecha)}
                            </p>
                            <p className="text-[11px] text-suave">
                              {nombreDelMes(fecha.slice(0, 7))}
                            </p>
                          </td>
                        )}
                        <td colSpan={4} className="border-b border-linea px-2 py-1.5">
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => agregarFila(fecha)}
                              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-teal transition-colors hover:bg-teal/10"
                            >
                              <Plus size={12} /> Agregar salida
                            </button>
                            <button
                              onClick={() => agregarFila(fecha, true)}
                              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-suave transition-colors hover:text-teal"
                            >
                              <Plus size={12} /> Nota a lo ancho (feriado)
                            </button>
                          </div>
                        </td>
                        <td className="border-b border-linea px-2" />
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ---- el registro S-13 ---- */}
      {viendoS13 && (
        <ModalS13
          territorios={territorios}
          salidas={salidasTerritorio}
          participantes={participantes}
          onCerrar={() => setViendoS13(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  El conductor: escribe y le muestra los aprobados que coinciden      */
/*  (también acepta un nombre escrito a mano: PRECURSORES, CARTAS…)     */
/* ------------------------------------------------------------------ */
function CampoConductor({
  nombre,
  conductores,
  cambiar,
}: {
  nombre: string;
  conductores: Participante[];
  cambiar: (id: string, texto: string) => void;
}) {
  const [texto, setTexto] = useState(nombre);
  const [abierto, setAbierto] = useState(false);
  /** dónde va la lista: va en posición fija para que la tabla no la corte */
  const [lugar, setLugar] = useState({ top: 0, left: 0, ancho: 0 });
  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  /** lo último que se le pasó al padre, para no pisarle lo que se está escribiendo */
  const [ultimo, setUltimo] = useState(nombre);

  // si el nombre cambia desde afuera (por ejemplo al elegir de la lista) se
  // ajusta durante el renderizado: el patrón que recomienda React
  const [nombreVisto, setNombreVisto] = useState(nombre);
  if (nombre !== nombreVisto) {
    setNombreVisto(nombre);
    if (nombre !== ultimo) {
      setUltimo(nombre);
      setTexto(nombre);
    }
  }

  /** medir dónde está el campo para poner la lista justo debajo */
  const medir = useCallback(() => {
    const r = campo.current?.getBoundingClientRect();
    if (r) setLugar({ top: r.bottom + 2, left: r.left, ancho: r.width });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    // si se desplaza la página, la lista sigue al campo
    const alMover = () => medir();
    window.addEventListener("scroll", alMover, true);
    window.addEventListener("resize", alMover);
    return () => {
      window.removeEventListener("scroll", alMover, true);
      window.removeEventListener("resize", alMover);
    };
  }, [abierto, medir]);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      const n = e.target as Node;
      const dentroDelCampo = caja.current?.contains(n);
      const dentroDeLaLista = lista.current?.contains(n);
      if (!dentroDelCampo && !dentroDeLaLista) setAbierto(false);
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const busqueda = normalizar(texto);
  const conexiones = conductores.filter((c) => {
    if (!busqueda) return true;
    const n = normalizar(c.nombre_completo);
    return n.includes(busqueda) || n.split(" ").some((p) => p.startsWith(busqueda));
  });

  /** Escribir a mano está permitido (PRECURSORES, CARTAS…). */
  /** abrir el desplegable, midiendo dónde está el campo */
  const abrirLista = () => {
    medir();
    setAbierto(true);
  };

  const escribir = (valor: string) => {
    setTexto(valor);
    const exacto = conductores.find((c) => c.nombre_completo.toLowerCase() === valor.toLowerCase());
    setUltimo(exacto ? exacto.nombre_completo : valor);
    cambiar(exacto ? exacto.id : "", exacto ? "" : valor);
  };

  const elegir = (nombreElegido: string, id: string) => {
    setUltimo(nombreElegido);
    setTexto(nombreElegido);
    cambiar(id, "");
    setAbierto(false);
    campo.current?.blur();
  };

  return (
    <div ref={caja} className="relative">
      <input
        ref={campo}
        value={texto}
        onChange={(e) => {
          escribir(e.target.value);
          abrirLista();
        }}
        onClick={abrirLista}
        onFocus={abrirLista}
        placeholder={
          conductores.length ? "Elegí o escribí un nombre" : "Sin conductores aprobados"
        }
        className="w-full cursor-pointer bg-transparent px-2 py-2 text-center text-sm font-semibold outline-none placeholder:font-normal placeholder:text-suave/50"
      />
      {abierto && (
        <ul
          ref={lista}
          style={{ top: lugar.top, left: lugar.left, width: Math.max(lugar.ancho, 190) }}
          className="fixed z-50 max-h-60 overflow-y-auto rounded-lg border border-linea bg-tarjeta py-1 shadow-2xl"
        >
          <li className="px-3 pt-1 pb-0.5 text-[10px] tracking-wide text-suave uppercase">
            Conductores aprobados ({conexiones.length})
          </li>
          {conexiones.length === 0 && (
            <li className="px-3 py-1.5 text-[11px] text-suave">
              Ninguno coincide: se va a guardar como texto.
            </li>
          )}
          {conexiones.map((c) => (
            <li key={c.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(c.nombre_completo, c.id)}
                className="w-full cursor-pointer px-3 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-teal/10 hover:text-teal"
              >
                {c.nombre_completo}
              </button>
            </li>
          ))}
          <li className="border-t border-linea px-3 py-1.5 text-[10px] text-suave">
            También podés escribir a mano (PRECURSORES, CARTAS…).
          </li>
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Avisos debajo del campo de territorios:                              */
/*  - si ese territorio es personal de alguien                           */
/*  - si ya se hizo en alguna salida                                    */
/*  No bloquean la carga: solo avisan.                                   */
/* ------------------------------------------------------------------ */
function AvisosTerritorios({
  numeros,
  personales,
  hechos,
}: {
  numeros: number[];
  personales: Record<number, string>;
  hechos: number[];
}) {
  if (!numeros.length) return null;

  const personalesEnElCampo = numeros.filter((n) => personales[n]);
  const hechosEnElCampo = numeros.filter((n) => !personales[n] && hechos.includes(n));

  if (!personalesEnElCampo.length && !hechosEnElCampo.length) return null;

  return (
    <div className="flex flex-col gap-0.5 px-2 pb-1.5">
      {personalesEnElCampo.map((n) => (
        <span
          key={`p${n}`}
          className="flex items-start gap-1 text-left text-[10px] leading-tight font-semibold text-gold2"
        >
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          <span>
            El {n} es territorio personal de {personales[n]}. Si lo usás, avisale.
          </span>
        </span>
      ))}
      {hechosEnElCampo.map((n) => (
        <span
          key={`h${n}`}
          className="flex items-start gap-1 text-left text-[10px] leading-tight font-semibold text-verde"
        >
          <CheckCircle2 size={10} className="mt-0.5 shrink-0" />
          <span>El {n} ya se hizo en alguna salida.</span>
        </span>
      ))}
    </div>
  );
}

function Borrar({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="my-1 cursor-pointer rounded border border-linea p-1 text-suave transition-colors hover:border-rojo hover:text-rojo"
      title="Quitar esta fila"
    >
      <Trash2 size={11} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Encabezado: textos, colores y la imagen a la derecha                */
/* ------------------------------------------------------------------ */
function EncabezadoEditor({
  config,
  semana,
  onGuardar,
  onCerrar,
}: {
  config: ConfigSalidas;
  semana: string;
  onGuardar: (c: ConfigSalidas) => void;
  onCerrar: () => void;
}) {
  const [nuevo, setNuevo] = useState<ConfigSalidas>(config);
  const [guardando, setGuardando] = useState(false);
  const dias = diasDeSemana(semana);
  const rangoSugerido = `DEL ${dias[0].split("-")[2]} AL ${dias[6].split("-")[2]}`;

  /** Lee la imagen, la achica y la guarda como data URL. */
  const elegirImagen = async (archivo: File) => {
    try {
      const dataUrl = await leerImagen(archivo);
      setNuevo((n) => ({ ...n, encabezado_imagen: dataUrl }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo leer la imagen");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Título">
          <Input
            value={nuevo.titulo || ""}
            onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })}
          />
        </Campo>
        <Campo label="Subtítulo">
          <Input
            value={nuevo.subtitulo || ""}
            onChange={(e) => setNuevo({ ...nuevo, subtitulo: e.target.value })}
          />
        </Campo>
        <Campo label="Rango" hint={`Se arma solo: ${rangoSugerido} DE OCTUBRE`}>
          <Input
            value={nuevo.rango || ""}
            onChange={(e) => setNuevo({ ...nuevo, rango: e.target.value })}
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Fondo del encabezado">
              <Input
                type="color"
                value={nuevo.color_fondo}
                onChange={(e) => setNuevo({ ...nuevo, color_fondo: e.target.value })}
              />
            </Campo>
            <Campo label="Barra de la tabla">
              <Input
                type="color"
                value={nuevo.color_tabla}
                onChange={(e) => setNuevo({ ...nuevo, color_tabla: e.target.value })}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Fondo día 1" hint="Se alterna">
              <Input
                type="color"
                value={nuevo.color_fila_a}
                onChange={(e) => setNuevo({ ...nuevo, color_fila_a: e.target.value })}
              />
            </Campo>
            <Campo label="Fondo día 2" hint="Se alterna">
              <Input
                type="color"
                value={nuevo.color_fila_b}
                onChange={(e) => setNuevo({ ...nuevo, color_fila_b: e.target.value })}
              />
            </Campo>
          </div>
        </div>

        {/* vista previa de los dos colores alternados */}
        <div className="overflow-hidden rounded-xl border border-linea">
          <table className="w-full text-xs">
            <tbody>
              {["Lunes 12", "Martes 13", "Miércoles 14"].map((d, i) => (
                <tr key={d} style={{ background: i % 2 ? nuevo.color_fila_b : nuevo.color_fila_a }}>
                  <td className="border-b border-linea px-3 py-1.5 font-bold uppercase">{d}</td>
                  <td className="border-b border-linea px-3 py-1.5">09:45</td>
                  <td className="border-b border-linea px-3 py-1.5 text-center uppercase">
                    Eva Perón y Lisandro Moyano
                  </td>
                  <td className="border-b border-linea px-3 py-1.5 text-center uppercase">
                    F. Orellano
                  </td>
                  <td className="border-b border-linea px-3 py-1.5 text-center">21 / 20</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* vista previa: el título al centro, la imagen a la derecha */}
      <div className="rounded-xl px-6 py-5 text-white" style={{ background: nuevo.color_fondo }}>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-lg font-light italic">{nuevo.titulo}</p>
            <p className="text-3xl font-light">{nuevo.subtitulo}</p>
            {nuevo.rango && <p className="text-base font-semibold uppercase">{nuevo.rango}</p>}
          </div>
          {nuevo.encabezado_imagen && (
            <img src={nuevo.encabezado_imagen} alt="" className="max-h-24 shrink-0 object-contain" />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-tarjeta px-4 py-2.5 text-sm font-semibold transition-colors hover:border-suave">
          <ImageIcon size={15} /> Elegir imagen
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && elegirImagen(e.target.files[0])}
          />
        </label>
        {nuevo.encabezado_imagen && (
          <Boton
            variante="fantasma"
            onClick={() => setNuevo({ ...nuevo, encabezado_imagen: null })}
          >
            <X size={15} /> Quitar imagen
          </Boton>
        )}
        <Boton
          className="ml-auto"
          disabled={guardando}
          onClick={async () => {
            setGuardando(true);
            const { error } = await supabase
              .from("salidas_ministerio_config")
              .upsert({ id: true, ...nuevo, actualizado_en: new Date().toISOString() });
            setGuardando(false);
            if (error) alert(error.message);
            else {
              onGuardar(nuevo);
              onCerrar();
            }
          }}
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar encabezado
        </Boton>
      </div>
      <p className="text-[11px] text-suave">
        Si el rango queda vacío se usa el de la semana que estás armando. La imagen se
        achica a 900 px de ancho y se imprime a la derecha del título.
      </p>
    </div>
  );
}

/** Lee un archivo de imagen y lo devuelve como data URL chica. */
function leerImagen(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.onload = () => {
        const max = 900;
        const escala = Math.min(1, max / img.width);
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        lienzo.getContext("2d")?.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolve(lienzo.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
  });
}