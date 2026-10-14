-- ============================================================
--  Migración v15: S-13-S Registro de asignación de territorio
--
--  El formulario S-13 se arma solo con los datos de las salidas
--  de territorio. Esta tabla guarda las CORRECCIONES manuales
--  (fechas o conductores que se cargaron mal, o visitas que no
--  vinieron de una salida).
--
--  Si no hay nada en esta tabla, manda lo automático.
--  Es idempotente: se puede correr más de una vez.
-- ============================================================

create table if not exists public.s13_ajustes (
  territorio_numero integer not null,
  ciclo             integer not null check (ciclo between 1 and 4),
  fecha_asignado    date,
  fecha_completo    date,
  conductor_id      uuid references public.participantes (id) on delete set null,
  conductor_texto   text,
  -- true = el ciclo no existe; se borra del formulario
  borrado           boolean not null default false,
  actualizado_en    timestamptz not null default now(),
  primary key (territorio_numero, ciclo)
);

comment on table public.s13_ajustes is
  'Correcciones manuales del formulario S-13. Pisan lo automático de las salidas.';

create index if not exists s13_ajustes_territorio_idx
  on public.s13_ajustes (territorio_numero);

alter table public.s13_ajustes enable row level security;

drop policy if exists p_all on public.s13_ajustes;
create policy p_all on public.s13_ajustes for all using (true) with check (true);