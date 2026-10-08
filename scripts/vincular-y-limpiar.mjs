import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parsearCsv, buscarConyuges, cargarEnv, clave } from "./importar-personas.mjs";

const { url, key } = cargarEnv();
const supabase = createClient(url, key);

const REEMPLAZOS = {
  "lucas chavetta": "Chavetta, Lucas Ángel",
  "nahiara chavetta": "Chavetta, Nahiara Yasmin",
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
  const { data: existentes, error } = await supabase
    .from("participantes")
    .select("id,nombre_completo");
  if (error) throw error;
  log("participantes en BD:", existentes.length);

  const porClave = new Map();
  for (const p of existentes) {
    const k = clave(p.nombre_completo);
    if (!porClave.has(k)) porClave.set(k, p);
  }

  const aBorrar = existentes.filter((e) => REEMPLAZOS[clave(e.nombre_completo)]);
  log("Duplicados a borrar:", aBorrar.map((e) => e.nombre_completo).join(" | ") || "(ninguno)");

  const { data: rolesViejos } = await supabase.from("participante_roles").select("*");
  let rolesReasignados = 0;
  for (const viejo of aBorrar) {
    const nuevoNombre = REEMPLAZOS[clave(viejo.nombre_completo)];
    const nuevo = porClave.get(clave(nuevoNombre));
    if (!nuevo) continue;
    const suyos = (rolesViejos || []).filter((r) => r.participante_id === viejo.id);
    for (const r of suyos) {
      const existe = (rolesViejos || []).some(
        (o) => o.participante_id === nuevo.id && o.role_id === r.role_id,
      );
      if (existe) {
        log(`  rol ya existente en ${nuevo.nombre_completo}, se omite`);
        continue;
      }
      const { error: e2 } = await supabase
        .from("participante_roles")
        .update({ participante_id: nuevo.id })
        .eq("participante_id", viejo.id)
        .eq("role_id", r.role_id);
      if (e2) throw new Error(`rol ${r.role_id}: ${e2.message}`);
      rolesReasignados++;
    }
    log(`  ${viejo.nombre_completo} -> ${nuevo.nombre_completo}: ${suyos.length} roles`);
  }
  log("Roles reasignados:", rolesReasignados);

  const { data: rams } = await supabase.from("reunion_asignaciones_mecanicas").select("*");
  let referencias = 0;
  for (const ram of rams || []) {
    const cambios = {};
    for (const campo of CAMPOS_RAM) {
      const valor = ram[campo];
      if (!valor) continue;
      const viejo = aBorrar.find((v) => v.id === valor);
      if (!viejo) continue;
      const nuevo = porClave.get(clave(REEMPLAZOS[clave(viejo.nombre_completo)]));
      cambios[campo] = nuevo ? nuevo.id : null;
    }
    if (Object.keys(cambios).length) {
      const { error: e3 } = await supabase
        .from("reunion_asignaciones_mecanicas")
        .update(cambios)
        .eq("id", ram.id);
      if (e3) throw new Error(`ram: ${e3.message}`);
      referencias += Object.keys(cambios).length;
      log("  RAM actualizado:", JSON.stringify(cambios));
    }
  }
  log("Referencias de asignaciones reasignadas:", referencias);

  const personas = buscarConyuges(parsearCsv());
  let conyuges = 0;
  for (const p of personas) {
    if (!p.conyuge_nombre) continue;
    const propio = porClave.get(clave(p.nombre_completo));
    const cony = porClave.get(clave(p.conyuge_nombre));
    if (!propio || !cony) {
      log("  sin match:", p.nombre_completo, "->", p.conyuge_nombre);
      continue;
    }
    const { error: e4 } = await supabase
      .from("participantes")
      .update({ conyuge_id: cony.id })
      .eq("id", propio.id);
    if (e4) throw new Error(`conyuge ${p.nombre_completo}: ${e4.message}`);
    conyuges++;
  }
  log("Conyuges vinculados:", conyuges);

  for (const viejo of aBorrar) {
    await supabase.from("participantes").update({ conyuge_id: null, parentesco_con: null }).eq("id", viejo.id);
    const { error: e5 } = await supabase.from("participantes").delete().eq("id", viejo.id);
    if (e5) throw new Error(`borrar ${viejo.nombre_completo}: ${e5.message}`);
    log("  Borrado duplicado:", viejo.nombre_completo);
  }

  const { data: finales } = await supabase
    .from("participantes")
    .select("id,nombre_completo,genero,edad,fecha_nacimiento,clasificacion,conyuge_id,activo")
    .order("nombre_completo");
  log("\nTotal final:", finales.length);
  log("Con cónyuge:", finales.filter((f) => f.conyuge_id).length);
  const { data: rolesFinales } = await supabase.from("participante_roles").select("participante_id");
  log("Roles totales:", rolesFinales.length);

  fs.writeFileSync(
    new URL("./personas-cargadas.json", import.meta.url),
    JSON.stringify(finales, null, 2),
  );
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
