"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Save, X } from "lucide-react";
import { Boton, Campo, Etiqueta, Input, Select } from "@/components/ui";
import ActividadDelAnio from "@/components/ActividadDelAnio";
import {
  aniosCumplidos,
  aniosYMeses,
  textoAniosBautizado,
  textoEdad,
} from "@/lib/fechas";
import {
  CLASIFICACIONES,
  GENEROS,
  type Clasificacion,
  type Genero,
  type TipoBautizado,
  type Participante,
  type Rol,
} from "@/lib/tipos";
import { REQUISITOS_POR_ROL } from "@/lib/roles";
import {
  anioServicioActual,
  etiquetaAnioServicio,
} from "@/lib/anio-servicio";
import { cn } from "@/lib/utils";

type Pestaña = "ficha" | "asignaciones" | "asignaciones_mecanicas" | "actividad";

const TIPOS_PARENTESCO = [
  "HIJO/A",
  "NIETO/A",
  "SOBRINO/A",
  "OTRO",
];

const nuevaFicha = (): Omit<Participante, "id"> & { id?: string } => ({
  nombre_completo: "",
  genero: "HOMBRE",
  edad: null,
  fecha_nacimiento: "",
  telefono: "",
  telefono_fijo: "",
  direccion: "",
  fecha_bautismo: "",
  anios_bautizado: null,
  contacto_emergencia_nombre: "",
  contacto_emergencia_telefono: "",
  tipo_bautizado: "OTRAS_OVEJAS" as TipoBautizado,
  es_secretario: false,
  miembro_comite_asamblea: false,
  estado_civil: "",
  conyuge_id: null,
  parentesco_tipo: "",
  parentesco_con: null,
  clasificacion: null,
  retiro_donaciones_aprobado: false,
  lector_atalaya_aprobado: false,
  es_publicador: true,
  activo: true,
  anio_servicio_inicio: anioServicioActual(),
});

/** Años de servicio que se pueden elegir al crear una ficha. */
const ANIOS_FICHA = Array.from({ length: 6 }, (_, i) => anioServicioActual() - i);

