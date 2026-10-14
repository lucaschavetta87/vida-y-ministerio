-- ============================================================
--  Migración v14: usuarios de la APLICACIÓN VIDA Y MINISTERIO
--
--  OJO: en esta base de datos ya existe una tabla `usuarios`
--  que pertenece a otra aplicación (sucursal, ventas, stock,
--  caja, presupuestos). No se toca. Por eso las tablas de esta
--  aplicación se llaman `app_usuarios` y `app_usuarios_permisos`.
--
--  - app_usuarios: nombre de acceso, clave hasheada y a qué
--    persona de la congregación está delegado
--  - app_usuarios_permisos: a qué partes puede entrar
--
--  Es idempotente: se puede correr más de una vez.
-- ============================================================

-- limpia el índice que una versión anterior de este script dejó
-- en la tabla `usuarios` de la otra aplicación
drop index if exists public.usuarios_nombre_unico;

create table if not exists public.app_usuarios (
  id              uuid primary key default gen_random_uuid(),
  -- nombre con el que se entra al sistema
  nombre          text not null,
  -- persona de la congregación a la que está delegado
  participante_id uuid references public.participantes (id) on delete set null,
  -- clave con el formato "salto:hash" (PBKDF2-SHA256), nunca en texto
  clave_hash      text not null,
  activo          boolean not null default true,
  ultimo_acceso   timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create unique index if not exists app_usuarios_nombre_unico
  on public.app_usuarios (lower(nombre));

comment on table public.app_usuarios is
  'Usuarios de Vida y Ministerio. La clave se guarda hasheada (PBKDF2).';
comment on column public.app_usuarios.clave_hash is
  'PBKDF2-SHA256 con salto aleatorio, en formato "salto:hash".';
comment on column public.app_usuarios.participante_id is
  'Persona de la congregación a la que se delega este usuario.';

-- ------------------------------------------------------------
--  A qué partes puede entrar
-- ------------------------------------------------------------
create table if not exists public.app_usuarios_permisos (
  usuario_id uuid not null references public.app_usuarios (id) on delete cascade,
  permiso    text not null,
  primary key (usuario_id, permiso)
);

comment on table public.app_usuarios_permisos is
  'Permisos por usuario: participantes, reunion, asignaciones, servicio, secretaria.';

-- ------------------------------------------------------------
--  RLS (acceso anónimo, igual que el resto del proyecto)
-- ------------------------------------------------------------
alter table public.app_usuarios enable row level security;
alter table public.app_usuarios_permisos enable row level security;

drop policy if exists p_all on public.app_usuarios;
create policy p_all on public.app_usuarios for all using (true) with check (true);

drop policy if exists p_all on public.app_usuarios_permisos;
create policy p_all on public.app_usuarios_permisos for all using (true) with check (true);