-- ============================================================
-- VIDA Y MINISTERIO — Migración v7
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (es idempotente: se puede volver a ejecutar sin romper nada)
--
--  1) Una persona puede tener VARIAS clasificaciones a la vez
--     (Anciano + Precursor Regular, por ejemplo). La columna
--     'clasificacion' pasa de texto a lista, y lo que ya está
--     cargado se convierte solo: 'ANCIANO' -> ['ANCIANO'].
--
-- Antes de correrla, si querés un respaldo:
--   create table participantes_backup_v7 as select * from participantes;
-- ============================================================

-- ------------------------------------------------------------
-- 0) La vista no admite que se le cambie el tipo de una columna,
--    así que se saca y se vuelve a crear al final.
-- ------------------------------------------------------------
drop view if exists vw_informes;

-- ------------------------------------------------------------
-- 1) Sacar el check viejo (es de columna de texto)
-- ------------------------------------------------------------
alter table participantes
  drop constraint if exists participantes_clasificacion_check;

-- ------------------------------------------------------------
-- 2) Convertir la columna a lista de texto
-- ------------------------------------------------------------
alter table participantes
  alter column clasificacion type text[]
  using case
    when clasificacion is null then null
    else array[clasificacion::text]
  end;

comment on column participantes.clasificacion is
  'Lista de roles en el ministerio: ANCIANO, SIERVO_MINISTERIAL, PRECURSOR_REGULAR, PRECURSOR_ESPECIAL. Una persona puede tener más de uno.';

-- ------------------------------------------------------------
-- 3) Check nuevo: solo valores válidos dentro de la lista
-- ------------------------------------------------------------
alter table participantes
  drop constraint if exists participantes_clasificacion_check;

alter table participantes
  add constraint participantes_clasificacion_check
  check (
    clasificacion is null
    or clasificacion <@ array[
      'ANCIANO',
      'PRECURSOR_REGULAR',
      'PRECURSOR_ESPECIAL',
      'SIERVO_MINISTERIAL'
    ]::text[]
  );

-- ------------------------------------------------------------
-- 4) Volver a crear la vista de informes
-- ------------------------------------------------------------
create or replace view vw_informes as
select i.id,
       i.mes,
       i.tipo,
       i.horas,
       i.participo,
       i.estudios_biblicos,
       i.observaciones,
       i.origen,
       i.enviado_en,
       i.actualizado_en,
       p.id   as participante_id,
       p.nombre_completo,
       p.clasificacion
  from informes i
  join participantes p on p.id = i.participante_id;