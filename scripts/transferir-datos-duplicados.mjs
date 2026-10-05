import { createClient } from "@supabase/supabase-js";
import { cargarEnv } from "./importar-personas.mjs";

const { url, key } = cargarEnv();
const supabase = createClient(url, key);
const log = (...a) => console.log(...a);

const TRANSFERIR = {
  "Lucas Chavetta": "Chavetta, Lucas Ángel",
  "Nahiara de Chavetta": "Chavetta, Nahiara Yasmin",
};

async function main() {
  const { data: todos } = await supabase.from("participantes").select("*");
  const viejos = todos.filter((p) => TRANSFERIR[p.nombre_completo]);
  log("Duplicados:", viejos.map((p) => p.nombre_completo).join(" | "));

  for (const viejo of viejos) {
    const destino = todos.find((p) => p.nombre_completo === TRANSFERIR[viejo.nombre_completo]);
    if (!destino) {
      log("  destino no encontrado para", viejo.nombre_completo);
      continue;
    }

    const datos = {};
    if (viejo.telefono) datos.telefono = viejo.telefono;
    if (viejo.telefono_fijo) datos.telefono_fijo = viejo.telefono_fijo;
    if (viejo.direccion) datos.direccion = viejo.direccion;
    if (viejo.fecha_bautismo) datos.fecha_bautismo = viejo.fecha_bautismo;
    if (viejo.estado_civil) datos.estado_civil = viejo.estado_civil.trim();
    if (viejo.fecha_nacimiento) datos.fecha_nacimiento = viejo.fecha_nacimiento;
    if (viejo.edad !== null && viejo.edad !== undefined) datos.edad = viejo.edad;
    if (viejo.clasificacion && !destino.clasificacion) datos.clasificacion = viejo.clasificacion;

    const { error } = await supabase.from("participantes").update(datos).eq("id", destino.id);
    if (error) throw new Error(`${destino.nombre_completo}: ${error.message}`);
    log(`  ${viejo.nombre_completo} -> ${destino.nombre_completo}:`, JSON.stringify(datos));

    const { data: rolesViejos } = await supabase
      .from("participante_roles")
      .select("*")
      .eq("participante_id", viejo.id);
    const { data: rolesDestino } = await supabase
      .from("participante_roles")
      .select("*")
      .eq("participante_id", destino.id);
    for (const r of rolesViejos || []) {
      const yaEsta = (rolesDestino || []).some((d) => d.role_id === r.role_id);
      if (yaEsta) {
        log("    rol ya existente, se omite");
        continue;
      }
      const { error: e2 } = await supabase
        .from("participante_roles")
        .update({ participante_id: destino.id })
        .eq("participante_id", viejo.id)
        .eq("role_id", r.role_id);
      if (e2) throw new Error(`rol ${r.role_id}: ${e2.message}`);
      log("    rol transferido:", r.role_id);
    }
  }

  const { data: partes } = await supabase.from("reunion_partes").select("*");
  for (const parte of partes || []) {
    if (!Array.isArray(parte.participante_ids) || !parte.participante_ids.length) continue;
    const cambios = {};
    for (const viejo of viejos) {
      if (parte.participante_ids.includes(viejo.id)) {
        const destino = todos.find((p) => p.nombre_completo === TRANSFERIR[viejo.nombre_completo]);
        if (destino) cambios[viejo.id] = destino.id;
      }
    }
    if (Object.keys(cambios).length) {
      const nuevos = [...new Set(parte.participante_ids.map((x) => cambios[x] || x))];
      const { error } = await supabase
        .from("reunion_partes")
        .update({ participante_ids: nuevos })
        .eq("id", parte.id);
      if (error) throw new Error(`parte ${parte.id}: ${error.message}`);
      log("  reunion_partes actualizada:", parte.titulo || parte.seccion);
    }
  }

  const { data: conParentesco } = await supabase
    .from("participantes")
    .select("id,nombre_completo,parentesco_con")
    .not("parentesco_con", "is", null);
  for (const p of conParentesco || []) {
    const viejo = viejos.find((v) => v.id === p.parentesco_con);
    if (!viejo) continue;
    const destino = todos.find((x) => x.nombre_completo === TRANSFERIR[viejo.nombre_completo]);
    if (!destino) continue;
    const { error } = await supabase
      .from("participantes")
      .update({ parentesco_con: destino.id })
      .eq("id", p.id);
    if (error) throw new Error(`parentesco ${p.nombre_completo}: ${error.message}`);
    log("  parentesco_con reasignado en:", p.nombre_completo);
  }

  const { data: finales } = await supabase
    .from("participantes")
    .select("id,nombre_completo,genero,telefono,direccion,fecha_nacimiento,fecha_bautismo,estado_civil,clasificacion,conyuge_id,activo")
    .order("nombre_completo");
  log("\nTotal participantes:", finales.length);
  log("Con teléfono:", finales.filter((p) => p.telefono).length);
  log("Con dirección:", finales.filter((p) => p.direccion).length);
  log("Con cónyuge:", finales.filter((p) => p.conyuge_id).length);
  log("Ancianos:", finales.filter((p) => p.clasificacion === "ANCIANO").length);
  log("Precursores:", finales.filter((p) => p.clasificacion === "PRECURSOR_REGULAR").length);
  log("Siervos:", finales.filter((p) => p.clasificacion === "SIERVO_MINISTERIAL").length);
  const { data: roles } = await supabase.from("participante_roles").select("participante_id");
  log("Roles asignados:", roles.length);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
