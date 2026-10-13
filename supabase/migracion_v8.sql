-- ============================================================
-- VIDA Y MINISTERIO — Migración v8
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (es idempotente: se puede volver a ejecutar sin romper nada)
--
--  1) Contacto de emergencia de cada persona.
--  2) Tipo de bautizado: otras ovejas o ungido.
--     Los que ya estaban cargados quedan como OTRAS_OVEJAS.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Contacto de emergencia
-- ------------------------------------------------------------
alter table participantes
  add column if not exists contacto_emergencia_nombre text;

alter table participantes
  add column if not exists contacto_emergencia_telefono text;

comment on column participantes.contacto_emergencia_nombre is
  'Nombre de a quién llamar en una emergencia.';

comment on column participantes.contacto_emergencia_telefono is
  'Teléfono del contacto de emergencia.';

-- ------------------------------------------------------------
-- 2) Otras ovejas / Ungido (para el S-21)
-- ------------------------------------------------------------
alter table participantes
  add column if not exists tipo_bautizado text
    default 'OTRAS_OVEJAS'
    check (tipo_bautizado in ('OTRAS_OVEJAS','UNGIDO'));

update participantes
   set tipo_bautizado = 'OTRAS_OVEJAS'
 where tipo_bautizado is null;

comment on column participantes.tipo_bautizado is
  'OTRAS_OVEJAS o UNGIDO. Se usa en la ficha S-21.';