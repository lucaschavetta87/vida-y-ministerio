"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Participante } from "@/lib/tipos";
import {
  antiguedadTexto,
  fechaCorta,
  type Historial,
} from "@/lib/historial";

/**
 * Selector con buscador: al escribir filtra por nombre/teléfono/dirección
 * entre todas las personas guardadas (restringidas a `candidatos`).
 */
export default function SelectorPersona({
  valor = null,
  todos,
  candidatos,
  onChange,
  placeholder = "Buscar persona…",
  vacioTexto = "Nadie tiene esa tarea aprobada en su ficha",
  /** temas de la reunión donde ya participa */
  temasDe,
  /** otras tareas de esta pantalla que ya tiene */
  tareasDe,
  /** última vez que participó en algún tema */
  historial,
  hoy,
}: {
  valor?: string | null;
  /** Todas las personas (para mostrar la elegida aunque ya no esté apta) */
  todos: Participante[];
  /** Personas que se pueden elegir */
  candidatos: Participante[];
  onChange: (id: string | null) => void;
  placeholder?: string;
  vacioTexto?: string;
  temasDe?: (id: string) => string[];
  tareasDe?: (id: string) => string[];
  historial?: Historial;
  hoy?: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);

  const elegido = valor ? todos.find((c) => c.id === valor) || null : null;

  const sugerencias = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const base = q
      ? candidatos.filter(
          (p) =>
            p.nombre_completo.toLowerCase().includes(q) ||
            (p.telefono || "").includes(q) ||
            (p.direccion || "").toLowerCase().includes(q),
        )
      : candidatos;
    return base.slice(0, 10);
  }, [candidatos, texto]);

  if (elegido) {
    const temas = temasDe?.(elegido.id) || [];
    const otras = tareasDe?.(elegido.id) || [];
    const ultima = historial?.get(elegido.id);
    return (
      <div className="rounded-xl border border-verde/40 bg-verde/10 px-3 py-2">
        <div className="flex items-start gap-2">
          <Check size={15} className="mt-0.5 shrink-0 text-verde" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {elegido.nombre_completo}
              {elegido.clasificacion && (
                <span className="ml-2 text-[10px] font-bold text-teal">
                  {elegido.clasificacion.replace(/_/g, " ")}
                </span>
              )}
            </span>
            <span className="block text-[11px] text-suave">
              {ultima ? (
                <>
                  Última vez: {fechaCorta(ultima.fecha)}
                  {hoy ? ` · ${antiguedadTexto(ultima.fecha, hoy)}` : ""}
                  {" · "}
                  {ultima.titulo}
                </>
              ) : (
                "Nunca participó en un tema"
              )}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Quitar asignación"
            className="cursor-pointer rounded-md p-1 text-suave transition-colors hover:bg-rojo/15 hover:text-rojo"
          >
            <X size={14} />
          </button>
        </div>
        {otras.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-gold/10 px-2 py-1 text-[11px] text-gold">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              Ya tiene otra asignación: {otras.join(", ")}
            </span>
          </p>
        )}
        {temas.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-gold/10 px-2 py-1 text-[11px] text-gold">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              Ya tiene tema en la reunión: {temas.join(", ")}
            </span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-tarjeta2 px-3 py-2 transition-colors",
          abierto ? "border-teal" : "border-linea",
        )}
      >
        <Search size={15} className="shrink-0 text-suave" />
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
          placeholder={candidatos.length === 0 ? vacioTexto : placeholder}
          disabled={candidatos.length === 0}
          className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-suave/70 disabled:cursor-not-allowed"
        />
      </div>

      {abierto && candidatos.length > 0 && (
        <ul className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-linea bg-tarjeta2 py-1 shadow-xl">
          {sugerencias.length === 0 ? (
            <li className="px-3 py-2 text-sm text-suave">
              Sin resultados para “{texto}”
            </li>
          ) : (
            sugerencias.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(p.id);
                    setTexto("");
                    setAbierto(false);
                  }}
                  className="flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-teal/10"
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.nombre_completo}
                    </span>
                    {p.clasificacion && (
                      <span className="shrink-0 rounded-full border border-teal/40 px-2 py-0.5 text-[10px] font-bold text-teal">
                        {p.clasificacion.replace(/_/g, " ")}
                      </span>
                    )}
                  </span>
                  <span className="w-full text-[10px] text-suave">
                    {historial?.get(p.id) ? (
                      <>
                        Últ. {fechaCorta(historial.get(p.id)!.fecha)}
                        {hoy
                          ? ` · ${antiguedadTexto(historial.get(p.id)!.fecha, hoy)}`
                          : ""}{" "}
                        · {historial.get(p.id)!.titulo}
                      </>
                    ) : (
                      "Nunca participó en un tema"
                    )}
                  </span>
                  {(tareasDe?.(p.id) || []).length > 0 && (
                    <span className="flex w-full items-center gap-1 text-[10px] text-gold">
                      <AlertTriangle size={11} className="shrink-0" />
                      Ya tiene otra asignación: {tareasDe?.(p.id).join(", ")}
                    </span>
                  )}
                  {(temasDe?.(p.id) || []).length > 0 && (
                    <span className="flex w-full items-center gap-1 text-[10px] text-gold">
                      <AlertTriangle size={11} className="shrink-0" />
                      Ya tiene tema en la reunión:{" "}
                      {temasDe?.(p.id).join(", ")}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
