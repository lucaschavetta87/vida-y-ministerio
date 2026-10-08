import type { ProgramaGuia } from "./programa";
import type { Reunion, ReunionParte, Rol } from "./tipos";
import { supabase } from "./supabase";
import { armarPlan } from "./sincronizar";
import type { SemanaMwb } from "./pdf";

/* ============================================================
   Crea (o actualiza) en Supabase las semanas que se leyeron del
   PDF de la guía, conservando las personas ya asignadas.
   ============================================================ */

function aPrograma(semana: SemanaMwb, origen: string): ProgramaGuia {
  return {
    docId: origen,
    fuente: origen,
    titulo: semana.titulo,
    cita: semana.cita,
    publicacion: origen,
    partes: semana.partes.map((p) => ({
      seccion: p.seccion,
      tipo: p.tipo,
      titulo: p.titulo,
      duracion: p.duracion,
      descripcion: p.descripcion,
      numero: p.numero,
      imagen_url: p.imagenDataUrl || undefined,
    })),
  };
}

export interface ResultadoImportacion {
  creadas: string[];
  actualizadas: string[];
  omitidas: string[];
  error: string;
}

/** guarda las semanas del PDF: nuevas reuniones o actualización de las que ya existen */
export async function importarSemanas(
  semanas: SemanaMwb[],
  origen: string,
  roles: Rol[],
  participantes: Set<string>,
): Promise<ResultadoImportacion> {
  const salida: ResultadoImportacion = {
    creadas: [],
    actualizadas: [],
    omitidas: [],
    error: "",
  };

  const { data: existentes, error: errBase } = await supabase
    .from("reuniones")
    .select("*");
  if (errBase) {
    salida.error = errBase.message;
    return salida;
  }
  const porFecha = new Map(
    ((existentes || []) as Reunion[]).map((r) => [r.fecha_inicio, r]),
  );

  for (const semana of semanas) {
    const programa = aPrograma(semana, origen);
    const actual = porFecha.get(semana.fechaInicio);

    try {
      if (!actual) {
        const { data: nueva, error } = await supabase
          .from("reuniones")
          .insert({
            fecha_inicio: semana.fechaInicio,
            fecha_fin: semana.fechaFin,
            titulo: semana.titulo,
            cita_biblica: semana.cita || null,
            wol_doc_id: origen,
            sincronizado_en: new Date().toISOString(),
          })
          .select("*")
          .single();
        if (error || !nueva) {
          salida.error = error?.message || "No se pudo crear la reunión.";
          return salida;
        }

        const plan = armarPlan({
          programa,
          actuales: [],
          roles,
          reunion: nueva as Reunion,
          participantes,
        });
        if (plan.aCrear.length) {
          const { error: errPartes } = await supabase
            .from("reunion_partes")
            .insert(plan.aCrear);
          if (errPartes) {
            salida.error = errPartes.message;
            return salida;
          }
        }
        salida.creadas.push(semana.titulo);
        continue;
      }

      const { data: partes, error: errPartes } = await supabase
        .from("reunion_partes")
        .select("*")
        .eq("reunion_id", actual.id)
        .order("orden");
      if (errPartes) {
        salida.error = errPartes.message;
        return salida;
      }

      const plan = armarPlan({
        programa,
        actuales: (partes || []) as ReunionParte[],
        roles,
        reunion: actual,
        participantes,
      });

      for (const c of plan.aActualizar) {
        const { error } = await supabase
          .from("reunion_partes")
          .update(c.cambios)
          .eq("id", c.id);
        if (error) {
          salida.error = error.message;
          return salida;
        }
      }
      if (plan.aCrear.length) {
        const { error } = await supabase
          .from("reunion_partes")
          .insert(plan.aCrear);
        if (error) {
          salida.error = error.message;
          return salida;
        }
      }
      if (plan.aBorrar.length) {
        const { error } = await supabase
          .from("reunion_partes")
          .delete()
          .in("id", plan.aBorrar);
        if (error) {
          salida.error = error.message;
          return salida;
        }
      }
      const { error } = await supabase
        .from("reuniones")
        .update({
          titulo: semana.titulo,
          fecha_fin: semana.fechaFin,
          cita_biblica: semana.cita || null,
          wol_doc_id: origen,
          sincronizado_en: new Date().toISOString(),
        })
        .eq("id", actual.id);
      if (error) {
        salida.error = error.message;
        return salida;
      }
      salida.actualizadas.push(semana.titulo);
    } catch (e) {
      salida.error = (e as Error).message;
      return salida;
    }
  }

  return salida;
}
