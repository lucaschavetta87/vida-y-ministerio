"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Info,
  Loader2,
  Lock,
  Search,
  UserRound,
} from "lucide-react";
import CamposInforme, { BORRADOR_VACIO } from "@/components/CamposInforme";
import { Boton, Campo, Input, Panel } from "@/components/ui";
import {
  validarInforme,
  type BorradorFormulario,
  type Coincidencia,
  type ErroresInforme,
} from "@/lib/informes";

type Paso = "nombre" | "confirmar" | "elegir" | "formulario" | "enviado" | "cerrado";

interface Resumen {
  tipo: string;
  horas: number | null;
  horas_meta: number | null;
  participo: boolean | null;
  estudios_biblicos: number;
  observaciones: string | null;
}

export default function FormularioInforme({ etiqueta }: { etiqueta: string }) {
  const [paso, setPaso] = useState<Paso>("nombre");
  const [nombre, setNombre] = useState("");
  const [persona, setPersona] = useState<Coincidencia | null>(null);
  const [coincidencias, setCoincidencias] = useState<Coincidencia[]>([]);
  const [borrador, setBorrador] = useState<BorradorFormulario>(BORRADOR_VACIO);
  const [errores, setErrores] = useState<ErroresInforme>({});
  const [aviso, setAviso] = useState("");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const reiniciar = () => {
    setPaso("nombre");
    setNombre("");
    setPersona(null);
    setCoincidencias([]);
    setBorrador(BORRADOR_VACIO);
    setErrores({});
    setAviso("");
    setResumen(null);
  };

  const buscar = async () => {
    setAviso("");
    setBuscando(true);
    try {
      const r = await fetch(`/api/informes?buscar=${encodeURIComponent(nombre.trim())}`);
      const datos = await r.json();
      if (r.status === 429 || datos.error) {
        setAviso(datos.error || "No pudimos buscar. Intentá otra vez.");
        return;
      }
      if (!datos.coincidencias?.length) {
        setAviso(
          "No encontramos ese nombre en la congregación. Revisá cómo lo escribís (apellido y nombre, con o sin acentos).",
        );
        return;
      }
      setCoincidencias(datos.coincidencias);
      if (datos.coincidencias.length === 1) {
        setPersona(datos.coincidencias[0]);
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

  /** Al confirmar el nombre, se ve si ya envió el informe del mes. */
  const confirmar = async (elegido: Coincidencia) => {
    setAviso("");
    setPersona(elegido);
    setBuscando(true);
    try {
      const r = await fetch(`/api/informes/estado/${elegido.id}`);
      const datos = await r.json();
      if (!r.ok) {
        setAviso(datos.error || "No pudimos verificar el informe.");
        return;
      }
      if (datos.enviado) {
        setResumen(datos.resumen || null);
        setPaso("cerrado");
        return;
      }
      setBorrador(BORRADOR_VACIO);
      setPaso("formulario");
    } catch {
      setAviso("No pudimos verificar el informe. Intentá otra vez.");
    } finally {
      setBuscando(false);
    }
  };

  const enviar = async () => {
    if (!persona) return;
    setAviso("");
    const validado = validarInforme(borrador);
    if ("errores" in validado) {
      setErrores(validado.errores);
      return;
    }
    setErrores({});
    setEnviando(true);
    try {
      const r = await fetch("/api/informes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participante_id: persona.id, ...validado.datos }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setAviso(datos.error || "No pudimos guardar tu informe.");
        if (datos.errores) setErrores(datos.errores);
        if (datos.yaEnviado) setPaso("cerrado");
        return;
      }
      setPaso("enviado");
    } catch {
      setAviso("No pudimos guardar tu informe. Revisá tu conexión e intentá otra vez.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Panel className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/10 text-teal">
            <UserRound size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight">Informe de actividad</h1>
          <p className="mt-1 text-sm text-suave">
            Informe de <strong className="text-texto">{etiqueta}</strong>
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
              La lista de la congregación no se muestra: escribí tu nombre y te preguntamos si
              eres vos.
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
            <Boton
              onClick={() => confirmar(persona)}
              disabled={buscando}
              className="w-full"
            >
              {buscando ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              Sí, soy yo
            </Boton>
            <Boton variante="secundario" onClick={reiniciar} className="w-full">
              No, es otro nombre
            </Boton>
          </div>
        )}

        {(paso === "formulario" || paso === "cerrado") && persona && (
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

            {paso === "cerrado" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl border border-verde/30 bg-verde/5 px-4 py-3.5 text-sm">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-verde" />
                  <div>
                    <p className="font-bold text-verde">
                      Ya enviaste tu informe de {etiqueta}.
                    </p>
                    {resumen && (
                      <ul className="mt-2 space-y-1 text-xs text-suave">
                        <li>
                          Situación: <strong className="text-texto">{resumen.tipo}</strong>
                        </li>
                        {resumen.horas_meta !== null && (
                          <li>
                            Meta de auxiliar:{" "}
                            <strong className="text-texto">{resumen.horas_meta} horas</strong>
                          </li>
                        )}
                        {resumen.horas !== null && (
                          <li>
                            Horas: <strong className="text-texto">{resumen.horas}</strong>
                          </li>
                        )}
                        {resumen.participo !== null && (
                          <li>
                            Participaste:{" "}
                            <strong className="text-texto">{resumen.participo ? "Sí" : "No"}</strong>
                          </li>
                        )}
                        <li>
                          Estudios bíblicos:{" "}
                          <strong className="text-texto">{resumen.estudios_biblicos}</strong>
                        </li>
                        {resumen.observaciones && (
                          <li>
                            Observaciones:{" "}
                            <strong className="text-texto">{resumen.observaciones}</strong>
                          </li>
                        )}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-suave">
                      Para corregir algo, comunicate con la Secretaría.
                    </p>
                  </div>
                </div>
                <Boton variante="secundario" onClick={reiniciar} className="w-full">
                  Cargar el informe de otra persona
                </Boton>
              </div>
            ) : (
              <>
                <CamposInforme
                  borrador={borrador}
                  onChange={(nuevo) => {
                    setBorrador(nuevo);
                    if (Object.keys(errores).length) setErrores({});
                  }}
                  errores={errores}
                  persona={persona}
                />
                <Boton onClick={enviar} disabled={enviando} className="w-full py-3">
                  {enviando ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  Enviar mi actividad
                </Boton>
              </>
            )}
          </div>
        )}

        {paso === "enviado" && (
          <div className="space-y-5 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-verde/10 text-verde">
              <CheckCircle2 size={30} />
            </span>
            <div>
              <p className="text-lg font-black tracking-tight">¡Gracias por tu informe!</p>
              <p className="mt-1 text-sm text-suave">
                Se registró tu actividad de {etiqueta}.
              </p>
            </div>
            <p className="text-xs text-suave">
              Si necesitás corregir algo, comunicate con la Secretaría.
            </p>
          </div>
        )}

        <div className="mt-7 flex items-start gap-2 border-t border-linea pt-4 text-xs text-suave">
          {paso === "formulario" ? (
            <Lock size={13} className="mt-0.5 shrink-0" />
          ) : (
            <Info size={13} className="mt-0.5 shrink-0" />
          )}
          <p>
            Solo la Secretaría de la congregación ve estos informes. Si no sos de esta
            congregación, cerrá esta página.
          </p>
        </div>
      </Panel>
    </div>
  );
}
