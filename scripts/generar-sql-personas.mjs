import fs from "node:fs";
import { parsearCsv, buscarConyuges } from "./importar-personas.mjs";

const personas = buscarConyuges(parsearCsv());

const esc = (s) => String(s).replace(/'/g, "''");

const updates = personas
  .map(
    (p) =>
      `    ('${esc(p.nombre_completo)}', ${p.anios_bautizado})${personas.indexOf(p) === personas.length - 1 ? "" : ","}`,
  )
  .join("\n");

const sql = `-- ============================================================================
-- MIGRACIÓN: datos de personas (JW Hub) + columnas nuevas
-- Pégalo en Supabase > SQL Editor > New query > Run
-- Es idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================

-- 1) FIX BLOQUEO DE BORRADOS
--    El trigger trg_limpiar_asign (AFTER DELETE ON participantes) usa
--    reunion_partes.lector_id, y esa columna no existe: por eso fallaba
--    cualquier delete sobre participantes.
alter table if exists reunion_partes
  add column if not exists lector_id uuid references participantes(id) on delete set null;

-- 2) COLUMNAS NUEVAS EN participantes
alter table if exists participantes
  add column if not exists anios_bautizado numeric(4,1);

alter table if exists participantes
  add column if not exists es_secretario boolean not null default false;

alter table if exists participantes
  add column if not exists miembro_comite_asamblea boolean not null default false;

-- 3) AÑOS BAUTIZADO DE LAS 62 PERSONAS
update participantes p
   set anios_bautizado = d.anios
  from (values
${updates}
  ) as d(nombre, anios)
 where p.nombre_completo = d.nombre;

-- 3.b) SECRETARIO Y MIEMBRO DEL COMITÉ DE ASAMBLEA
update participantes set es_secretario = true where nombre_completo = 'Godoy, Emanuel Alejandro Esteban';
update participantes set miembro_comite_asamblea = true where nombre_completo = 'Castro, María Daniela';

-- 4) BORRAR LOS 2 DUPLICADOS VIEJOS
--    (Lucas Chavetta y Nahiara de Chavetta ya están reemplazados por
--     "Chavetta, Lucas Ángel" y "Chavetta, Nahiara Yasmin";
--     sus roles y asignaciones mecánicas fueron reasignados antes del borrado)
delete from participantes
 where nombre_completo in ('Lucas Chavetta', 'Nahiara de Chavetta');

-- 5) LIMPIEZA DE COLUMNAS OBSOLETAS DE reunion_asignaciones_mecanicas
--    (los datos ya están en las columnas nuevas; estas quedaron vacías)
alter table if exists reunion_asignaciones_mecanicas
  drop column if exists retiro_donaciones_id;

alter table if exists reunion_asignaciones_mecanicas
  drop column if exists retiro_donaciones_fs_id;

alter table if exists reunion_asignaciones_mecanicas
  drop column if exists conferencia_presenta_id;

-- 6) RE-CREAR LA FUNCIÓN DE LIMPIEZA (queda consistente con lector_id)
create or replace function vm_limpiar_asignaciones() returns trigger as $$
begin
  update reunion_partes
     set participante_ids = array_remove(participante_ids, old.id),
         lector_id        = case when lector_id = old.id then null else lector_id end
   where old.id = any (participante_ids)
      or lector_id = old.id;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_limpiar_asign on participantes;
create trigger trg_limpiar_asign
  after delete on participantes
  for each row execute function vm_limpiar_asignaciones();
`;

const destino = new URL("./actualizar_personas_jwhub.sql", import.meta.url);
fs.writeFileSync(destino, sql, "utf8");
console.log("SQL generado:", destino.pathname);
console.log("updates:", updates.split("\n").length);
