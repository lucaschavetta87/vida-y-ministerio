"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Boton,
  Campo,
  Panel,
  Select,
  Titulo,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  tieneClasificacion,
  textoClasificacion,
  type Grupo,
  type Participante,
} from "@/lib/tipos";
import { cn } from "@/lib/utils";

const GRUPOS = [1, 2, 3, 4, 5, 6];

async function traerDatos() {
  const [g, p] = await Promise.all([
    supabase.from("grupos").select("*").order("numero"),
    supabase.from("participantes").select("*").order("nombre_completo"),
  ]);
  return {
    grupos: (g.data as Grupo[]) || [],
    participantes: (p.data as Participante[]) || [],
    error: (g.error || p.error)?.message || "",
  };
}

export default function PaginaGrupos() {
  // ---------- todos los Hooks primero (mismo orden en cada render) ----------
  const [datos, setDatos] = useState<{
    grupos: Grupo[];
    participantes: Participante[];
    error: string;
  } | null>(null);
  const [guardandoGrupo, setGuardandoGrupo] = useState<Set<number>>(new Set());
  const [guardandoPersona, setGuardandoPersona] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  const [supIds, setSupIds] = useState<Record<number, string | null>>({});
  const [auxIds, setAuxIds] = useState<Record<number, string | null>>({});

  // datos derivados: si datos es null, usamos arrays vacíos para que los
  // useMemo siempre se ejecuten y mantengan el orden de hooks estable.
  const grupos = useMemo(() => (datos ? datos.grupos : []), [datos]);
  const participantes = useMemo(() => (datos ? datos.participantes : []), [
    datos,
  ]);

  const mapaGrupos = useMemo(
    () =>
      grupos.reduce<Record<number, Grupo>>((acc, g) => {
        acc[g.numero] = g;
        return acc;
      }, {}),
    [grupos],
  );

  const ancianos = useMemo(
    () =>
      participantes.filter(
        (p) => p.activo && tieneClasificacion(p, "ANCIANO"),
      ),
    [participantes],
  );
  const siervos = useMemo(
    () =>
      participantes.filter(
        (p) => p.activo && tieneClasificacion(p, "SIERVO_MINISTERIAL"),
      ),
    [participantes],
  );

  // ---------- efectos secundarios ----------
  useEffect(() => {
    traerDatos().then((d) => {
      if (d.error) setMensaje({ texto: d.error, tipo: "error" });
      else {
        setDatos(d);
        const sup: Record<number, string | null> = {};
        const aux: Record<number, string | null> = {};
        d.grupos.forEach((x) => {
          sup[x.numero] = x.superintendente_id;
          aux[x.numero] = x.auxiliar_id;
        });
        setSupIds(sup);
        setAuxIds(aux);
      }
    });
  }, []);

  // ---------- render ----------
  if (!datos) return <Panel className="p-10 text-center">Cargando grupos…</Panel>;

  const nombreDe = (id: string | null) =>
    id ? participantes.find((p) => p.id === id)?.nombre_completo || "—" : "—";

  const cambiarSup = (numero: number, id: string | null) =>
    setSupIds((prev) => ({ ...prev, [numero]: id }));

  const cambiarAux = (numero: number, id: string | null) =>
    setAuxIds((prev) => ({ ...prev, [numero]: id }));

  const guardarGrupo = async (numero: number) => {
    setGuardandoGrupo((s) => new Set([...s, numero]));
    const g = mapaGrupos[numero];
    if (!g) return;
    const { error } = await supabase
      .from("grupos")
      .update({
        superintendente_id: supIds[numero],
        auxiliar_id: auxIds[numero],
        actualizado_en: new Date().toISOString(),
      })
      .eq("numero", numero);
    setGuardandoGrupo((s) => {
      const n = new Set(s);
      n.delete(numero);
      return n;
    });
    if (error) {
      setMensaje({ texto: error.message, tipo: "error" });
    } else {
      setMensaje({ texto: `Grupo ${numero} guardado`, tipo: "ok" });
      await traerDatos().then((d) => {
        setDatos(d);
        const sup: Record<number, string | null> = {};
        const aux: Record<number, string | null> = {};
        d.grupos.forEach((x) => {
          sup[x.numero] = x.superintendente_id;
          aux[x.numero] = x.auxiliar_id;
        });
        setSupIds(sup);
        setAuxIds(aux);
      });
    }
  };

  const cambiarGrupoPersona = async (id: string, grupo: number | null) => {
    setGuardandoPersona((s) => new Set([...s, id]));
    const { error } = await supabase
      .from("participantes")
      .update({ grupo })
      .eq("id", id);
    setGuardandoPersona((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    if (error) {
      setMensaje({ texto: error.message, tipo: "error" });
    } else {
      setMensaje({ texto: "Participante actualizado", tipo: "ok" });
      await traerDatos().then((d) => setDatos(d));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Titulo>Grupos de Predicación</Titulo>
        <p className="mt-1 text-sm text-suave">
          Asigná cada persona a uno de los 6 grupos. El superintendente debe ser
          un anciano activo y el auxiliar, un siervo ministerial activo.
        </p>
      </div>

      {mensaje.texto && (
        <p className={cn(
          "rounded-xl border px-3 py-2 text-sm",
          mensaje.tipo === "ok"
            ? "border-teal/40 bg-teal/10 text-teal"
            : "border-rojo/40 bg-rojo/10 text-rojo",
        )}>
          {mensaje.texto}
        </p>
      )}

      <Panel className="p-6">
        <h2 className="mb-4 text-lg font-bold">Superintendentes y Auxiliares</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {GRUPOS.map((numero) => {
            const g = mapaGrupos[numero];
            const supNombre = nombreDe(g.superintendente_id);
            const auxNombre = nombreDe(g.auxiliar_id);
            return (
              <div
                key={`grupo-${numero}`}
                className="rounded-xl border border-linea bg-tarjeta p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-black tracking-widest text-suave uppercase">
                    Grupo {numero}
                  </span>
                  {guardandoGrupo.has(numero) && (
                    <span className="text-xs text-teal animate-pulse">
                      Guardando…
                    </span>
                  )}
                </div>
                <Campo label="Superintendente (anciano)">
                  <Select
                    value={supIds[numero] ?? ""}
                    disabled={guardandoGrupo.has(numero)}
                    onChange={(e) => cambiarSup(numero, e.target.value || null)}
                  >
                    <option value="">Elegir anciano…</option>
                    {ancianos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre_completo}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <Campo label="Auxiliar (siervo ministerial)">
                  <Select
                    value={auxIds[numero] ?? ""}
                    disabled={guardandoGrupo.has(numero)}
                    onChange={(e) => cambiarAux(numero, e.target.value || null)}
                  >
                    <option value="">Elegir siervo…</option>
                    {siervos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre_completo}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <div className="mt-2 text-xs text-suave">
                  Superintendente:{" "}
                  <span className="font-semibold">{supNombre}</span>
                  <br />
                  Auxiliar: <span className="font-semibold">{auxNombre}</span>
                </div>
                <Boton
                  onClick={() => guardarGrupo(numero)}
                  disabled={guardandoGrupo.has(numero)}
                  variante="secundario"
                >
                  Guardar grupo {numero}
                </Boton>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-4 text-lg font-bold">Asignar personas a grupos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-linea">
                <th className="pb-2 text-suave font-semibold">Persona</th>
                <th className="pb-2 text-suave font-semibold">Clasificación</th>
                <th className="pb-2 text-suave font-semibold">Grupo</th>
              </tr>
            </thead>
            <tbody>
              {participantes.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-linea/50 hover:bg-tarjeta2/50"
                >
                  <td className="py-3">
                    <span className="font-semibold">{p.nombre_completo}</span>
                  </td>
                  <td className="py-3 text-xs text-suave">
                    {(p.clasificacion || [])
                      .map(textoClasificacion)
                      .join(" · ") || "—"}
                  </td>
                  <td className="py-3">
                    <Select
                      value={String(p.grupo ?? "")}
                      disabled={guardandoPersona.has(p.id)}
                      onChange={(e) =>
                        cambiarGrupoPersona(
                          p.id,
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">Sin grupo</option>
                      {GRUPOS.map((n) => (
                        <option key={String(n)} value={String(n)}>
                          Grupo {n}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Link href="/" className="text-teal hover:underline">
        ← Volver al inicio
      </Link>
    </div>
  );
}
