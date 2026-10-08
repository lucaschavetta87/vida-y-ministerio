-- ============================================================================
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
    ('Aballay, Paula Analía', 12.6),
    ('Alonso, Emmanuel Ricardo', 25.5),
    ('Alonso, Janet Silvana', 28.8),
    ('Bazán, María Rosa', 5.5),
    ('Bustamante, Eduardo', 44.2),
    ('Bustamante, Norma Beatríz', 38),
    ('Bustamante, Elisabeth Denise', 19.3),
    ('Bustamante, Melisa', 18),
    ('Bustamante, Nicolás', 22.4),
    ('Tello, Bárbara Julieta', 20.8),
    ('Carrizo, Edgar Fernando', 14.8),
    ('Carrizo, Jessica Pamela', 28.8),
    ('Castro, Ernesto Fabián', 39.7),
    ('Castro, María Daniela', 41.7),
    ('Chavetta, Loreta Jeanet', 35.4),
    ('Chavetta, Lucas Ángel', 19.9),
    ('Chavetta, Nahiara Yasmin', 17.2),
    ('Cordiviola, Hector', 39.6),
    ('Coronel, Marcelo', 17),
    ('Cuccia, Marcos Gastón', 30.8),
    ('Cuccia, Belén Priscila', 32.7),
    ('Cuccia, Mical Magali', 7.2),
    ('Gamboa, Walter Adrián', 18.1),
    ('Lores, Debora', 18.1),
    ('García, Margarita Hilda', 48.6),
    ('Godoy, Emanuel Alejandro Esteban', 24.3),
    ('Jara, Candela Leonor', 13.8),
    ('Kesner, Ian', 2.9),
    ('kesner, Isaac', 32.5),
    ('Vicencio, Adriana', 34.5),
    ('Louet, Abigail Michel', 6.9),
    ('Louet, Eduardo', 44.2),
    ('Louet, Matías', 6.9),
    ('Marinero, Benjamín', 13),
    ('Marinero, Carina', 40.3),
    ('Marinero, Carolina Silvana', 29.4),
    ('Marinero, Dario Oscar', 28),
    ('Marval, Bryan Jose', 12.5),
    ('Marval, Manuel Jose', 23.5),
    ('De Gois Quintal de Marval, María Inocencia', 23.5),
    ('Noto Godoy, Matias Ezequiel', 14.8),
    ('Noto, Paula Daniela Emilce', 22.7),
    ('Olave, Joel German', 14.4),
    ('Ortega, Leandra Noemí', 19.4),
    ('Pavón, Rubén Darío', 26.5),
    ('Porro, Fabián', 3.4),
    ('Ramirez, Betriz Nelli', 44.5),
    ('RODRIGUEZ, DANIEL', 45.7),
    ('Rodríguez, Eduardo Adrián', 51.7),
    ('Rodríguez, Adriana Elizabeth', 47.5),
    ('Rodríguez, Marlene Janet', 31.3),
    ('Rodríguez, Virginia', 35.7),
    ('Salinas, Alfredo', 40.2),
    ('Salinas, Irma del Carmen', 46.7),
    ('Sánchez, Rodolfo Daniel', 26.8),
    ('Sosa Vergara, Franco Nicolás', 15.8),
    ('Sosa, Giuliana Pamela', 13.8),
    ('Torres Carrizo, Luciano Matías', 14.8),
    ('Torres, Sandra Noemí', 44.9),
    ('Urriche, Alejandro Sebastián', 18.9),
    ('Alberti, Candela Giuliana', 13.6),
    ('Villegas, Lucía Antonia', 40.9)
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
