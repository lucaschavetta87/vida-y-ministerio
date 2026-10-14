"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import { Boton, Campo, Etiqueta, Input, Panel } from "@/components/ui";
import {
  COLOR_ESTADO,
  LETRAS,
  ZONAS,
  fechaCorta,
  hoyClave,
  mesDe,
  nombreDelMes,
  type Territorio,
} from "@/lib/territorios";
import type { Coincidencia } from "@/lib/informes";

type Paso = "nombre" | "elegir" | "formulario" | "enviado";

/** Lo que el conductor va marcando. */
interface Marcado {
  estado: "COMPLETADO" | "PENDIENTE";
  letras: string[];
}

export default function FormularioTerritorios() {
  const [paso, setPaso] = useState<Paso>("nombre");
  const [nombre, setNombre] = useState("");
  const [persona, setPersona] = useState<Coincidencia | null>(null);
  const [coincidencias, setCoincidencias] = useState<Coincidencia[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  const [fecha, setFecha] = useState(hoyClave());
  const [notas, setNotas] = useState("");
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [marcados, setMarcados] = useState<Record<number, Marcado>>({});

  /* ---------- paso 1: identificar al conductor ---------- */

  const buscar = async () => {
    setAviso("");
    setError("");
    if (nombre.trim().length < 3) {
      setAviso("Escribí tu nombre y apellido para buscarte.");
      return;
    }
    setBuscando(true);
    try {
      const r = await fetch(`/api/territorios?buscar=${encodeURIComponent(nombre.trim())}`);
      const respuesta = await r.json();
      if (r.status === 429 || respuesta.error) {
        setAviso(respuesta.error || "No pudimos buscar. Intentá otra vez.");
        return;
      }
      if (!respuesta.coincidencias?.length) {
        setAviso(
          "No te encontramos como conductor de salidas. Revisá cómo escribís tu nombre o pedile a un varón que esté aprobado que lo cargue.",
        );
        return;
      }
      setCoincidencias(respuesta.coincidencias);
      setPaso(respuesta.coincidencias.length === 1 ? "formulario" : "elegir");
      if (respuesta.coincidencias.length === 1) {
        await confirmar(respuesta.coincidencias[0]);
      }
    } catch {
      setAviso("No pudimos buscar tu nombre. Revisá tu conexión.");
    } finally {
      setBuscando(false);
    }
  };

  const confirmar = async (elegido: Coincidencia) => {
    setAviso("");
    setError("");
    setBuscando(true);
    try {
      const r = await fetch(`/api/territorios?persona=${elegido.id}`);
      const respuesta = await r.json();
      if (!r.ok) {
        setAviso(respuesta.error || "No pudimos verificar tu rol.");
        setPaso("nombre");
        return;
      }
      setPersona(elegido);
      setPaso("formulario");
      await cargarDisponibles(mesDe(fecha));
    } catch {
      setAviso("No pudimos verificar tu rol. Intentá otra vez.");
    } finally {
      setBuscando(false);
    }
  };

  /* ---------- territories disponibles del mes ---------- */

  const cargarDisponibles = async (mes: string) => {
    try {
      const r = await fetch(`/api/territorios?disponibles=${mes}`);
      const respuesta = await r.json();
      if (!r.ok) throw new Error(respuesta.error || "No pudimos leer los territorios.");
      setTerritorios(respuesta.territorios || []);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (paso === "formulario") cargarDisponibles(mesDe(fecha));
  }, [fecha, paso]);

  /* ---------- marcar ---------- */

  const alternar = (numero: number, estado: Marcado["estado"]) => {
    setMarcados((prev) => {
      const actual = prev[numero];
      if (actual?.estado === estado) {
        const copia = { ...prev };
        delete copia[numero];
        return copia;
      }
      return { ...prev, [numero]: { estado, letras: actual?.letras || [] } };
    });
  };

  const alternarLetra = (numero: number, letra: string) => {
    setMarcados((prev) => {
      const actual = prev[numero];
      if (!actual) return prev;
      const tiene = actual.letras.includes(letra);
      return {
        ...prev,
        [numero]: {
          ...actual,
          letras: tiene
            ? actual.letras.filter((l) => l !== letra)
            : [...actual.letras, letra].sort(),
        },
      };
    });
  };

  const porZona = useMemo(() => {
    const mapa = new Map<string, Territorio[]>();
    for (const z of ZONAS) mapa.set(z.valor, []);
    territorios.forEach((t) => mapa.get(t.zona)?.push(t));
    return mapa;
  }, [territorios]);

  const completos = useMemo(
    () => Object.values(marcados).filter((m) => m.estado === "COMPLETADO").length,
    [marcados],
  );
  const pendientes = useMemo(
    () => Object.values(marcados).filter((m) => m.estado === "PENDIENTE").length,
    [marcados],
  );

  const enviar = async () => {
    if (!persona) return;
    if (!completos && !pendientes) {
      setAviso("Marcá al menos un territorio como hecho o pendiente.");
      return;
    }
    setEnviando(true);
    setAviso("");
    try {
      const r = await fetch("/api/territorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participante_id: persona.id,
          fecha,
          notas,
          detalle: Object.entries(marcados).map(([numero, m]) => ({
            territorio: Number(numero),
            letras: m.letras,
            estado: m.estado,
          })),
        }),
      });
      const respuesta = await r.json();
      if (!r.ok) {
        setAviso(respuesta.error || "No pudimos guardar la salida.");
        return;
      }
      setPaso("enviado");
    } catch {
      setAviso("No pudimos guardar. Revisá tu conexión e intentá otra vez.");
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setPaso("nombre");
    setNombre("");
    setPersona(null);
    setCoincidencias([]);
    setMarcados({});
    setTerritorios([]);
    setNotas("");
    setFecha(hoyClave());
    setAviso("");
  };

  /* ------------------------------------------------------------------ */

  if (paso === "enviado") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Panel className="p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-verde" />
          <h1 className="text-xl font-black">¡Gracias por tu servicio!</h1>
          <p className="mt-2 text-sm text-suave">
            Registramos tu salida del {fechaCorta(fecha)}.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Etiqueta tono="verde">{completos} completos</Etiqueta>
            {pendientes > 0 && (
              <Etiqueta tono="neutro">{pendientes} pendientes</Etiqueta>
            )}
          </div>
          <Boton className="mt-6" onClick={reiniciar}>
            Registrar otra salida
          </Boton>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight">Salidas de territorio</h1>
        <p className="text-sm text-suave">
          Registrá los territorios que hiciste y cuáles quedaron a medias
        </p>
      </header>

      {paso === "nombre" && (
        <Panel className="p-6">
          <Campo label="Tu nombre y apellido" hint="Solo para los conductores de salidas aprobados">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-suave"
                />
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                  placeholder="Ej: Juan Carlos Pérez"
                  className="pl-9"
                />
              </div>
              <Boton onClick={buscar} disabled={buscando}>
                {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Buscar
              </Boton>
            </div>
          </Campo>
          {aviso && (
            <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-suave">
              {aviso}
            </p>
          )}
        </Panel>
      )}

      {paso === "elegir" && (
        <Panel className="p-6">
          <p className="mb-3 text-sm font-semibold">
            Encontramos más de uno con ese nombre. ¿Cuál sos?
          </p>
          <ul className="flex flex-col gap-2">
            {coincidencias.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => confirmar(c)}
                  className="w-full cursor-pointer rounded-xl border border-linea bg-tarjeta2 px-4 py-3 text-left font-semibold hover:border-teal"
                >
                  {c.nombre}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setPaso("nombre")}
            className="mt-4 cursor-pointer text-xs font-semibold text-teal hover:underline"
          >
            Volver a buscar
          </button>
        </Panel>
      )}

      {paso === "formulario" && persona && (
        <>
          <Panel className="mb-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{persona.nombre}</p>
                <p className="text-xs text-suave">
                  {fechaCorta(fecha)} · territories de {nombreDelMes(mesDe(fecha))}
                </p>
              </div>
              <Boton variante="fantasma" onClick={reiniciar} className="px-3 py-1.5 text-xs">
                <ChevronLeft size={14} /> Cambiar persona
              </Boton>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Campo label="Día de la salida">
                <Input
                  type="date"
                  value={fecha}
                  max={hoyClave()}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Campo>
              <Campo label="Notas (opcional)">
                <Input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej: llovió, faltó una calle"
                />
              </Campo>
            </div>
          </Panel>

          {error && (
            <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
              {error}
            </p>
          )}

          <Panel className="mb-4 p-4">
            <p className="text-sm font-semibold">
              Elegí el día: abajo solo aparecen los territorios que todavía no se
              hicieron completos este mes.
            </p>
          </Panel>

          {ZONAS.map((zona) => {
            const lista = porZona.get(zona.valor) || [];
            if (!lista.length) return null;
            return (
              <Panel key={zona.valor} className="mb-4 p-5">
                <h2 className="mb-3 text-sm font-black">
                  {zona.texto}{" "}
                  <span className="font-normal text-suave">
                    ({zona.rango}) · {lista.length} disponibles
                  </span>
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lista.map((t) => {
                    const marca = marcados[t.numero];
                    return (
                      <li
                        key={t.numero}
                        className={
                          "rounded-xl border px-3 py-2 " +
                          (marca?.estado === "COMPLETADO"
                            ? "border-verde/50 bg-verde/5"
                            : marca?.estado === "PENDIENTE"
                              ? "border-gold/50 bg-gold/5"
                              : "border-linea bg-tarjeta2")
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{
                                background: marca
                                  ? COLOR_ESTADO[marca.estado]
                                  : COLOR_ESTADO.DISPONIBLE,
                              }}
                            />
                            <strong>{t.numero}</strong>
                          </span>
                          <span className="text-[10px] text-suave">
                            {t.letras.join(" · ")}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => alternar(t.numero, "COMPLETADO")}
                            className={
                              "flex-1 cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-bold " +
                              (marca?.estado === "COMPLETADO"
                                ? "border-verde bg-verde text-white"
                                : "border-linea text-suave hover:border-verde")
                            }
                          >
                            <Check size={11} className="inline" /> Hecho
                          </button>
                          <button
                            type="button"
                            onClick={() => alternar(t.numero, "PENDIENTE")}
                            className={
                              "flex-1 cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-bold " +
                              (marca?.estado === "PENDIENTE"
                                ? "border-gold bg-gold text-white"
                                : "border-linea text-suave hover:border-gold")
                            }
                          >
                            Pendiente
                          </button>
                        </div>
                        {marca && t.letras.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {LETRAS.filter((l) => t.letras.includes(l)).map((l) => (
                              <button
                                key={l}
                                type="button"
                                onClick={() => alternarLetra(t.numero, l)}
                                className={
                                  "cursor-pointer rounded border px-1.5 py-0.5 text-[10px] font-bold " +
                                  (marca.letras.includes(l)
                                    ? "border-teal bg-teal text-fondo"
                                    : "border-linea text-suave")
                                }
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}

          <Panel className="sticky bottom-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Etiqueta tono="verde">
                  <Check size={12} /> {completos} completos
                </Etiqueta>
                {pendientes > 0 && (
                  <Etiqueta tono="neutro">{pendientes} pendientes</Etiqueta>
                )}
              </div>
              <Boton onClick={enviar} disabled={enviando}>
                {enviando ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                Guardar salida
              </Boton>
            </div>
          </Panel>

          {aviso && (
            <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-suave">
              {aviso}
            </p>
          )}
        </>
      )}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-suave">
        <AlertCircle size={12} /> Los territorios a medias quedan disponibles para
        la próxima salida.
      </p>
    </div>
  );
}