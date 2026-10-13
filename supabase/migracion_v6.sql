-- ============================================================
-- VIDA Y MINISTERIO — Migración v6
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (es idempotente: se puede volver a ejecutar sin romper nada)
--
--  1) Los aprobados para pasar los MICROFONOS pueden ser hombres o NIÑOS.
--  2) Año de servicio en el que arranca cada ficha.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Micrófonos: hombres y niños (no niñas)
-- ------------------------------------------------------------
update roles
   set generos_permitidos = array['HOMBRE','NIÑO']::text[]
 where slug in ('microfonista_1', 'microfonista_2', 'microfonos');

comment on column roles.generos_permitidos is
  'Géneros que pueden cumplir el rol. Los microfones habilitan también a los niños.';

-- ------------------------------------------------------------
-- 2) Año de servicio en el que arranca la ficha
--    2025 = septiembre de 2025 a agosto de 2026
--    NULL = el año de servicio en curso (comportamiento anterior)
-- ------------------------------------------------------------
alter table participantes
  add column if not exists anio_servicio_inicio integer;

comment on column participantes.anio_servicio_inicio is
  'Año de servicio en el que arranca la ficha. Permite cargar a mano el año de servicio anterior.';

-- Los que ya estaban cargados arrancan en el año de servicio en curso.
update participantes
   set anio_servicio_inicio = case when extract(month from current_date) >= 9
                                  then extract(year from current_date)
                                  else extract(year from current_date) - 1
                             end
 where anio_servicio_inicio is null;