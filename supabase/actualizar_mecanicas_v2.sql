-- ACTUALIZACIONES V2 PARA ASIGNACIONES MECANICAS
-- Ejecutar en Supabase SQL Editor (idempotente)

-- 1. PARTICIPANTES - flag lector atalaya
alter table participantes add column if not exists lector_atalaya_aprobado boolean default false;

-- 2. AGREGAR COLUMNAS EN RAM
alter table reunion_asignaciones_mecanicas
  add column if not exists retiro_donaciones_1_id uuid references participantes(id) on delete set null,
  add column if not exists retiro_donaciones_2_id uuid references participantes(id) on delete set null,
  add column if not exists retiro_donaciones_1_fs_id uuid references participantes(id) on delete set null,
  add column if not exists retiro_donaciones_2_fs_id uuid references participantes(id) on delete set null,
  add column if not exists dia_finsemana text;

-- 3. MIGRAR DATOS EXISTENTES
update reunion_asignaciones_mecanicas
  set retiro_donaciones_1_id = retiro_donaciones_id
  where retiro_donaciones_id is not null and retiro_donaciones_1_id is null;

update reunion_asignaciones_mecanicas
  set retiro_donaciones_1_fs_id = retiro_donaciones_fs_id
  where retiro_donaciones_fs_id is not null and retiro_donaciones_1_fs_id is null;
