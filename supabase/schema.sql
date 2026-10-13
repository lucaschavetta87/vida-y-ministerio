-- ============================================================
-- VIDA Y MINISTERIO — Esquema de base de datos (Supabase)
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) PARTICIPANTES (congregación)
-- ------------------------------------------------------------
create table if not exists participantes (
  id               uuid primary key default gen_random_uuid(),
  nombre_completo  text not null,
  genero           text not null check (genero in ('HOMBRE','MUJER','NIÑO','NIÑA')),
  telefono         text,
  direccion        text,
  edad             integer,
  fecha_nacimiento  date,
  fecha_bautismo   date,
  estado_civil     text,
  conyuge_id       uuid,
  telefono_fijo    text,
  parentesco_tipo  text,                 -- ej: 'HIJO/A', 'NIETO/A', 'SOBRINO/A'
  parentesco_con   uuid,                 -- FK al mayor ya cargado (se resuelve abajo)
  -- desde la migración v7 es una LISTA: una persona puede tener más de un rol
  -- en el ministerio (text[] con valores de ANCIANO, SIERVO_MINISTERIAL,
  -- PRECURSOR_REGULAR, PRECURSOR_ESPECIAL)
  clasificacion    text[],
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_participantes_nombre on participantes (nombre_completo);
create index if not exists idx_participantes_activo  on participantes (activo);

-- ------------------------------------------------------------
-- 2) ROLES / ASIGNACIONES (catálogo editable desde la app)
-- ------------------------------------------------------------
create table if not exists roles (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null unique,
  slug               text not null unique,
  orden              integer not null default 0,
  generos_permitidos text[] not null default array['HOMBRE','MUJER','NIÑO','NIÑA'],
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  check (generos_permitidos <@ array['HOMBRE','MUJER','NIÑO','NIÑA']::text[])
);

-- ------------------------------------------------------------
-- 3) ASIGNACIONES QUE ACEPTÓ CADA PERSONA (la pestaña de la ficha)
-- ------------------------------------------------------------
create table if not exists participante_roles (
  participante_id uuid not null references participantes(id) on delete cascade,
  role_id         uuid not null references roles(id)         on delete cascade,
  primary key (participante_id, role_id)
);

create index if not exists idx_pr_role on participante_roles (role_id);

-- ------------------------------------------------------------
-- 4) REUNIONES (semanas)
-- ------------------------------------------------------------
create table if not exists reuniones (
  id             uuid primary key default gen_random_uuid(),
  fecha_inicio   date not null unique,
  fecha_fin      date not null,
  titulo         text not null,            -- "28 de septiembre a 4 de octubre"
  cita_biblica   text,                      -- "Jeremías 38, 39"
  notas          text,
  wol_doc_id     text,                      -- id del documento copiado de wol.jw.org
  sincronizado_en timestamptz,              -- última sincronización con wol.jw.org
  dia_reunion_entresemana text,
  limpieza_grupo_entresemana text,
  presidente_fin_semana_id uuid references participantes(id) on delete set null,
  oracion_asignaciones text,
  conferencia_nombre text,
  conferencia_presenta_id uuid references participantes(id) on delete set null,
  conductor_atalaya_id uuid references participantes(id) on delete set null,
  lector_id_general uuid references participantes(id) on delete set null,
  limpieza_grupo_fin_semana text,
  oracion_final_id uuid references participantes(id) on delete set null,
  oracion_final_texto text,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5) PARTES DE LA REUNIÓN (una fila por parte, con su asignado)
-- ------------------------------------------------------------
create table if not exists reunion_partes (
  id              uuid primary key default gen_random_uuid(),
  reunion_id      uuid not null references reuniones(id) on delete cascade,
  orden           integer not null,
  seccion         text not null,          -- APERTURA | TESOROS DE LA BIBLIA | SEAMOS MEJORES MAESTROS | NUESTRA VIDA CRISTIANA | CIERRE
  titulo          text not null,
  duracion        text,                    -- "10 mins."
  descripcion     text,                    -- cita bíblica / tema de la semana
  role_id         uuid references roles(id) on delete set null,
  participante_ids uuid[] not null default '{}',  -- puede haber 2 o más (Seamos)
  lector_id       uuid,                     -- Lector del Estudio bíblico (migración v3)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_rp_reunion on reunion_partes (reunion_id);
create index if not exists idx_rp_asignados on reunion_partes using gin (participante_ids);

-- Si se borra un participante, lo sacamos de las listas de partes
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

-- ------------------------------------------------------------
-- 6) FK de parentesco (recién ahora que existen ambas tablas)
-- ------------------------------------------------------------
alter table participantes
  drop constraint if exists participantes_parentesco_con_fkey;
