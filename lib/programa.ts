/* ============================================================
   Forma común de una "programación" semanal (la que sale del
   PDF de la guía) y los roles que corresponden a cada tema.
   ============================================================ */

export interface PartePrograma {
  seccion: string;
  tipo: "item" | "linea" | "cancion";
  titulo: string;
  duracion: string;
  descripcion: string;
  /** número del tema ("4." → 4) o null en líneas/canciones */
  numero: number | null;
  imagen_url?: string;
  pie_foto?: string;
}

export interface ProgramaWol {
  docId: string;
  fuente: string;
  /** "5-11 de octubre" */
  titulo: string;
  /** "JEREMÍAS 40, 41" */
  cita: string;
  /** "mwb26.09-S" */
  publicacion: string;
  partes: PartePrograma[];
}

export type ProgramaGuia = ProgramaWol;
