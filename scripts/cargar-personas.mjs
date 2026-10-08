import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parsearCsv, buscarConyuges, cargarEnv } from "./importar-personas.mjs";

const { url, key } = cargarEnv();
const supabase = createClient(url, key);

const REEMPLAZOS = {
  "Lucas Chavetta": "Chavetta, Lucas Ángel",
  "Nahiara de Chavetta": "Chavetta, Nahiara Yasmin",
};

const CAMPOS_RAM = [
  "acomodador_puerta_id",
  "acomodador_auditorio_id",
  "microfonista_1_id",
  "microfonista_2_id",
  "audio_video_id",
  "plataforma_id",
  "retiro_donaciones_1_id",
  "retiro_donaciones_2_id",
  "presidente_fin_semana_id",
  "oracion_asignaciones_id",
  "conductor_atalaya_id",
  "lector_id",
  "acomodador_puerta_fs_id",
  "acomodador_auditorio_fs_id",
  "microfonista_1_fs_id",
  "microfonista_2_fs_id",
  "audio_video_fs_id",
  "plataforma_fs_id",
  "retiro_donaciones_1_fs_id",
  "retiro_donaciones_2_fs_id",
  "oracion_final_id",
];

const log = (...a) => console.log(...a);

async function main() {
  const personas = buscarConyuges(parsearCsv());
  log("Registros a cargar:", personas.length);

  const { data: existentes, error: errExist } = await supabase
    .from("participantes")
    .select("id,nombre_completo");
  if (errExist) throw errExist;
  log("Existentes en BD:", existentes.map((e) => e.nombre_completo).join(" | ") || "(ninguno)");

  const aBorrar = existentes.filter((e) => REEMPLAZOS[e.nombre_completo]);
  log("A reemplazar (duplicados):", aBorrar.map((e) => e.nombre_completo).join(" | ") || "(ninguno)");

  const creadoPorNombre = new Map();
  let creados = 0;
  let actualizados = 0;

  for (const p of personas) {
    const payload = {
      nombre_completo: p.nombre_completo,
      genero: p.genero,
      edad: p.edad,
      fecha_nacimiento: p.fecha_nacimiento,
      clasificacion: p.clasificacion,
      activo: p.activo,
    };
    const previo = existentes.find((e) => e.nombre_completo === p.nombre_completo);
    const { data, error } = await supabase
      .from("participantes")
      .insert(payload)
      .select("id,nombre_completo")
      .single();
    if (error) throw new Error(`${p.nombre_completo}: ${error.message}`);
    creadoPorNombre.set(p.nombre_completo, data.id);
    creados++;
    log(`  [${creados}/${personas.length}] ${data.nombre_completo}`);
  }
  log("Insertados:", creados, "| actualizados:", actualizados);

  const { data: rolesViejos } = await supabase.from("participante_roles").select("*");
  let rolesReasignados = 0;
  for (const viejo of aBorrar) {
    const nuevoNombre = REEMPLAZOS[viejo.nombre_completo];
    const nuevoId = creadoPorNombre.get(nuevoNombre);
    if (!nuevoId) continue;
    const suyos = (rolesViejos || []).filter((r) => r.participante_id === viejo.id);
    for (const r of suyos) {
      const { error } = await supabase
        .from("participante_roles")
        .update({ participante_id: nuevoId })
        .eq("id", r.id);
      if (error) throw new Error(`rol ${r.id}: ${error.message}`);
      rolesReasignados++;
    }
  }
  log("Roles reasignados a los registros del CSV:", rolesReasignados);

  const { data: rams } = await supabase.from("reunion_asignaciones_mecanicas").select("*");
  let referenciasReasignadas = 0;
  for (const ram of rams || []) {
    const cambios = {};
    for (const campo of CAMPOS_RAM) {
      const valor = ram[campo];
      if (!valor) continue;
      const viejo = aBorrar.find((v) => v.id === valor);
      if (!viejo) continue;
      cambios[campo] = creadoPorNombre.get(REEMPLAZOS[viejo.nombre_completo]) || null;
    }
    if (Object.keys(cambios).length) {
      const { error } = await supabase
        .from("reunion_asignaciones_mecanicas")
        .update(cambios)
        .eq("id", ram.id);
      if (error) throw new Error(`ram ${ram.id}: ${error.message}`);
      referenciasReasignadas += Object.keys(cambios).length;
      log("  RAM actualizado:", JSON.stringify(cambios));
    }
  }
  log("Referencias de asignaciones mecánicas reasignadas:", referenciasReasignadas);

  let conyuges = 0;
  for (const p of personas) {
    if (!p.conyuge_clave) continue;
    const id = creadoPorNombre.get(p.nombre_completo);
    const idConyuge = creadoPorNombre.get(p.conyuge_clave.nombre_completo);
    if (!id || !idConyuge) continue;
    const { error } = await supabase.from("participantes").update({ conyuge_id: idConyuge }).eq("id", id);
    if (error) throw new Error(`conyuge ${p.nombre_completo}: ${error.message}`);
    conyuges++;
  }
  log("Conyuges vinculados:", conyuges);

  for (const viejo of aBorrar) {
    await supabase
      .from("participantes")
      .update({ conyuge_id: null, parentesco_con: null })
      .eq("id", viejo.id);
    const { error } = await supabase.from("participantes").delete().eq("id", viejo.id);
    if (error) throw new Error(`borrar ${viejo.nombre_completo}: ${error.message}`);
    log("  Borrado duplicado:", viejo.nombre_completo);
  }

  const { data: finales } = await supabase
    .from("participantes")
    .select("id,nombre_completo,genero,edad,fecha_nacimiento,clasificacion,conyuge_id,activo")
    .order("nombre_completo");
  log("\nTotal final en BD:", finales.length);
  const sinGenero = finales.filter((f) => !f.genero);
  log("Sin género:", sinGenero.length);
  const conCony = finales.filter((f) => f.conyuge_id).length;
  log("Con cónyuge vinculado:", conCony);

  fs.writeFileSync(
    new URL("./personas-cargadas.json", import.meta.url),
    JSON.stringify(finales, null, 2),
  );
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
