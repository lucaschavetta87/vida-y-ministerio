-- Migración v19: grupos de predicación
-- Cada participante pertenece a un grupo (1..6).
-- Cada grupo tiene un superintendente (anciano) y un auxiliar (siervo ministerial).

-- 1) Columna grupo en participantes
alter table participantes
  add column if not exists grupo int;

-- 2) Tabla de configuración de grupos
create table if not exists grupos (
  numero int primary key,
  superintendente_id uuid references participantes(id) on delete set null,
  auxiliar_id uuid references participantes(id) on delete set null,
  actualizado_en timestamptz default now()
);

-- Sembrar los 6 grupos fijos
insert into grupos (numero) values (1),(2),(3),(4),(5),(6)
  on conflict (numero) do nothing;

-- 3) RLS
alter table grupos enable row level security;

drop policy if exists "grupos_lectura" on grupos;
create policy "grupos_lectura" on grupos
  for select using (true);

drop policy if exists "grupos_escritura" on grupos;
create policy "grupos_escritura" on grupos
  for all using (true) with check (true);
-- (la protección real de escritura se hace en la app: solo admin)
