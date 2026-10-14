"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  MapPin,
  Search,
  Send,
} from "lucide-react";
import { Boton, Campo, Input, Panel, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { LETRAS, fechaCorta, hoyClave } from "@/lib/territorios";
import type { ReporteTerritorioPersonal } from "@/lib/territorios";

/** Un publicador que ya tiene territorio personal asignado. */
interface Coincidencia {
  id: string;
  nombre: string;
}

interface MiTerritorio {
  /** id del participante, para guardar el reporte */
  id: string;
  nombre: string;
  territorio: { numero: number; letras: string[] } | null;
  reportes: ReporteTerritorioPersonal[];
}

/**
 * El publicador busca su nombre, ve su territorio personal y carga
 * cómo le fue: completo, o incompleto con las manzanas que faltaron.
 */
export default function FormularioTerritorioPersonal() {
  const [busqueda, setBusqueda] = useState("");
  const [coincidencias, setCoincidencias] = useState<Coincidencia[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegido, setElegido] = useState<MiTerritorio | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [error, setError] = useState("");

  const [fecha, setFecha] = useState(hoyClave());
  const [estado, setEstado] = useState<"COMPLETADO" | "INCOMPLETO">("COMPLETADO");
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- buscar el nombre ---------- */
  useEffect(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    const texto = busqueda.trim();
    if (texto.length < 3) return;
    temporizador.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/territorios-personales?buscar=${encodeURIComponent(texto)}`);
        const j = await r.json();
        setCoincidencias(j.coincidencias || []);
        if (j.error) setError(j.error);
      } catch {
        setError("No pudimos buscar. Revisá la conexión.");
      }
      setBuscando(false);
    }, 300);
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [busqueda]);

  /* ---------- elegir y verificar ---------- */
  const elegir = async (id: string, nombre: string) => {
    setBuscando(true);
    setError("");
    setListo(null);
    try {
      const r = await fetch(`/api/territorios-personales?persona=${id}`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "No pudimos verificar.");
        setCoincidencias([]);
        return;
      }
      setElegido({
        id,
        nombre: j.nombre || nombre,
        territorio: j.territorio,
        reportes: j.reportes || [],
      });
      setCoincidencias([]);
      setBusqueda("");
      setFecha(hoyClave());
      setEstado("COMPLETADO");
      setFaltantes([]);
      setObservaciones("");
      setVerificado(true);
    } catch {
      setError("No pudimos verificar. Revisá la conexión.");
    }
    setBuscando(false);
  };

  const ultimo = elegido?.reportes?.[0];

  /* ---------- enviar ---------- */
  const enviar = async () => {
    if (!elegido) return;
    setEnviando(true);
    setError("");
    try {
      const r = await fetch("/api/territorios-personales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicador_id: elegido.id,
          fecha,
          estado,
          manzanas: estado === "INCOMPLETO" ? faltantes : [],
          observaciones,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "No se pudo guardar.");
        return;
      }
      setListo(estado);
      setFaltantes([]);
      setObservaciones("");
      setFecha(hoyClave());
    } catch {
      setError("No se pudo guardar. Revisá la conexión.");
    }
    setEnviando(false);
  };

  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Territorio personal
        </h1>
        <p className="mt-2 text-sm text-suave">
          Buscá tu nombre y cargá cómo te fue en tu territorio.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      {/* ---------------- 1. buscar el nombre ---------------- */}
      <Panel className="mb-6 p-5">
        <Campo label="Tu nombre">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-suave"
            />
            <Input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                if (e.target.value.trim().length < 3) setCoincidencias([]);
              }}
              placeholder="Empezá a escribir tu nombre…"
              className="pl-9"
              disabled={verificado}
            />
          </div>
        </Campo>

        {!verificado && (
          <>
            {buscando && (
              <p className="mt-3 flex items-center gap-2 text-sm text-suave">
                <Loader2 size={14} className="animate-spin" /> Buscando…
              </p>
            )}
            {!buscando && coincidencias.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {coincidencias.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => elegir(c.id, c.nombre)}
                      className="w-full cursor-pointer rounded-xl border border-linea bg-tarjeta2 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:border-teal hover:text-teal"
                    >
                      {c.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!buscando && busqueda.trim().length >= 3 && coincidencias.length === 0 && (
              <p className="mt-3 text-sm text-suave">
                No aparece. Solo pueden cargar los que ya tienen un territorio personal
                asignado.
              </p>
            )}
          </>
        )}

        {verificado && elegido && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-teal/40 bg-teal/10 px-4 py-3">
            <CheckCircle2 size={18} className="text-teal" />
            <div className="min-w-0">
              <p className="text-sm font-bold">{elegido.nombre}</p>
              <p className="text-xs text-suave">
                {elegido.territorio
                  ? `Territorio ${elegido.territorio.numero} · manzanas ${elegido.territorio.letras.join(", ")}`
                  : "Sin territorio asignado"}
              </p>
            </div>
            <button
              onClick={() => {
                setElegido(null);
                setVerificado(false);
              }}
              className="ml-auto cursor-pointer text-xs font-semibold text-teal hover:underline"
            >
              No soy yo
            </button>
          </div>
        )}
      </Panel>

      {/* ---------------- 2. cargar el reporte ---------------- */}
      {verificado && elegido && (
        <Panel className="p-5">
          {ultimo && (
            <p className="mb-4 text-sm text-suave">
              Tu último reporte: <strong>{fechaCorta(ultimo.fecha)}</strong> ·{" "}
              {ultimo.estado === "COMPLETADO" ? (
                <span className="text-verde">completo</span>
              ) : (
                <span>
                  incompleto (faltaron {ultimo.manzanas.join(", ") || "unas manzanas"})
                </span>
              )}
            </p>
          )}

          <div className="flex flex-col gap-4">
            <Campo label="¿Qué día lo hiciste?">
              <Input
                type="date"
                value={fecha}
                max={hoyClave()}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Campo>

            <div>
              <p className="mb-2 text-xs font-bold tracking-widest text-suave uppercase">
                ¿Cómo te fue?
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => setEstado("COMPLETADO")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors",
                    estado === "COMPLETADO"
                      ? "border-verde bg-verde/10 text-verde"
                      : "border-linea text-suave hover:border-suave",
                  )}
                >
                  <CheckCircle2 size={18} /> Lo hice completo
                </button>
                <button
                  onClick={() => setEstado("INCOMPLETO")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors",
                    estado === "INCOMPLETO"
                      ? "border-gold2 bg-gold2/10 text-gold2"
                      : "border-linea text-suave hover:border-suave",
                  )}
                >
                  <CircleDashed size={18} /> Quedó incompleto
                </button>
              </div>
            </div>

            {estado === "INCOMPLETO" && (
              <div>
                <p className="mb-2 text-xs font-bold tracking-widest text-suave uppercase">
                  ¿Qué manzanas quedaron?
                </p>
                <div className="flex flex-wrap gap-2">
                  {LETRAS.map((l) => {
                    const marcada = faltantes.includes(l);
                    return (
                      <button
                        key={l}
                        onClick={() =>
                          setFaltantes((prev) =>
                            marcada ? prev.filter((x) => x !== l) : [...prev, l].sort(),
                          )
                        }
                        className={cn(
                          "h-9 w-9 cursor-pointer rounded-lg border-2 text-sm font-bold transition-colors",
                          marcada
                            ? "border-gold2 bg-gold2 text-fondo"
                            : "border-linea text-suave hover:border-suave",
                        )}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
                {faltantes.length > 0 && (
                  <p className="mt-2 text-xs text-suave">
                    Marcaste: {faltantes.join(", ")}
                  </p>
                )}
              </div>
            )}

            <Campo label="Observaciones (opcional)">
              <Textarea
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: no atendieron en dos casas; llovió y no pude terminar."
              />
            </Campo>

            {listo && (
              <p className="rounded-xl border border-verde/40 bg-verde/10 px-3 py-2 text-sm text-verde">
                ¡Listo! Cargamos tu reporte.
              </p>
            )}

            <Boton
              className="w-full justify-center py-3"
              disabled={enviando || (estado === "INCOMPLETO" && faltantes.length === 0)}
              onClick={enviar}
            >
              {enviando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Cargar reporte
            </Boton>

            <p className="flex items-center justify-center gap-1.5 text-xs text-suave">
              <MapPin size={12} /> Territorio {elegido.territorio?.numero ?? "—"}
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
