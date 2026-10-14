"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Boton, Campo, Etiqueta, Input, Panel, Select, Titulo } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { PERMISOS, hashearClave } from "@/lib/auth";
import type { Participante } from "@/lib/tipos";

interface Usuario {
  id: string;
  nombre: string;
  participante_id: string | null;
  clave_hash: string;
  activo: boolean;
  ultimo_acceso: string | null;
  creado_en: string;
}

export default function PaginaUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permisos, setPermisos] = useState<Record<string, string[]>>({});
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Usuario | "nuevo" | null>(null);

  const cargar = useCallback(
    () =>
      Promise.all([
        supabase.from("app_usuarios").select("*").order("nombre"),
        supabase.from("app_usuarios_permisos").select("usuario_id, permiso"),
        supabase.from("participantes").select("*").order("nombre_completo"),
      ]).then(([u, p, pa]) => {
        setUsuarios((u.data as Usuario[]) || []);
        const mapa: Record<string, string[]> = {};
        ((p.data as { usuario_id: string; permiso: string }[]) || []).forEach((x) => {
          mapa[x.usuario_id] = [...(mapa[x.usuario_id] || []), x.permiso];
        });
        setPermisos(mapa);
        setParticipantes((pa.data as Participante[]) || []);
        setCargando(false);
      }),
    [],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombreDe = useCallback(
    (id: string | null) =>
      id ? participantes.find((p) => p.id === id)?.nombre_completo || "—" : "—",
    [participantes],
  );

  const borrar = async (u: Usuario) => {
    if (!window.confirm(`¿Borrar el usuario "${u.nombre}"?`)) return;
    await supabase.from("app_usuarios").delete().eq("id", u.id);
    await cargar();
  };

  const alternarActivo = async (u: Usuario) => {
    await supabase.from("app_usuarios").update({ activo: !u.activo }).eq("id", u.id);
    await cargar();
  };

  if (cargando)
    return (
      <Panel className="flex items-center justify-center gap-2 p-10 text-sm text-suave">
        <Loader2 size={16} className="animate-spin" /> Cargando usuarios…
      </Panel>
    );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Titulo>Usuarios</Titulo>
          <p className="mt-1 text-sm text-suave">
            Delegá el acceso a una persona de la congregación y decidí a qué partes
            puede entrar.
          </p>
        </div>
        <Boton onClick={() => setEditando("nuevo")}>
          <Plus size={16} /> Nuevo usuario
        </Boton>
      </div>

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-linea text-left text-[11px] tracking-widest text-suave uppercase">
              <th className="px-5 py-2.5 font-bold">Usuario</th>
              <th className="px-5 py-2.5 font-bold">Delegado a</th>
              <th className="px-5 py-2.5 font-bold">Puede entrar a</th>
              <th className="px-5 py-2.5 font-bold">Último acceso</th>
              <th className="px-5 py-2.5 text-right font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-suave">
                  Todavía no creaste ningún usuario. Tocá “Nuevo usuario”.
                </td>
              </tr>
            )}
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-linea/60">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <UserRound size={15} className="text-suave" />
                    <span className="font-bold">{u.nombre}</span>
                    {!u.activo && <Etiqueta tono="rojo">inactivo</Etiqueta>}
                  </div>
                </td>
                <td className="px-5 py-3">{nombreDe(u.participante_id)}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(permisos[u.id] || []).map((p) => (
                      <Etiqueta key={p} tono="teal">
                        {PERMISOS.find((x) => x.codigo === p)?.texto || p}
                      </Etiqueta>
                    ))}
                    {!(permisos[u.id] || []).length && (
                      <span className="text-xs text-suave">sin permisos</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-suave">
                  {u.ultimo_acceso
                    ? new Date(u.ultimo_acceso).toLocaleDateString("es-AR")
                    : "nunca"}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => alternarActivo(u)}
                      className="cursor-pointer rounded-lg border border-linea px-2.5 py-1.5 text-xs font-semibold text-suave transition-colors hover:border-suave hover:text-teal"
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      onClick={() => setEditando(u)}
                      className="cursor-pointer rounded-lg border border-linea p-2 text-suave transition-colors hover:border-suave hover:text-teal"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => borrar(u)}
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
      </Panel>

      {editando && (
        <FormularioUsuario
          usuario={editando === "nuevo" ? null : editando}
          participantes={participantes}
          nombresUsados={usuarios
            .filter((u) => u.id !== (editando === "nuevo" ? null : editando.id))
            .map((u) => u.nombre.toLowerCase())}
          permisosIniciales={
            editando === "nuevo" ? [] : permisos[editando.id] || []
          }
          onCerrar={() => setEditando(null)}
          onGuardar={() => {
            setEditando(null);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Alta / edición de un usuario                                        */
/* ------------------------------------------------------------------ */
function FormularioUsuario({
  usuario,
  participantes,
  permisosIniciales,
  nombresUsados,
  onCerrar,
  onGuardar,
}: {
  usuario: Usuario | null;
  participantes: Participante[];
  permisosIniciales: string[];
  /** nombres que ya existen, para avisar antes de guardar */
  nombresUsados: string[];
  onCerrar: () => void;
  onGuardar: () => void;
}) {
  const [nombre, setNombre] = useState(usuario?.nombre || "");
  const [participanteId, setParticipanteId] = useState(usuario?.participante_id || "");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>(permisosIniciales);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const alternar = (codigo: string) =>
    setElegidos((prev) =>
      prev.includes(codigo) ? prev.filter((p) => p !== codigo) : [...prev, codigo],
    );

  /** "F. Castro" → "fcastro" */
  const limpiar = (texto: string) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const nombreLimpio = limpiar(nombre);
  const yaExiste = !!nombreLimpio && nombresUsados.includes(nombreLimpio);

  const guardar = async () => {
    setError("");
    if (!nombreLimpio) return setError("Poné un nombre de acceso.");
    if (yaExiste) return setError("Ese nombre de acceso ya está en uso.");
    if (!usuario && clave.length < 4)
      return setError("La contraseña tiene que tener al menos 4 caracteres.");
    if (usuario && clave && clave.length < 4)
      return setError("La contraseña tiene que tener al menos 4 caracteres.");

    setGuardando(true);
    try {
      let id = usuario?.id;
      const claveHash = clave ? await hashearClave(clave) : usuario?.clave_hash;

      if (!id) {
        const { data, error: errorInsert } = await supabase
          .from("app_usuarios")
          .insert({
            nombre: nombreLimpio,
            participante_id: participanteId || null,
            clave_hash: claveHash,
            activo: true,
          })
          .select("id")
          .single();
        if (errorInsert) throw errorInsert;
        id = data.id;
      } else {
        const { error: errorUpdate } = await supabase
          .from("app_usuarios")
          .update({
            nombre: nombreLimpio,
            participante_id: participanteId || null,
            ...(clave ? { clave_hash: claveHash } : {}),
            actualizado_en: new Date().toISOString(),
          })
          .eq("id", id);
        if (errorUpdate) throw errorUpdate;
      }

      await supabase.from("app_usuarios_permisos").delete().eq("usuario_id", id);
      if (elegidos.length) {
        const { error: errorPermisos } = await supabase
          .from("app_usuarios_permisos")
          .insert(elegidos.map((permiso) => ({ usuario_id: id, permiso })));
        if (errorPermisos) throw errorPermisos;
      }

      onGuardar();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "";
      const yaDuplicado =
        mensaje.includes("23505") ||
        mensaje.includes("duplicate key") ||
        mensaje.includes("usuarios_nombre_unico") ||
        yaExiste;
      setError(
        yaDuplicado
          ? "Ese nombre de acceso ya está en uso. Editalo o borrá el existente."
          : mensaje || "No se pudo guardar.",
      );
    }
    setGuardando(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl border border-linea bg-tarjeta shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-linea px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <KeyRound size={18} />
            {usuario ? `Editar ${usuario.nombre}` : "Nuevo usuario"}
          </h2>
          <button onClick={onCerrar} className="cursor-pointer text-suave hover:text-texto">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <Campo label="Nombre de acceso" hint="Con esto entra al sistema">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej: fcastro"
              autoComplete="off"
            />
          </Campo>

          <Campo
            label="Delegado a"
            hint="La persona de la congregación que representa"
          >
            <Select
              value={participanteId}
              onChange={(e) => setParticipanteId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {participantes
                .filter((p) => p.activo !== false)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_completo}
                  </option>
                ))}
            </Select>
          </Campo>

          <Campo
            label={usuario ? "Nueva contraseña" : "Contraseña"}
            hint={usuario ? "Si la dejás vacía no cambia" : "Mínimo 4 caracteres"}
          >
            <div className="flex gap-2">
              <Input
                type={verClave ? "text" : "password"}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder={usuario ? "Dejala vacía para no cambiarla" : "••••"}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setVerClave(!verClave)}
                className="cursor-pointer rounded-xl border border-linea px-3 text-suave transition-colors hover:border-suave hover:text-teal"
                title={verClave ? "Ocultar" : "Ver"}
              >
                {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Campo>

          <div>
            <p className="mb-2 text-xs font-bold tracking-widest text-suave uppercase">
              ¿A qué partes puede entrar?
            </p>
            <div className="flex flex-col gap-2">
              {PERMISOS.map((p) => {
                const marcado = elegidos.includes(p.codigo);
                return (
                  <label
                    key={p.codigo}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                      marcado
                        ? "border-teal bg-teal/10 text-teal"
                        : "border-linea text-suave hover:border-suave",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(p.codigo)}
                      className="accent-teal"
                    />
                    {p.texto}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-suave">
              Si no marcás ninguna, entra pero no ve ninguna sección.
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} disabled={guardando || yaExiste}>
              {guardando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Guardar usuario
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}
