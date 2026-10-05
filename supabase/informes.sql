-- ============================================================
-- VIDA Y MINISTERIO — Informes mensuales de actividad
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (se puede volver a ejecutar: no rompe nada)
-- ============================================================

-- ------------------------------------------------------------
-- 1) INFORMES (uno por persona y por mes)
-- ------------------------------------------------------------
create table if not exists informes (
  id                uuid primary key default gen_random_uuid(),
  participante_id   uuid not null references participantes(id) on delete cascade,
  mes               text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- mes informado: 'YYYY-MM'
  tipo              text not null check (tipo in ('PRECURSOR','AUXILIAR','PUBLICADOR')),
  horas             numeric,                             -- precursor: las que sea | auxiliar: 15 o 30
  participo         boolean,                             -- publicador: true/false
  estudios_biblicos integer not null default 0 check (estudios_biblicos >= 0),
  observaciones     text,
  origen            text not null default 'formulario' check (origen in ('formulario','secretaria')),
  enviado_en        timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (participante_id, mes)                            -- nadie informa dos veces el mismo mes
);

create index if not exists idx_informes_mes on informes(mes);

-- ------------------------------------------------------------
-- 2) Si la tabla ya existía sin alguna columna
-- ------------------------------------------------------------
alter table informes
  add column if not exists observaciones text,
  add column if not exists origen text not null default 'formulario',
  add column if not exists actualizado_en timestamptz not null default now();

-- ------------------------------------------------------------
-- 3) Vista de apoyo: informes con el nombre y la clase del participante
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

-- ------------------------------------------------------------
-- 4) RLS (acceso anónimo, igual que el resto del proyecto)
-- ------------------------------------------------------------
alter table informes enable row level security;
do $$
declare t text;
begin
  t := 'informes';
  execute format('drop policy if exists p_all on %I', t);
  execute format('create policy p_all on %I for all using (true) with check (true)', t);
end $$;