alter table participantes
  add constraint participantes_parentesco_con_fkey
  foreign key (parentesco_con) references participantes(id)
  on delete restrict;   -- no se puede borrar un mayor que tenga menores a cargo

alter table participantes
  drop constraint if exists participantes_conyuge_id_fkey;
alter table participantes
  add constraint participantes_conyuge_id_fkey
  foreign key (conyuge_id) references participantes(id)
  on delete set null;

-- ------------------------------------------------------------
-- 7) REGLAS: el niño/niña debe tener un MAYOR ya cargado
-- ------------------------------------------------------------
create or replace function vm_validar_parentesco() returns trigger as $$
begin
  if new.parentesco_con = new.id then
    raise exception 'Un participante no puede ser su propio parentesco';
  end if;

  if new.genero in ('NIÑO','NIÑA') then
    if new.parentesco_con is null then
      raise exception 'Un niño/niña debe tener un mayor cargado (parentesco)';
    end if;
    if new.parentesco_tipo is null then
      raise exception 'Indicá el tipo de parentesco (ej: HIJO/A)';
    end if;
  end if;

  if new.parentesco_con is not null then
    if not exists (
      select 1 from participantes p
      where p.id = new.parentesco_con and p.genero in ('HOMBRE','MUJER')
    ) then
      raise exception 'El parentesco debe apuntar a un mayor ya cargado (HOMBRE o MUJER)';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validar_parentesco on participantes;
create trigger trg_validar_parentesco
  before insert or update of genero, parentesco_con, parentesco_tipo
  on participantes
  for each row execute function vm_validar_parentesco();

-- ------------------------------------------------------------
-- 8) updated_at automático
-- ------------------------------------------------------------
create or replace function vm_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_participantes on participantes;
create trigger trg_touch_participantes before update on participantes
  for each row execute function vm_touch();

drop trigger if exists trg_touch_partes on reunion_partes;
create trigger trg_touch_partes before update on reunion_partes
  for each row execute function vm_touch();

-- ------------------------------------------------------------
-- 9) RLS: acceso anónimo completo (la app no usa auth de Supabase,
--    el "login" es la contraseña única de la web)
-- ------------------------------------------------------------
alter table participantes      enable row level security;
alter table roles              enable row level security;
alter table participante_roles enable row level security;
alter table reuniones          enable row level security;
alter table reunion_partes     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['participantes','roles','participante_roles','reuniones','reunion_partes']
  loop
    execute format('drop policy if exists p_all on %I', t);
    execute format(
      'create policy p_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 10) ROLES POR DEFECTO (los que pediste; se editan/agregan desde la app)
--     Los niños NIÑO/NIÑA quedan SIN roles: se tildan después uno a uno.
-- ------------------------------------------------------------
insert into roles (slug, nombre, orden, generos_permitidos) values
  ('presidente',   'Presidente',                              1,  array['HOMBRE']),
  ('oracion',      'Oración',                                 2,  array['HOMBRE']),
  ('tesoros',      'Tesoros de la Biblia',                    3,  array['HOMBRE','MUJER','NIÑO','NIÑA']),
  ('perlas',       'Perlas espirituales',                     4,  array['HOMBRE','MUJER','NIÑO','NIÑA']),
  ('lectura',      'Lectura de la Biblia',                    5,  array['HOMBRE','MUJER','NIÑO','NIÑA']),
  ('conversacion', 'Primera conversación',                    6,  array['HOMBRE','MUJER','NIÑO','NIÑA']),
  ('revisitas',    'Haga revisitas',                          7,  array['HOMBRE','MUJER','NIÑO','NIÑA']),
  ('que-diria',    '¿Qué diría?',                             8,  array['HOMBRE','MUJER','NIÑO','NIÑA']),
  ('discursos',    'Discursos o temas de nuestra vida cristiana', 9, array['HOMBRE','MUJER','NIÑO','NIÑA']),
  ('estudio',      'Estudio bíblico de la congregación',      10, array['HOMBRE','MUJER']),
  ('acomodador',    'Acomodador',                              11, array['HOMBRE']),
  ('microfonos',    'Micrófonos',                              12, array['HOMBRE']),
  ('audio_video',   'Audio y Video',                           13, array['HOMBRE']),
  ('plataforma',    'Plataforma',                              14, array['HOMBRE']),
  ('limpieza',      'Limpieza',                                15, array['HOMBRE']),
  ('oracion_fin',   'Oración Final',                           16, array['HOMBRE'])
on conflict (slug) do nothing;
