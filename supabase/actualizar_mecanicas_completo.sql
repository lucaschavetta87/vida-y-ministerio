-- ACTUALIZACIONES COMPLETAS PARA ASIGNACIONES MECANICAS
-- Ejecutar en Supabase SQL Editor (idempotente)

-- 1. PARTICIPANTES
alter table participantes add column if not exists retiro_donaciones_aprobado boolean default false;

-- 2. ROLES NUEVOS
insert into roles (slug, nombre, orden, generos_permitidos) values
  ('acomodador_puerta',    'Acomodador de Puerta',                    11, array['HOMBRE']),
  ('acomodador_auditorio', 'Acomodador de Auditorio',                 12, array['HOMBRE']),
  ('microfonista_1',       'Micrófonista 1',                          13, array['HOMBRE']),
  ('microfonista_2',       'Micrófonista 2',                          14, array['HOMBRE']),
  ('retiro_donaciones',    'Retiro de Donaciones',                    15, array['HOMBRE']),
  ('limpieza',             'Limpieza',                                16, array['HOMBRE']),
  ('oracion_fin',          'Oración Final',                           17, array['HOMBRE']),
  ('audio_video',          'Audio y Video',                           18, array['HOMBRE']),
  ('plataforma',           'Plataforma',                              19, array['HOMBRE'])
on conflict (slug) do nothing;

-- 3. TABLA RAM
create table if not exists reunion_asignaciones_mecanicas (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references reuniones(id) on delete cascade unique,
  -- ENTRE SEMANA
  dia_entresemana text,
  acomodador_puerta_id uuid references participantes(id) on delete set null,
  acomodador_auditorio_id uuid references participantes(id) on delete set null,
  microfonista_1_id uuid references participantes(id) on delete set null,
  microfonista_2_id uuid references participantes(id) on delete set null,
  audio_video_id uuid references participantes(id) on delete set null,
  plataforma_id uuid references participantes(id) on delete set null,
  retiro_donaciones_id uuid references participantes(id) on delete set null,
  limpieza_grupo_entresemana text,
  -- FIN DE SEMANA
  presidente_fin_semana_id uuid references participantes(id) on delete set null,
  oracion_asignaciones_id uuid references participantes(id) on delete set null,
  oracion_asignaciones_texto text,
  conferencia_nombre text,
  conferencia_presenta_id uuid references participantes(id) on delete set null,
  conductor_atalaya_id uuid references participantes(id) on delete set null,
  lector_id uuid references participantes(id) on delete set null,
  acomodador_puerta_fs_id uuid references participantes(id) on delete set null,
  acomodador_auditorio_fs_id uuid references participantes(id) on delete set null,
  microfonista_1_fs_id uuid references participantes(id) on delete set null,
  microfonista_2_fs_id uuid references participantes(id) on delete set null,
  audio_video_fs_id uuid references participantes(id) on delete set null,
  plataforma_fs_id uuid references participantes(id) on delete set null,
  retiro_donaciones_fs_id uuid references participantes(id) on delete set null,
  limpieza_grupo_fin_semana text,
  oracion_final_id uuid references participantes(id) on delete set null,
  oracion_final_texto text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ram_reunion on reunion_asignaciones_mecanicas(reunion_id);

-- 4. RLS
alter table reunion_asignaciones_mecanicas enable row level security;
do $$
declare t text;
begin
  t := 'reunion_asignaciones_mecanicas';
  execute format('drop policy if exists p_all on %I', t);
  execute format('create policy p_all on %I for all using (true) with check (true)', t);
end $$;

-- 5. FUNCION LIMPIEZA
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

-- 6. TRIGGER UPDATED_AT RAM
drop trigger if exists trg_touch_ram on reunion_asignaciones_mecanicas;
create trigger trg_touch_ram before update on reunion_asignaciones_mecanicas
  for each row execute function vm_touch();
