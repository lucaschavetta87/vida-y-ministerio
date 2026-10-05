"use client";

import { useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Info,
  Loader2,
  Lock,
  Search,
  UserRound,
  Video,
} from "lucide-react";
import { Boton, Campo, Input, Panel } from "@/components/ui";
import {
  diaDeSemana,
  fechaCorta,
  hoyClave,
  validarAsistencia,
  type DatosAsistencia,
  type ErroresAsistencia,
} from "@/lib/asistencia";
import type { Coincidencia } from "@/lib/informes";

type Paso = "nombre" | "confirmar" | "elegir" | "formulario" | "enviado";

const VACIO = (): DatosAsistencia => ({
  fecha: hoyClave(),
  auditorio: null,
  zoom: null,
});

export default function FormularioAsistencia({ etiqueta }: { etiqueta: string }) {
  const [paso, setPaso] = useState<Paso>("nombre");
  const [nombre, setNombre] = useState("");
  const [persona, setPersona] = useState<Coincidencia | null>(null);
  const [coincidencias, setCoincidencias] = useState<Coincidencia[]>([]);
  const [datos, setDatos] = useState<DatosAsistencia>(VACIO);
  const [errores, setErrores] = useState<ErroresAsistencia>({});
  const [aviso, setAviso] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [registrado, setRegistrado] = useState<DatosAsistencia | null>(null);

  const reiniciar = () => {
    setPaso("nombre");
    setNombre("");
    setPersona(null);
    setCoincidencias([]);
    setDatos(VACIO());
    setErrores({});
    setAviso("");
    setRegistrado(null);
  };

  const buscar = async () => {
    setAviso("");
    setBuscando(true);
    try {
      const r = await fetch(`/api/asistencia?buscar=${encodeURIComponent(nombre.trim())}`);
      const respuesta = await r.json();
      if (r.status === 429 || respuesta.error) {
        setAviso(respuesta.error || "No pudimos buscar. Intentá otra vez.");
        return;
      }
      if (!respuesta.coincidencias?.length) {
        setAviso(
          "No encontramos ese nombre en la congregación. Revisá cómo lo escribís (apellido y nombre, con o sin acentos).",
        );
        return;
      }
      setCoincidencias(respuesta.coincidencias);
      if (respuesta.coincidencias.length === 1) {
        setPersona(respuesta.coincidencias[0]);
        setPaso("confirmar");
      } else {
        setPaso("elegir");
      }
    } catch {
      setAviso("No pudimos buscar el nombre. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBuscando(false);
    }
  };

  /** Al confirmar el nombre, se verifica que sea acomodador. */
  const confirmar = async (elegido: Coincidencia) => {
    setAviso("");
    setPersona(elegido);
    setBuscando(true);
    try {
      const r = await fetch(`/api/asistencia?persona=${elegido.id}`);
      const respuesta = await r.json();
      if (!r.ok) {
        setAviso(respuesta.error || "No pudimos verificar tu rol.");
        setPaso("nombre");
        return;
      }
      setDatos(VACIO());
      setErrores({});
      setPaso("formulario");
    } catch {
      setAviso("No pudimos verificar tu rol. Intentá otra vez.");
    } finally {
      setBuscando(false);
    }
  };

  const enviar = async () => {
    if (!persona) return;
    setAviso("");
    const validado = validarAsistencia(datos);
    if ("errores" in validado) {
      setErrores(validado.errores);
      return;
    }
    setErrores({});
    setEnviando(true);
    try {
      const r = await fetch("/api/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participante_id: persona.id, ...validado.datos }),
      });
      const respuesta = await r.json();
      if (!r.ok) {
        setAviso(respuesta.error || "No pudimos guardar la asistencia.");
        if (respuesta.errores) setErrores(respuesta.errores);
        return;
      }
      setRegistrado(validado.datos);
      setPaso("enviado");
    } catch {
      setAviso("No pudimos guardar la asistencia. Revisá tu conexión e intentá otra vez.");
    } finally {
      setEnviando(false);
    }
  };

  const total = (Number(datos.auditorio) || 0) + (Number(datos.zoom) || 0);

  return (
    <div className="mx-auto max-w-2xl">
      <Panel className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/10 text-teal">
            <UserRound size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight">Asistencia a las reuniones</h1>
          <p className="mt-1 text-sm text-suave">
            Registro de <strong className="text-texto">{etiqueta}</strong> · para acomodadores
          </p>
        </div>

        {aviso && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rojo/30 bg-rojo/5 px-4 py-3 text-sm text-rojo">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <p className="font-semibold">{aviso}</p>
          </div>
        )}

        {paso === "nombre" && (
          <div className="space-y-5">
            <Campo
              label="¿Cómo es tu nombre?"
              hint="Con que escribas una parte del nombre alcanza. No hace falta poner acentos ni el apellido completo."
            >
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") buscar();
                }}
                placeholder="Ej: castro ern o paula"
                autoComplete="off"
                autoFocus
              />
            </Campo>
            <Boton
              onClick={buscar}
              disabled={buscando || nombre.trim().length < 3}
              className="w-full"
            >
              {buscando ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
              Buscar mi nombre
            </Boton>
            <p className="text-center text-xs text-suave">
              Solo quienes tienen la asignación de <strong>Acomodador</strong> pueden cargar la
              asistencia.
            </p>
          </div>
        )}

        {paso === "elegir" && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">
              Encontramos {coincidencias.length}{" "}
              {coincidencias.length === 1 ? "persona" : "personas"} con ese nombre. ¿Cuál sos?
            </p>
            {coincidencias.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => confirmar(c)}
                disabled={buscando}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-linea bg-tarjeta2 px-4 py-3 text-left transition-colors hover:border-teal disabled:opacity-50"
              >
                <span className="text-sm font-bold">{c.nombre}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {i === 0 && (
                    <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-bold text-teal">
                      más parecido
                    </span>
                  )}
                  <span className="text-xs text-suave">
                    {c.genero === "HOMBRE" ? "Hombre" : c.genero === "MUJER" ? "Mujer" : "Pequeño"}
                    {c.edad ? ` · ${c.edad} años` : ""}
                  </span>
                </span>
              </button>
            ))}
            <Boton variante="fantasma" onClick={reiniciar} className="w-full">
              <ChevronLeft size={16} /> Volver a escribir el nombre
            </Boton>
          </div>
        )}

        {paso === "confirmar" && persona && (
          <div className="space-y-5">
            <div className="rounded-xl border border-teal/30 bg-teal/5 px-4 py-4 text-center">
              <p className="text-sm text-suave">¿Sos vos?</p>
              <p className="mt-1 text-lg font-black tracking-tight">{persona.nombre}</p>
            </div>
            <Boton onClick={() => confirmar(persona)} disabled={buscando} className="w-full">
              {buscando ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              Sí, soy yo
            </Boton>
            <Boton variante="secundario" onClick={reiniciar} className="w-full">
              No, es otro nombre
            </Boton>
          </div>
        )}

        {paso === "formulario" && persona && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-linea bg-tarjeta2 px-4 py-3">
              <span className="text-sm font-bold">{persona.nombre}</span>
              <button
                type="button"
                onClick={reiniciar}
                className="cursor-pointer text-xs font-semibold text-teal hover:underline"
              >
                Cambiar nombre
              </button>
            </div>

            <div className="space-y-4">
              <Campo
                label="Día de la reunión"
                hint="Elegí el día, mes y año de la reunión que estuviste cargando."
              >
                <Input
                  type="date"
                  value={datos.fecha}
                  min="2020-01-01"
                  max={hoyClave()}
                  onChange={(e) => setDatos({ ...datos, fecha: e.target.value })}
                />
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Asistentes en auditorio">
                  <Input
                    type="number"
                    min={0}
                    value={datos.auditorio ?? ""}
                    onChange={(e) =>
                      setDatos({
                        ...datos,
                        auditorio: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                  />
                </Campo>
                <Campo label="Asistentes por Zoom">
                  <Input
                    type="number"
                    min={0}
                    value={datos.zoom ?? ""}
                    onChange={(e) =>
                      setDatos({
                        ...datos,
                        zoom: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                  />
                </Campo>
              </div>

              {(errores.fecha || errores.auditorio || errores.zoom) && (
                <div className="space-y-1 text-xs text-rojo">
                  {errores.fecha && <p>{errores.fecha}</p>}
                  {errores.auditorio && <p>Auditorio: {errores.auditorio}</p>}
                  {errores.zoom && <p>Zoom: {errores.zoom}</p>}
                </div>
              )}

              <div className="flex items-center justify-center gap-6 rounded-xl border border-teal/30 bg-teal/5 px-4 py-4">
                <span className="flex items-center gap-2 text-sm text-suave">
                  <Building2 size={16} /> {Number(datos.auditorio) || 0}
                </span>
                <span className="flex items-center gap-2 text-sm text-suave">
                  <Video size={16} /> {Number(datos.zoom) || 0}
                </span>
                <span className="text-sm text-suave">
                  Total:{" "}
                  <strong className="text-2xl text-teal">{total}</strong>
                </span>
              </div>

              <Boton onClick={enviar} disabled={enviando} className="w-full py-3">
                {enviando ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}
                Enviar la asistencia
              </Boton>
            </div>
          </div>
        )}

        {paso === "enviado" && registrado && (
          <div className="space-y-5 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-verde/10 text-verde">
              <CheckCircle2 size={30} />
            </span>
            <div>
              <p className="text-lg font-black tracking-tight">¡Asistencia registrada!</p>
              <p className="mt-1 text-sm text-suave">
                {diaDeSemana(registrado.fecha)}, {fechaCorta(registrado.fecha)} ·{" "}
                <strong className="text-texto">
                  {(Number(registrado.auditorio) || 0) + (Number(registrado.zoom) || 0)}{" "}
                  asistentes
                </strong>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Boton
                variante="secundario"
                onClick={() => {
                  setRegistrado(null);
                  setDatos(VACIO());
                  setErrores({});
                  setAviso("");
                  setPaso("formulario");
                }}
              >
                <CalendarDays size={16} /> Cargar otro día
              </Boton>
              <Boton variante="fantasma" onClick={reiniciar}>
                Cargar la asistencia de otro acomodador
              </Boton>
            </div>
          </div>
        )}

        <div className="mt-7 flex items-start gap-2 border-t border-linea pt-4 text-xs text-suave">
          {paso === "formulario" ? (
            <Lock size={13} className="mt-0.5 shrink-0" />
          ) : (
            <Info size={13} className="mt-0.5 shrink-0" />
          )}
          <p>
            Solo la Secretaría de la congregación ve este registro. Si no sos acomodador de esta
            congregación, cerrá esta página.
          </p>
        </div>
      </Panel>
    </div>
  );
}
