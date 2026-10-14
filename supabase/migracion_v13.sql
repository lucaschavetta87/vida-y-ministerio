-- ============================================================
--  Migración v13: Territories Personales
--  - territorios.observaciones: nota por territorio (la que se ve
--    al tocar el punto en el mapa)
--  - territorios_personales: qué territorio tiene asignado cada
--    publicador (uno por persona)
--  - territorios_personales_reportes: lo que carga cada publicador
--    desde /territoriopersonal (fecha, completo o no, manzanas
--    que quedaron, observaciones)
--  Es idempotente: se puede correr más de una vez.
-- ============================================================

-- ------------------------------------------------------------
--  1) Observaciones por territorio
-- ------------------------------------------------------------
alter table public.territorios
  add column if not exists observaciones text;

comment on column public.territorios.observaciones is
  'Observaciones del territorio: lo que hay que saber antes de salir.';

-- ------------------------------------------------------------
--  2) Territorio personal asignado a cada publicador
-- ------------------------------------------------------------
create table if not exists public.territorios_personales (
  id                uuid primary key default gen_random_uuid(),
  publicador_id     uuid not null references public.participantes (id) on delete cascade,
  territorio_numero integer not null,
  asignado_en       timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint territorios_personales_unico unique (publicador_id)
);

comment on table public.territorios_personales is
  'Territorio personal de cada publicador. Solo puede cargar quien tenga uno asignado.';

create index if not exists territorios_personales_publicador_idx
  on public.territorios_personales (publicador_id);

-- ------------------------------------------------------------
--  3) Reportes de los territorios personales
-- ------------------------------------------------------------
create table if not exists public.territorios_personales_reportes (
  id                uuid primary key default gen_random_uuid(),
  publicador_id     uuid not null references public.participantes (id) on delete cascade,
  territorio_numero integer not null,
  fecha             date not null,
  estado            text not null default 'COMPLETADO'
                      check (estado in ('COMPLETADO','INCOMPLETO')),
  -- si quedó incompleto, qué manzanas faltaban
  manzanas          text[] not null default '{}',
  observaciones     text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

create index if not exists tp_reportes_publicador_idx
  on public.territorios_personales_reportes (publicador_id, fecha desc);

comment on column public.territorios_personales_reportes.estado is
  'COMPLETIDO o INCOMPLETO (si faltaron manzanas).';
comment on column public.territorios_personales_reportes.manzanas is
  'Manzanas que quedaron sin hacer cuando el reporte es INCOMPLETO.';