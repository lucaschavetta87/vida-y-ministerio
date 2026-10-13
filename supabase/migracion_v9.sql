-- ============================================================
-- VIDA Y MINISTERIO — Migración v9
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (es idempotente: se puede volver a ejecutar sin romper nada)
--
--  1) Resumen mensual de asistencia cargado A MANO.
--     Para los meses que no se cargaron reunión por reunión en la
--     app (los del año de servicio anterior y los primeros meses
--     del actual) se puede cargar el mes completo: número de
--     reuniones y asistencia total. El promedio SIEMPRE se calcula
--     solo (total ÷ reuniones) y da lo mismo que el S-88.
-- ============================================================

-- ------------------------------------------------------------
-- 1) TABLA DE RESÚMENES MENSUALES
-- ------------------------------------------------------------
create table if not exists asistencias_resumen (
  mes             text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  tipo            text not null check (tipo in ('entre-semana','fin-de-semana')),
  reuniones       integer not null default 0 check (reuniones >= 0),
  total           integer not null default 0 check (total >= 0),
  actualizado_en  timestamptz not null default now(),
  primary key (mes, tipo)
);

comment on table asistencias_resumen is
  'Asistencia del mes cargada a mano (nº de reuniones + asistencia total). El promedio se calcula siempre como total/reuniones.';
comment on column asistencias_resumen.tipo is
  'entre-semana o fin-de-semana.';

create index if not exists idx_asistencias_resumen_mes on asistencias_resumen (mes);

-- ------------------------------------------------------------
-- 2) RLS (acceso anónimo, igual que el resto del proyecto)
-- ------------------------------------------------------------
alter table asistencias_resumen enable row level security;
drop policy if exists p_all on asistencias_resumen;
create policy p_all on asistencias_resumen
  for all using (true) with check (true);