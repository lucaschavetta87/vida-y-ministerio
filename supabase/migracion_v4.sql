-- ============================================================
-- VIDA Y MINISTERIO — Migración v4
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (es idempotente: se puede volver a ejecutar sin romper nada)
--
--  1) participantes.es_publicador: quién llena el informe de
--     actividad. Por defecto TODOS quedan tildados; los que no
--     informan se destildan y dejan de aparecer en Secretaría.
--  2) asistencias: reuniones cargadas por los acomodadores
--     (fecha + auditorio + zoom, el total se suma solo).
--  3) asistencias_meses: meses de asistencias cerrados.
--  4) Rol "Acomodador": quien tiene esa asignación puede entrar
--     al formulario público /asistencia.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ¿ES PUBLICADOR? (llena el informe y aparece en Secretaría)
-- ------------------------------------------------------------
alter table participantes
  add column if not exists es_publicador boolean not null default true;

comment on column participantes.es_publicador is
  'Tildado = llena el informe de actividad. Si se destilda no aparece en Secretaría ni en el formulario de informes.';

-- ------------------------------------------------------------
-- 2) ASISTENCIAS A LAS REUNIONES (una fila por carga de día)
--    total = auditorio + zoom, se suma solo (columna generada).
-- ------------------------------------------------------------
create table if not exists asistencias (
  id             uuid primary key default gen_random_uuid(),
  fecha          date not null,
  auditorio      integer not null default 0 check (auditorio >= 0),
  zoom           integer not null default 0 check (zoom >= 0),
  total          integer generated always as (auditorio + zoom) stored,
  registrado_por uuid references participantes(id) on delete set null,
  creado_en      timestamptz not null default now()
);

create index if not exists idx_asistencias_fecha on asistencias (fecha);

comment on column asistencias.total is
  'Total de asistentes del día (auditorio + zoom). Se calcula solo.';

-- ------------------------------------------------------------
-- 3) MESES DE ASISTENCIAS CERRADOS POR LA SECRETARÍA
-- ------------------------------------------------------------
create table if not exists asistencias_meses (
  mes        text primary key check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  cerrado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4) ROL ACOMODADOR (necesario para entrar en /asistencia)
--    Si ya existe un rol parecido no se toca.
-- ------------------------------------------------------------
insert into roles (nombre, slug, orden, generos_permitidos)
select 'Acomodador',
       'acomodador',
       coalesce((select max(orden) from roles), 0) + 1,
       array['HOMBRE','MUJER','NIÑO','NIÑA']
where not exists (
  select 1 from roles
   where slug = 'acomodador'
      or lower(nombre) like '%acomodador%'
);

-- ------------------------------------------------------------
-- 5) RLS (acceso anónimo, igual que el resto del proyecto)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['asistencias', 'asistencias_meses'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists p_all on %I', t);
    execute format('create policy p_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;