export default function ParticipanteForm({
  participante,
  roles,
  mayores,
  asignacionesIniciales,
  onGuardar,
  onCerrar,
  onCambiarActivo,
  pestanaInicial = "ficha",
}: {
  participante: Participante | null;
  roles: Rol[];
  mayores: Participante[];
  asignacionesIniciales: string[];
  /** Con qué pestaña se abre (por defecto la ficha). */
  pestanaInicial?: Pestaña;
  onGuardar: (
    datos: Omit<Participante, "id"> & { id?: string },
    roleIds: string[],
  ) => Promise<string | null>;
  onCerrar: () => void;
  onCambiarActivo?: (activo: boolean) => Promise<void>;
}) {
  const [ficha, setFicha] = useState(() => ({
    ...nuevaFicha(),
    ...(participante || {}),
  }));
  const [roleIds, setRoleIds] = useState<string[]>(asignacionesIniciales);
  const [pestaña, setPestaña] = useState<Pestaña>(pestanaInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const esNino = ficha.genero === "NIÑO" || ficha.genero === "NIÑA";
  const fechaNacimiento = aniosCumplidos(ficha.fecha_nacimiento) !== null;
  const fechaBautismo = aniosYMeses(ficha.fecha_bautismo) !== null;

  const rolesVisibles = useMemo(
    () => roles.filter((r) => r.activo),
    [roles],
  );

  /**
   * Marca o desmarca un rol en el ministerio. Precursor Regular y Precursor
   * Especial son excluyentes entre sí; los demás se pueden combinar.
   */
  const alternarClasificacion = (valor: Clasificacion) => {
    setFicha((f) => {
      const actuales = f.clasificacion || [];
      if (actuales.includes(valor)) {
        return { ...f, clasificacion: actuales.filter((c) => c !== valor) };
      }
      const contraparte =
        valor === "PRECURSOR_REGULAR"
          ? "PRECURSOR_ESPECIAL"
          : valor === "PRECURSOR_ESPECIAL"
            ? "PRECURSOR_REGULAR"
            : null;
      return {
        ...f,
        clasificacion: [
          ...actuales.filter((c) => c !== contraparte),
          valor,
        ],
      };
    });
  };

  const set = <K extends keyof typeof ficha>(k: K, v: (typeof ficha)[K]) =>
    setFicha((f) => ({ ...f, [k]: v }));

  const alternarRol = (id: string) =>
    setRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );

  const guardar = async () => {
    if (!ficha.nombre_completo.trim()) {
      setError("Ingresá el nombre completo.");
      setPestaña("ficha");
      return;
    }
    if (esNino && (!ficha.parentesco_con || !ficha.parentesco_tipo?.trim())) {
      setError(
        "Un niño o niña necesita el tipo de parentesco y el mayor a cargo ya cargado.",
      );
      setPestaña("ficha");
      return;
    }
    setGuardando(true);
    setError("");
    const err = await onGuardar(ficha, roleIds);
    setGuardando(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-8">
      <div className="w-full max-w-2xl rounded-2xl border border-linea bg-tarjeta shadow-2xl">
        <div className="flex items-center justify-between border-b border-linea px-6 py-4">
          <div>
            <h2 className="text-lg font-black">
              {participante ? "Editar participante" : "Nuevo participante"}
            </h2>
            <p className="text-xs text-suave">
              {participante
                ? participante.nombre_completo
                : "Completá la ficha y sus asignaciones"}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="cursor-pointer rounded-lg p-2 text-suave transition-colors hover:bg-tarjeta2 hover:text-texto"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-linea px-6 pt-3">
                  {(["ficha", "asignaciones", "asignaciones_mecanicas", "actividad"] as Pestaña[]).map((p) => (
            <button
              key={p}
              onClick={() => setPestaña(p)}
              className={cn(
                "cursor-pointer border-b-2 px-4 py-2.5 text-sm font-bold transition-colors",
                pestaña === p
                  ? "border-teal text-teal"
                  : "border-transparent text-suave hover:text-texto",
              )}
            >
              {p === "asignaciones_mecanicas"
                ? "Asignaciones Mecánicas"
                : p === "actividad"
                  ? "Actividad del Año"
                  : p}
              {p === "asignaciones" && (
                <span className="ml-2 rounded-full bg-tarjeta2 px-2 py-0.5 text-[11px]">
                  {roleIds.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          {pestaña === "ficha" ? (
            <div className="flex flex-col gap-4">
              <Campo label="Nombre completo *">
                <Input
                  value={ficha.nombre_completo}
                  onChange={(e) => set("nombre_completo", e.target.value)}
                  placeholder="Ej: Juan Carlos Pérez"
                  autoFocus
                />
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  label="Año de servicio"
                  hint="De qué año de servicio arranca la ficha (septiembre a agosto). Elegí el anterior para cargarlo también a mano."
                >
                  <Select
                    value={ficha.anio_servicio_inicio ?? anioServicioActual()}
                    onChange={(e) =>
                      set(
                        "anio_servicio_inicio",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  >
                    {ANIOS_FICHA.map((a) => (
                      <option key={a} value={a}>
                        {etiquetaAnioServicio(a)}
                        {a === anioServicioActual() ? " (en curso)" : ""}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <Campo label="Género *">
                  <Select
                    value={ficha.genero}
                    onChange={(e) => set("genero", e.target.value as Genero)}
                  >
                    {GENEROS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <Campo label="Edad" hint="La calcula el sistema con la fecha de nacimiento">
                  <div className="rounded-xl border border-linea bg-tarjeta2 px-3.5 py-2.5 text-sm">
                    {fechaNacimiento ? (
                      <span className="font-semibold">
                        {textoEdad(aniosCumplidos(ficha.fecha_nacimiento))}
                      </span>
                    ) : ficha.edad !== null && ficha.edad !== undefined ? (
                      <span className="text-suave">
                        {textoEdad(ficha.edad)}{" "}
                        <span className="text-[11px]">(cargada a mano: no hay fecha de nacimiento)</span>
                      </span>
                    ) : (
                      <span className="text-suave">Cargá la fecha de nacimiento</span>
                    )}
                  </div>
                </Campo>
              </div>

              <div className="rounded-xl border border-linea bg-tarjeta2 p-4">
                <span className="mb-1.5 block text-[11px] font-bold tracking-widest text-suave uppercase">
                  En el ministerio
                </span>
                <div className="flex flex-wrap gap-4">
                  {(["OTRAS_OVEJAS", "UNGIDO"] as TipoBautizado[]).map((valor) => {
                    const marcado = (ficha.tipo_bautizado || "OTRAS_OVEJAS") === valor;
                    return (
                      <label
                        key={valor}
                        className="flex cursor-pointer items-center gap-2"
                        title="Se usa en la ficha S-21"
                      >
                        <input
                          type="radio"
                          name="tipo_bautizado"
                          checked={marcado}
                          onChange={() => set("tipo_bautizado", valor)}
                        />
                        <span className="text-sm font-semibold">
                          {valor === "UNGIDO" ? "Ungido" : "Otras ovejas"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Fecha de nacimiento">
                  <Input
                    type="date"
                    value={ficha.fecha_nacimiento || ""}
                    onChange={(e) => set("fecha_nacimiento", e.target.value)}
                  />
                </Campo>
                <Campo label="Fecha de bautismo">
                  <Input
                    type="date"
                    value={ficha.fecha_bautismo || ""}
                    onChange={(e) => set("fecha_bautismo", e.target.value)}
                  />
                </Campo>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Años bautizado" hint="Los calcula el sistema con la fecha de bautismo">
                  <div className="rounded-xl border border-linea bg-tarjeta2 px-3.5 py-2.5 text-sm">
                    {fechaBautismo ? (
                      <span className="font-semibold">
                        {textoAniosBautizado(aniosYMeses(ficha.fecha_bautismo))}
                      </span>
                    ) : ficha.anios_bautizado !== null && ficha.anios_bautizado !== undefined ? (
                      <span className="text-suave">
                        {textoAniosBautizado(ficha.anios_bautizado)}{" "}
                        <span className="text-[11px]">
                          (cargados a mano: no hay fecha de bautismo)
                        </span>
                      </span>
                    ) : (
                      <span className="text-suave">Cargá la fecha de bautismo</span>
                    )}
                  </div>
                </Campo>
                <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  label="Contacto de emergencia · Nombre"
                  hint="A quién llamar si hay una urgencia"
                >
                  <Input
                    value={ficha.contacto_emergencia_nombre || ""}
                    onChange={(e) => set("contacto_emergencia_nombre", e.target.value)}
                    placeholder="Ej: María Pérez"
                  />
                </Campo>
                <Campo label="Contacto de emergencia · Contacto">
                  <Input
                    type="tel"
                    value={ficha.contacto_emergencia_telefono || ""}
                    onChange={(e) => set("contacto_emergencia_telefono", e.target.value)}
                    placeholder="Ej: 261 555 5555"
                  />
                </Campo>
              </div>

              <div className="flex flex-col justify-end gap-2 pb-1">
                  <label
                    className="flex cursor-pointer items-center gap-3"
                    title="Si está tildado, llena el informe de actividad y aparece en Secretaría."
                  >
                    <input
                      type="checkbox"
                      checked={ficha.es_publicador !== false}
                      onChange={(e) => set("es_publicador", e.target.checked)}
                      className="h-4 w-4 accent-teal"
                    />
                    <span className="text-sm font-semibold">Es publicador</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!ficha.es_secretario}
                      onChange={(e) => set("es_secretario", e.target.checked)}
                      className="h-4 w-4 accent-teal"
                    />
                    <span className="text-sm">Es Secretario</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!ficha.miembro_comite_asamblea}
                      onChange={(e) => set("miembro_comite_asamblea", e.target.checked)}
                      className="h-4 w-4 accent-teal"
                    />
                    <span className="text-sm">Miembro del Comité de Asamblea</span>
                  </label>
                </div>
              </div>

              <Campo label="Estado Civil">
                <Input
                  value={ficha.estado_civil || ""}
                  onChange={(e) => set("estado_civil", e.target.value)}
                  placeholder="Soltero/Casado/Viudo/etc."
                />
              </Campo>

              <Campo label="Grupo de predicación">
                <Select
                  value={String(ficha.grupo || "")}
                  onChange={(e) =>
                    set("grupo", e.target.value === "" ? null : Number(e.target.value))
                  }
                >
                  <option value="">Sin grupo</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Grupo {n}
                    </option>
                  ))}
                </Select>
              </Campo>

              <Campo label="Si está casado - Cónyuge">
                <Select
                  value={ficha.conyuge_id || ""}
                  onChange={(e) => set("conyuge_id", e.target.value || null)}
                >
                  <option value="">Elegir cónyuge...</option>
                  {mayores
                    .filter(
                      (m) =>
                        m.id !== ficha.id &&
                        ((m.genero === "HOMBRE" && ficha.genero === "MUJER") ||
                          (m.genero === "MUJER" && ficha.genero === "HOMBRE")),
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre_completo} ({m.genero})
                      </option>
                    ))}
                </Select>
              </Campo>

              <div>
                <span className="mb-1.5 block text-[11px] font-bold tracking-widest text-suave uppercase">
                  Privilegios de Servicio
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CLASIFICACIONES.map(({ valor, texto }) => {
                    const marcado = (ficha.clasificacion || []).includes(valor);
                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => alternarClasificacion(valor)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                          marcado
                            ? "border-teal bg-teal/10"
                            : "border-linea bg-tarjeta2 hover:border-suave",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                            marcado
                              ? "border-teal bg-teal text-fondo"
                              : "border-suave bg-transparent",
                          )}
                        >
                          {marcado && <Check size={13} strokeWidth={3} />}
                        </span>
                        <span className="text-sm font-semibold">{texto}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="mt-1.5 block text-xs text-suave">
                  Se puede marcar más de uno. Precursor Regular y Precursor Especial son
                  excluyentes entre sí.
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Número de Celular">
                  <Input
                    value={ficha.telefono || ""}
                    onChange={(e) => set("telefono", e.target.value)}
                    placeholder="Ej: 261 555 5555"
                  />
                </Campo>
                <Campo label="Número Fijo">
                  <Input
                    value={ficha.telefono_fijo || ""}
                    onChange={(e) => set("telefono_fijo", e.target.value)}
                    placeholder="Ej: 261 456 7890"
                  />
                </Campo>
              </div>

              <Campo label="Dirección">
                <Input
                  value={ficha.direccion || ""}
                  onChange={(e) => set("direccion", e.target.value)}
                  placeholder="Calle, número, barrio"
                />
              </Campo>

              {esNino && (
                <div className="rounded-xl border border-teal/30 bg-teal/5 p-4">
                  <p className="mb-3 text-xs font-bold tracking-widest text-teal uppercase">
                    Parentesco con un mayor cargado
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo label="Tipo de parentesco *">
                      <Input
                        list="tipos-parentesco"
                        value={ficha.parentesco_tipo || ""}
                        onChange={(e) => set("parentesco_tipo", e.target.value)}
                        placeholder="Ej: HIJO/A"
                      />
                      <datalist id="tipos-parentesco">
                        {TIPOS_PARENTESCO.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </Campo>
                    <Campo
                      label="Mayor a cargo *"
                      hint="Solo hombres o mujeres ya cargados"
                    >
                      <Select
                        value={ficha.parentesco_con || ""}
                        onChange={(e) =>
                          set("parentesco_con", e.target.value || null)
                        }
                      >
                        <option value="">Elegir mayor…</option>
                        {mayores.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre_completo} ({m.genero})
                          </option>
                        ))}
                      </Select>
                    </Campo>
                  </div>
                </div>
              )}
            </div>
          ) : pestaña === "asignaciones_mecanicas" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-suave mb-3">
                Asignaciones mecánicas (Acomodadores, Micrófonos, Audio y Video, Plataforma, Retiro de Donaciones, Oración Final)
              </p>
              {ficha.genero === "HOMBRE" && (
                <>
                  <label className="mb-2 flex items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!ficha.retiro_donaciones_aprobado}
                      onChange={(e) => set("retiro_donaciones_aprobado", e.target.checked)}
                    />
                    <span className="text-sm font-semibold">Aprobado para Retiro de Donaciones</span>
                  </label>
                  <label className="mb-2 flex items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!ficha.lector_atalaya_aprobado}
                      onChange={(e) => set("lector_atalaya_aprobado", e.target.checked)}
                    />
                    <span className="text-sm font-semibold">Aprobado para Lector de Atalaya</span>
                  </label>
                  <label
                    className="mb-2 flex items-center gap-2 rounded-xl border border-linea bg-tarjeta2 px-4 py-3"
                    title="Puede cargar /territorios y ser conductor de las salidas al ministerio"
                  >
                    <input
                      type="checkbox"
                      checked={!!ficha.conductor_salidas_aprobado}
                      onChange={(e) => set("conductor_salidas_aprobado", e.target.checked)}
                    />
                    <span className="text-sm font-semibold">Aprobado como Conductor de salidas</span>
                  </label>
                </>
              )}
              {rolesVisibles
                .filter((r) =>
                  [
                    "acomodador_puerta",
                    "acomodador_auditorio",
                    "microfonista_1",
                    "microfonista_2",
                    "audio_video",
                    "plataforma",
                    "retiro_donaciones",
                    "oracion_fin",
                  ].includes(r.slug),
                )
                .map((rol) => {
                  const habilitado = rol.generos_permitidos.includes(ficha.genero);
                  const marcado = roleIds.includes(rol.id);
                  return (
                    <button
                      key={rol.id}
                      type="button"
                      disabled={!habilitado}
                      onClick={() => alternarRol(rol.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                        !habilitado && "cursor-not-allowed opacity-40",
                        marcado
                          ? "border-teal bg-teal/10"
                          : "border-linea bg-tarjeta2 hover:border-suave",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                          marcado
                            ? "border-teal bg-teal text-fondo"
                            : "border-suave bg-transparent",
                        )}
                      >
                        {marcado && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{rol.nombre}</span>
                      </span>
                    </button>
                  );
                })}
            </div>
          ) : pestaña === "actividad" ? (
            participante ? (
              <ActividadDelAnio
                participante={participante}
                onCambiarActivo={onCambiarActivo || (async () => undefined)}
              />
            ) : (
              <p className="text-sm text-suave">
                Guardá el participante primero: la actividad se muestra en su ficha.
              </p>
            )
          ) : (
            <div className="flex flex-col gap-2">
              {rolesVisibles.length === 0 && (
                <p className="rounded-xl border border-linea bg-tarjeta2 p-4 text-sm text-suave">
                  Todavía no hay roles cargados. Volvé a la lista de
                  participantes y agregalos desde “Gestionar roles”.
                </p>
              )}
              {rolesVisibles.map((rol) => {
                const habilitado = rol.generos_permitidos.includes(ficha.genero);
                const marcado = roleIds.includes(rol.id);
                return (
                  <button
                    key={rol.id}
                    type="button"
                    disabled={!habilitado}
                    onClick={() => alternarRol(rol.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      !habilitado && "cursor-not-allowed opacity-40",
                      marcado
                        ? "border-teal bg-teal/10"
                        : "border-linea bg-tarjeta2 hover:border-suave",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        marcado
                          ? "border-teal bg-teal text-fondo"
                          : "border-suave bg-transparent",
                      )}
                    >
                      {marcado && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {rol.nombre}
                      </span>
                      {!habilitado && (
                        <span className="block text-[11px] text-suave">
                          No disponible para {ficha.genero}
                        </span>
                      )}
                      {habilitado && REQUISITOS_POR_ROL[rol.slug] && (
                        <span className="block text-[11px] text-suave">
                          {REQUISITOS_POR_ROL[rol.slug]}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="mx-6 mb-3 rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-linea px-6 py-4">
          <Etiqueta tono={ficha.activo ? "verde" : "rojo"}>
            {ficha.activo ? "ACTIVO" : "INACTIVO"}
          </Etiqueta>
          <div className="flex gap-2">
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Guardar
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}
