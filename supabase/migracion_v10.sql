-- ============================================================
-- VIDA Y MINISTERIO — Migración v10
-- Sección Servicio: Territorio y Salidas al ministerio
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (después de migracion_v9.sql; es idempotente)
--
--  1) Permiso "Conductor de salidas" (solo hombres).
--  2) Los 69 territorios con sus manzanas y su posición en el mapa.
--  3) Salidas de territorio cargadas desde /territorios.
--  4) Planilla de Salidas al ministerio.
--  5) Encabezado de la portada del PDF de salidas.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PERMISO DE CONDUCTOR DE SALIDAS
-- ------------------------------------------------------------
alter table participantes
  add column if not exists conductor_salidas_aprobado boolean not null default false;

comment on column participantes.conductor_salidas_aprobado is
  'Tildado = puede cargar el formulario público /territorios y ser conductor de las salidas al ministerio.';

-- ------------------------------------------------------------
-- 2) LOS 69 TERRITORIOS
-- ------------------------------------------------------------
create table if not exists territorios (
  numero      integer primary key check (numero between 1 and 69),
  zona        text not null check (zona in ('NORTE','ESTE','CENTRO','SUR')),
  -- manzanas del territorio: 'A', 'B', 'C'...
  letras      text[] not null default '{}',
  nombre      text,
  -- posición del número sobre la imagen del mapa, en porcentaje
  mapa_x      numeric,
  mapa_y      numeric,
  activo      boolean not null default true
);

comment on table territorios is
  'Territorios de la congregación. Norte 1-18, Este 19-30, Centro 31-48, Sur 49-69.';
comment on column territorios.mapa_x is
  'Posición horizontal del número en la imagen del mapa, en porcentaje (0 a 100).';
comment on column territorios.mapa_y is
  'Posición vertical del número en la imagen del mapa, en porcentaje (0 a 100).';

-- ------------------------------------------------------------
-- 3) SALIDAS DE TERRITORIO (formulario público /territorios)
-- ------------------------------------------------------------
create table if not exists territorios_salidas (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,
  conductor_id  uuid not null references participantes(id) on delete cascade,
  notas         text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table territorios_salidas is
  'Una salida de territorio: día y conductor. El detalle está en territorios_salidas_detalle.';

create table if not exists territorios_salidas_detalle (
  id                uuid primary key default gen_random_uuid(),
  salida_id         uuid not null references territorios_salidas(id) on delete cascade,
  territorio_numero integer not null references territorios(numero) on delete cascade,
  -- manzanas recorridas en ese territorio
  letras            text[] not null default '{}',
  estado            text not null check (estado in ('COMPLETADO','PENDIENTE')),
  unique (salida_id, territorio_numero)
);

comment on column territorios_salidas_detalle.estado is
  'COMPLETADO = se hizo todo · PENDIENTE = quedó a medias y sigue disponible.';

create index if not exists idx_territorios_salidas_fecha on territorios_salidas (fecha);
create index if not exists idx_territorios_salidas_detalle on territorios_salidas_detalle (salida_id);

-- ------------------------------------------------------------
-- 4) PLANILLA DE SALIDAS AL MINISTERIO
-- ------------------------------------------------------------
create table if not exists salidas_ministerio (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null,
  -- los horarios y el punto de encuentro se escriben a mano
  hora         text,
  ubicacion    text,
  conductor_id uuid references participantes(id) on delete set null,
  -- Territories del día, ej: '21 / 20 (B,C,D,E)'
  territorios  text,
  notas        text,
  -- si es solo una llamada telefónica, no lleva territorios
  tipo         text not null default 'TERRITORIO'
                 check (tipo in ('TERRITORIO','TELEFONICA')),
  -- mañana o tarde (para ordenar la planilla)
  turno        text not null default 'MANANA'
                 check (turno in ('MANANA','TARDE')),
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on column salidas_ministerio.tipo is
  'TERRITORIO = salida de territorio · TELEFONICA = solo llamada (sin territorios).';
comment on column salidas_ministerio.turno is
  'MANANA o TARDE, para armar la planilla semanal.';

comment on table salidas_ministerio is
  'Planilla de salidas al ministerio de la semana: día, hora, punto de encuentro, conductor y territorios.';

create index if not exists idx_salidas_ministerio_fecha on salidas_ministerio (fecha);

-- ------------------------------------------------------------
-- 5) ENCABEZADO DE LA PORTADA DEL PDF DE SALIDAS
-- ------------------------------------------------------------
create table if not exists salidas_ministerio_config (
  id            boolean primary key default true,
  titulo        text not null default 'Campaña de invitación',
  subtitulo     text not null default 'Este Las Heras',
  rango         text,
  color_fondo   text not null default '#8d7a74',
  color_tabla   text not null default '#413b39',
  actualizado_en timestamptz not null default now()
);

comment on table salidas_ministerio_config is
  'Solo se usa la fila id = true: título, subtítulo, rango de fechas y colores de la portada.';

insert into salidas_ministerio_config (id) values (true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 6) RLS (acceso anónimo, igual que el resto del proyecto)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['territorios','territorios_salidas',
                           'territorios_salidas_detalle','salidas_ministerio',
                           'salidas_ministerio_config']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists p_all on %I', t);
    execute format('create policy p_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 7) LOS 69 TERRITORIOS
--    Las manzanas y la posición en el mapa se cargan con el
--    script territories_seed.sql (que viene aparte, porque se
--    arma con la transcripción del mapa).
-- ------------------------------------------------------------