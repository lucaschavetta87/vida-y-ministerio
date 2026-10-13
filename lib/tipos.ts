export type Genero = "HOMBRE" | "MUJER" | "NIÑO" | "NIÑA";

export const GENEROS: Genero[] = ["HOMBRE", "MUJER", "NIÑO", "NIÑA"];

/** Un rol en el ministerio. Una persona puede tener más de uno. */
/** Para el S-21: si está ungido o es de las otras ovejas. */
export type TipoBautizado = "OTRAS_OVEJAS" | "UNGIDO";

export type Clasificacion =
  | "ANCIANO"
  | "PRECURSOR_REGULAR"
  | "PRECURSOR_ESPECIAL"
  | "SIERVO_MINISTERIAL";

export const CLASIFICACIONES: { valor: Clasificacion; texto: string }[] = [
  { valor: "ANCIANO", texto: "Anciano" },
  { valor: "SIERVO_MINISTERIAL", texto: "Siervo Ministerial" },
  { valor: "PRECURSOR_REGULAR", texto: "Precursor Regular" },
  { valor: "PRECURSOR_ESPECIAL", texto: "Precursor Especial" },
];

export function textoClasificacion(valor: Clasificacion): string {
  return CLASIFICACIONES.find((c) => c.valor === valor)?.texto || valor.replace(/_/g, " ");
}

/** ¿La persona tiene ese rol en el ministerio? */
export function tieneClasificacion(
  persona: { clasificacion?: Clasificacion[] | null },
  valor: Clasificacion,
): boolean {
  return persona.clasificacion?.includes(valor) ?? false;
}

/** "Anciano · Precursor Regular" */
export function textoClasificaciones(persona: {
  clasificacion?: Clasificacion[] | null;
}): string {
  return (persona.clasificacion || [])
    .map(textoClasificacion)
    .join(" · ");
}

export interface Participante {
  id: string;
  nombre_completo: string;
  genero: Genero;
  edad: number | null;
  fecha_nacimiento: string | null;
  telefono: string | null;
  telefono_fijo: string | null;
  direccion: string | null;
  fecha_bautismo: string | null;
  anios_bautizado?: number | null;
  /** A quién llamar en una emergencia. */
  contacto_emergencia_nombre?: string | null;
  /** Teléfono del contacto de emergencia. */
  contacto_emergencia_telefono?: string | null;
  /** Para el S-21: si está ungido o es de las otras ovejas. */
  tipo_bautizado?: TipoBautizado | null;
  es_secretario?: boolean;
  miembro_comite_asamblea?: boolean;
  estado_civil: string | null;
  conyuge_id: string | null;
  parentesco_tipo: string | null;
  parentesco_con: string | null;
  /** Lista de roles en el ministerio (puede tener más de uno). */
  clasificacion: Clasificacion[] | null;
  retiro_donaciones_aprobado?: boolean;
  lector_atalaya_aprobado?: boolean;
  /** Tildado = llena el informe de actividad y aparece en Secretaría. */
  es_publicador?: boolean;
  activo: boolean;
  /**
   * Año de servicio en el que arranca la ficha (2025 = sept 2025 a ago 2026).
   * Permite cargar también el año de servicio anterior a mano.
   */
  anio_servicio_inicio?: number | null;
  created_at?: string;
}

export interface Rol {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  generos_permitidos: Genero[];
  activo: boolean;
}

export interface Reunion {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  titulo: string;
  cita_biblica: string | null;
  notas: string | null;
  wol_doc_id?: string | null;
  sincronizado_en?: string | null;
  dia_reunion_entresemana?: string | null;
  limpieza_grupo_entresemana?: string | null;
  presidente_fin_semana_id?: string | null;
  oracion_asignaciones?: string | null;
  conferencia_nombre?: string | null;
  conferencia_presenta_texto?: string | null;
  conductor_atalaya_id?: string | null;
  lector_id_general?: string | null;
  limpieza_grupo_fin_semana?: string | null;
  oracion_final_id?: string | null;
  oracion_final_texto?: string | null;
}

export type TipoParte = "item" | "cancion" | "linea";

export interface ReunionParte {
  id: string;
  reunion_id: string;
  orden: number;
  seccion: string;
  titulo: string;
  duracion: string | null;
  descripcion: string | null;
  role_id: string | null;
  /** Una parte puede tener varias personas (ej. Seamos mejores maestros) */
  participante_ids: string[];
  /** Lector del Estudio bíblico de la congregación (migración v3) */
  lector_id: string | null;
  tipo: TipoParte;
  imagen_url: string | null;
  pie_foto: string | null;
}

export interface Asignacion {
  participante_id: string;
  role_id: string;
}

export type EstadoGuardado = "idle" | "guardando" | "guardado" | "error";
