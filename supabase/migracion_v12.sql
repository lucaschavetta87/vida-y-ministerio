-- ============================================================
--  Migración v12: colores por día en la planilla de salidas
--  - anio_servicio_inicio: faltaba de la v6 (año de servicio)
--  - color_fila_a / color_fila_b: se alternan día por día para
--    que la lista se lea mejor. Se editan desde el encabezado.
--  Es idempotente: se puede correr más de una vez.
-- ============================================================

-- ------------------------------------------------------------
--  Año de servicio (septiembre a agosto)
--  2025 = sep 2025 → ago 2026 · 2026 = sep 2026 → ago 2027
-- ------------------------------------------------------------
alter table public.participantes
  add column if not exists anio_servicio_inicio integer;

comment on column public.participantes.anio_servicio_inicio is
  'Año de servicio en el que arranca la ficha. Permite cargar a mano el año de servicio anterior.';

-- Los que ya estaban cargados arrancan en el año de servicio en curso.
update public.participantes
   set anio_servicio_inicio = case when extract(month from current_date) >= 9
                                   then extract(year from current_date)
                                   else extract(year from current_date) - 1
                              end
 where anio_servicio_inicio is null;

-- ------------------------------------------------------------
--  Colores alternados de la planilla
-- ------------------------------------------------------------
alter table public.salidas_ministerio_config
  add column if not exists color_fila_a text not null default '#ffffff';

alter table public.salidas_ministerio_config
  add column if not exists color_fila_b text not null default '#f0eae4';

comment on column public.salidas_ministerio_config.color_fila_a is
  'Fondo del primer día de la planilla (se alterna con color_fila_b).';
comment on column public.salidas_ministerio_config.color_fila_b is
  'Fondo del segundo día de la planilla (se alterna con color_fila_a).';